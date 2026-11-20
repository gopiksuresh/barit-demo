import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type { LiveSessionDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffUser } from '../generated/prisma/client';
import { CurrentStaff, StaffOnly } from '../auth/decorators';
import { SessionsService, sessionInclude } from '../sessions/sessions.service';
import { PaymentsService } from '../payments/payments.service';
import { MarkPaidDto } from './dto';

const RECENTLY_CLOSED_MS = 3 * 60 * 60 * 1000;

@Controller('admin/sessions')
@StaffOnly('OWNER', 'STAFF')
export class AdminOrdersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionsService,
    private readonly payments: PaymentsService,
  ) {}

  /** Live board: open / paying sessions plus the last few hours of settled ones. */
  @Get('live')
  async live(@CurrentStaff() staff: StaffUser): Promise<LiveSessionDto[]> {
    const since = new Date(Date.now() - RECENTLY_CLOSED_MS);
    const rows = await this.prisma.tableSession.findMany({
      where: {
        table: { venueId: staff.venueId },
        OR: [{ status: { not: 'CLOSED' } }, { closedAt: { gte: since } }],
      },
      orderBy: { openedAt: 'desc' },
      include: sessionInclude,
    });
    return rows.map((s) => this.sessions.toLiveDto(s));
  }

  @Post(':id/mark-paid')
  @HttpCode(200)
  async markPaid(@CurrentStaff() staff: StaffUser, @Param('id') id: string, @Body() body: MarkPaidDto): Promise<LiveSessionDto> {
    await this.payments.markPaidAtCounter(staff.venueId, id, body.method, body.tipPaise ?? 0);
    return this.sessions.toLiveDto(await this.sessions.load(id));
  }
}
