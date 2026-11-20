import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { OrderDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, type Guest } from '../generated/prisma/client';
import { orderInclude, toOrderDto } from '../common/mappers';
import type { PlaceOrderDto } from './dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Places an order at a table: opens (or joins) the table's active session,
   * validates every portion belongs to this venue and is orderable, and
   * snapshots name/price/GST so later menu edits never change past bills.
   */
  async placeOrder(qrToken: string, guest: Guest, req: PlaceOrderDto): Promise<{ sessionId: string; order: OrderDto }> {
    const table = await this.prisma.diningTable.findUnique({ where: { qrToken }, include: { venue: true } });
    if (!table) throw new NotFoundException('Table not found');
    if (!table.venue.isOpen) throw new ConflictException(`${table.venue.name} is not taking orders right now`);

    const portionIds = [...new Set(req.items.map((i) => i.portionId))];
    const portions = await this.prisma.portion.findMany({
      where: { id: { in: portionIds } },
      include: { item: { include: { category: true } } },
    });
    const byId = new Map(portions.map((p) => [p.id, p]));
    for (const id of portionIds) {
      const p = byId.get(id);
      if (!p || p.archived || p.item.archived || p.item.category.venueId !== table.venueId) {
        throw new BadRequestException('One or more items are not on this venue’s menu');
      }
      if (!p.item.isAvailable) throw new BadRequestException(`${p.item.name} is currently unavailable`);
    }

    const sessionId = await this.activeSessionFor(table.id);

    if (req.guestName && !guest.name) {
      await this.prisma.guest.update({ where: { id: guest.id }, data: { name: req.guestName.trim() } });
    }

    const order = await this.prisma.order.create({
      data: {
        sessionId,
        guestId: guest.id,
        notes: req.notes?.trim() || null,
        items: {
          create: req.items.map((i) => {
            const p = byId.get(i.portionId)!;
            return {
              portionId: p.id,
              itemName: p.item.name,
              portionLabel: p.label,
              qty: i.qty,
              unitPricePaise: p.pricePaise,
              gstRatePct: p.item.category.gstRatePct,
              notes: i.notes?.trim() || null,
            };
          }),
        },
      },
      include: orderInclude,
    });
    return { sessionId, order: toOrderDto(order) };
  }

  /**
   * Returns the table's active session id, creating one if needed. A guest ordering
   * more while checkout is pending re-opens the session and voids the pending payment.
   * The partial unique index guarantees one active session per table under races.
   */
  private async activeSessionFor(tableId: string): Promise<string> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this.prisma.tableSession.findFirst({
        where: { tableId, status: { not: 'CLOSED' } },
      });
      if (existing) {
        if (existing.status === 'PAYING') {
          await this.prisma.$transaction([
            this.prisma.payment.updateMany({
              where: { sessionId: existing.id, status: 'CREATED' },
              data: { status: 'FAILED' },
            }),
            this.prisma.tableSession.update({ where: { id: existing.id }, data: { status: 'OPEN' } }),
          ]);
        }
        return existing.id;
      }
      try {
        const created = await this.prisma.tableSession.create({ data: { tableId } });
        return created.id;
      } catch (e) {
        // Lost the race to another guest's first order — loop and join theirs.
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') continue;
        throw e;
      }
    }
    throw new ConflictException('Could not open a table session, please retry');
  }
}
