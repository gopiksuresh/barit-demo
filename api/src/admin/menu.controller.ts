import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import type { CategoryDto as CategoryOut, MenuItemDto, StaffMeDto, VenueDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffUser } from '../generated/prisma/client';
import { CurrentStaff, StaffOnly } from '../auth/decorators';
import { itemInclude, toCategoryDto, toItemDto, toVenueDto } from '../common/mappers';
import { CategoryDto, CreateItemDto, PortionInputDto, ReorderDto, UpdateCategoryDto, UpdateItemDto, VenueSettingsDto } from './dto';

@Controller('admin')
@StaffOnly()
export class AdminMenuController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  async me(@CurrentStaff() staff: StaffUser): Promise<StaffMeDto> {
    const venue = await this.prisma.venue.findUniqueOrThrow({ where: { id: staff.venueId } });
    return { id: staff.id, phone: staff.phone, name: staff.name, role: staff.role, venue: toVenueDto(venue) };
  }

  @Patch('venue')
  @StaffOnly('OWNER')
  async updateVenue(@CurrentStaff() staff: StaffUser, @Body() body: VenueSettingsDto): Promise<VenueDto> {
    const v = await this.prisma.venue.update({ where: { id: staff.venueId }, data: body });
    return toVenueDto(v);
  }

  /** Full menu for editing — includes unavailable items. */
  @Get('menu')
  async menu(@CurrentStaff() staff: StaffUser): Promise<CategoryOut[]> {
    const cats = await this.prisma.category.findMany({
      where: { venueId: staff.venueId },
      orderBy: { sortOrder: 'asc' },
      include: { items: { where: { archived: false }, orderBy: { sortOrder: 'asc' }, include: itemInclude } },
    });
    return cats.map(toCategoryDto);
  }

  // ---------- categories ----------

  @Post('categories')
  @StaffOnly('OWNER', 'STAFF')
  async createCategory(@CurrentStaff() staff: StaffUser, @Body() body: CategoryDto): Promise<CategoryOut> {
    const max = await this.prisma.category.aggregate({ where: { venueId: staff.venueId }, _max: { sortOrder: true } });
    const c = await this.prisma.category.create({
      data: {
        venueId: staff.venueId,
        name: body.name.trim(),
        gstRatePct: body.gstRatePct ?? 5,
        sortOrder: body.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
      },
      include: { items: { include: itemInclude } },
    });
    return toCategoryDto(c);
  }

  @Patch('categories/:id')
  @StaffOnly('OWNER', 'STAFF')
  async updateCategory(@CurrentStaff() staff: StaffUser, @Param('id') id: string, @Body() body: UpdateCategoryDto) {
    await this.ownCategory(staff, id);
    const c = await this.prisma.category.update({
      where: { id },
      data: { ...body, name: body.name?.trim() },
      include: { items: { where: { archived: false }, orderBy: { sortOrder: 'asc' }, include: itemInclude } },
    });
    return toCategoryDto(c);
  }

  @Delete('categories/:id')
  @HttpCode(204)
  @StaffOnly('OWNER')
  async deleteCategory(@CurrentStaff() staff: StaffUser, @Param('id') id: string) {
    await this.ownCategory(staff, id);
    const live = await this.prisma.menuItem.count({ where: { categoryId: id, archived: false } });
    if (live > 0) throw new ForbiddenException('Move or delete the items in this category first');
    const anyHistory = await this.prisma.menuItem.count({ where: { categoryId: id } });
    if (anyHistory === 0) await this.prisma.category.delete({ where: { id } });
    else throw new ForbiddenException('Category has order history and cannot be deleted');
  }

  @Post('categories/reorder')
  @HttpCode(204)
  @StaffOnly('OWNER', 'STAFF')
  async reorderCategories(@CurrentStaff() staff: StaffUser, @Body() body: ReorderDto) {
    const owned = await this.prisma.category.findMany({ where: { venueId: staff.venueId, id: { in: body.ids } } });
    if (owned.length !== body.ids.length) throw new ForbiddenException('Unknown category in reorder list');
    await this.prisma.$transaction(
      body.ids.map((id, i) => this.prisma.category.update({ where: { id }, data: { sortOrder: i } })),
    );
  }

  // ---------- items ----------

  @Post('items')
  @StaffOnly('OWNER', 'STAFF')
  async createItem(@CurrentStaff() staff: StaffUser, @Body() body: CreateItemDto): Promise<MenuItemDto> {
    await this.ownCategory(staff, body.categoryId);
    const max = await this.prisma.menuItem.aggregate({
      where: { categoryId: body.categoryId },
      _max: { sortOrder: true },
    });
    const item = await this.prisma.menuItem.create({
      data: {
        categoryId: body.categoryId,
        name: body.name.trim(),
        description: body.description?.trim() || null,
        imageUrl: body.imageUrl ?? null,
        isVeg: body.isVeg ?? false,
        isSpecial: body.isSpecial ?? false,
        isAvailable: body.isAvailable ?? true,
        sortOrder: body.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        portions: {
          create: body.portions.map((p, i) => ({ label: p.label.trim(), pricePaise: p.pricePaise, sortOrder: i })),
        },
      },
      include: itemInclude,
    });
    return toItemDto(item);
  }

  @Patch('items/:id')
  @StaffOnly('OWNER', 'STAFF')
  async updateItem(@CurrentStaff() staff: StaffUser, @Param('id') id: string, @Body() body: UpdateItemDto): Promise<MenuItemDto> {
    await this.ownItem(staff, id);
    if (body.categoryId) await this.ownCategory(staff, body.categoryId);
    const { portions, ...fields } = body;

    await this.prisma.$transaction(async (tx) => {
      await tx.menuItem.update({
        where: { id },
        data: {
          ...fields,
          name: fields.name?.trim(),
          description: fields.description === undefined ? undefined : fields.description?.trim() || null,
        },
      });
      if (portions) await this.syncPortions(tx, id, portions);
    });

    const item = await this.prisma.menuItem.findUniqueOrThrow({ where: { id }, include: itemInclude });
    return toItemDto(item);
  }

  /** Items are archived, not deleted, so past bills keep their history. */
  @Delete('items/:id')
  @HttpCode(204)
  @StaffOnly('OWNER', 'STAFF')
  async deleteItem(@CurrentStaff() staff: StaffUser, @Param('id') id: string) {
    await this.ownItem(staff, id);
    await this.prisma.menuItem.update({ where: { id }, data: { archived: true, isAvailable: false, isSpecial: false } });
  }

  /**
   * Updates portions in place by id, creates new ones, archives removed ones.
   * Prices already on orders are snapshotted, so edits never alter past bills.
   */
  private async syncPortions(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    itemId: string,
    portions: PortionInputDto[],
  ) {
    const existing = await tx.portion.findMany({ where: { itemId, archived: false } });
    const existingIds = new Set(existing.map((p) => p.id));
    const keep = new Set<string>();
    for (const [i, p] of portions.entries()) {
      if (p.id && existingIds.has(p.id)) {
        keep.add(p.id);
        await tx.portion.update({ where: { id: p.id }, data: { label: p.label.trim(), pricePaise: p.pricePaise, sortOrder: i } });
      } else {
        await tx.portion.create({ data: { itemId, label: p.label.trim(), pricePaise: p.pricePaise, sortOrder: i } });
      }
    }
    const removed = existing.filter((p) => !keep.has(p.id)).map((p) => p.id);
    if (removed.length) await tx.portion.updateMany({ where: { id: { in: removed } }, data: { archived: true } });
  }

  private async ownCategory(staff: StaffUser, id: string) {
    const c = await this.prisma.category.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    if (c.venueId !== staff.venueId) throw new ForbiddenException('Category belongs to another venue');
    return c;
  }

  private async ownItem(staff: StaffUser, id: string) {
    const i = await this.prisma.menuItem.findUnique({ where: { id }, include: { category: true } });
    if (!i || i.archived) throw new NotFoundException('Item not found');
    if (i.category.venueId !== staff.venueId) throw new ForbiddenException('Item belongs to another venue');
    return i;
  }
}
