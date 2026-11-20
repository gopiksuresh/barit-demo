import { Injectable, NotFoundException } from '@nestjs/common';
import type { Bill, LiveSessionDto, SessionDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';
import { orderInclude, toOrderDto, toVenueDto } from '../common/mappers';
import { calculateBill } from '../payments/bill';

export const sessionInclude = {
  table: { include: { venue: true } },
  orders: { include: orderInclude, orderBy: { placedAt: 'asc' } },
  payments: { orderBy: { createdAt: 'desc' } },
} satisfies Prisma.TableSessionInclude;

export type SessionFull = Prisma.TableSessionGetPayload<{ include: typeof sessionInclude }>;

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async load(sessionId: string): Promise<SessionFull> {
    const s = await this.prisma.tableSession.findUnique({ where: { id: sessionId }, include: sessionInclude });
    if (!s) throw new NotFoundException('Session not found');
    return s;
  }

  /** Bill over all non-cancelled orders in the session. */
  billFor(s: SessionFull, tipPaise = 0): Bill {
    const lines = s.orders
      .filter((o) => o.status !== 'CANCELLED')
      .flatMap((o) =>
        o.items.map((it) => ({
          itemName: it.itemName,
          portionLabel: it.portionLabel,
          qty: it.qty,
          unitPricePaise: it.unitPricePaise,
          gstRatePct: Number(it.gstRatePct),
        })),
      );
    return calculateBill(lines, tipPaise);
  }

  private latestPayment(s: SessionFull) {
    const paid = s.payments.find((p) => p.status === 'PAID');
    const p = paid ?? s.payments.find((x) => x.status === 'CREATED') ?? null;
    return p ? { status: p.status, method: p.method, totalPaise: p.totalPaise } : null;
  }

  private tipOf(s: SessionFull): number {
    const paid = s.payments.find((p) => p.status === 'PAID');
    return paid?.tipPaise ?? 0;
  }

  toSessionDto(s: SessionFull): SessionDto {
    return {
      id: s.id,
      status: s.status,
      venue: toVenueDto(s.table.venue),
      tableNumber: s.table.number,
      orders: s.orders.map(toOrderDto),
      bill: this.billFor(s, this.tipOf(s)),
      payment: this.latestPayment(s),
    };
  }

  toLiveDto(s: SessionFull): LiveSessionDto {
    return {
      id: s.id,
      status: s.status,
      tableNumber: s.table.number,
      openedAt: s.openedAt.toISOString(),
      orders: s.orders.map(toOrderDto),
      bill: this.billFor(s, this.tipOf(s)),
      payment: this.latestPayment(s),
    };
  }
}
