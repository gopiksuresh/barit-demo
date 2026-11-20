import {
  Body,
  ConflictException,
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
import { randomBytes } from 'node:crypto';
import QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type StaffUser } from '../generated/prisma/client';
import { CurrentStaff, StaffOnly } from '../auth/decorators';
import { TableDto, UpdateTableDto } from './dto';

export const newQrToken = () => randomBytes(9).toString('base64url');

export const guestTableUrl = (qrToken: string) =>
  `${(process.env.GUEST_URL ?? 'http://localhost:4200').replace(/\/$/, '')}/table/${qrToken}`;

@Controller('admin/tables')
@StaffOnly()
export class AdminTablesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentStaff() staff: StaffUser) {
    const tables = await this.prisma.diningTable.findMany({
      where: { venueId: staff.venueId },
      orderBy: { number: 'asc' },
      include: { sessions: { where: { status: { not: 'CLOSED' } }, take: 1 } },
    });
    return tables.map((t) => ({
      id: t.id,
      number: t.number,
      seats: t.seats,
      qrToken: t.qrToken,
      url: guestTableUrl(t.qrToken),
      occupied: t.sessions.length > 0,
      sessionId: t.sessions[0]?.id ?? null,
    }));
  }

  @Post()
  @StaffOnly('OWNER')
  async create(@CurrentStaff() staff: StaffUser, @Body() body: TableDto) {
    try {
      const t = await this.prisma.diningTable.create({
        data: { venueId: staff.venueId, number: body.number, seats: body.seats ?? 4, qrToken: newQrToken() },
      });
      return { ...t, url: guestTableUrl(t.qrToken), occupied: false, sessionId: null };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Table ${body.number} already exists`);
      }
      throw e;
    }
  }

  @Patch(':id')
  @StaffOnly('OWNER')
  async update(@CurrentStaff() staff: StaffUser, @Param('id') id: string, @Body() body: UpdateTableDto) {
    await this.own(staff, id);
    try {
      return await this.prisma.diningTable.update({ where: { id }, data: body });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Table ${body.number} already exists`);
      }
      throw e;
    }
  }

  /** Issues a fresh QR token — old printed codes stop working. */
  @Post(':id/rotate-qr')
  @StaffOnly('OWNER')
  async rotate(@CurrentStaff() staff: StaffUser, @Param('id') id: string) {
    await this.own(staff, id);
    const t = await this.prisma.diningTable.update({ where: { id }, data: { qrToken: newQrToken() } });
    return { ...t, url: guestTableUrl(t.qrToken) };
  }

  @Delete(':id')
  @HttpCode(204)
  @StaffOnly('OWNER')
  async remove(@CurrentStaff() staff: StaffUser, @Param('id') id: string) {
    await this.own(staff, id);
    const sessions = await this.prisma.tableSession.count({ where: { tableId: id } });
    if (sessions > 0) throw new ConflictException('Table has order history and cannot be deleted');
    await this.prisma.diningTable.delete({ where: { id } });
  }

  /** QR as a PNG data URL (returned as JSON so it can be fetched with the auth header). */
  @Get(':id/qr')
  async qr(@CurrentStaff() staff: StaffUser, @Param('id') id: string) {
    const t = await this.own(staff, id);
    const url = guestTableUrl(t.qrToken);
    const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2, errorCorrectionLevel: 'M' });
    return { tableNumber: t.number, url, dataUrl };
  }

  private async own(staff: StaffUser, id: string) {
    const t = await this.prisma.diningTable.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Table not found');
    if (t.venueId !== staff.venueId) throw new ForbiddenException('Table belongs to another venue');
    return t;
  }
}
