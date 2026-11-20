import { Body, Controller, ForbiddenException, Get, HttpCode, NotFoundException, Param, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import type { CheckoutResponse, SessionDto, TableContextDto } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { Guest } from '../generated/prisma/client';
import { CurrentGuest, GuestAuth } from '../auth/decorators';
import { toVenueDto } from '../common/mappers';
import { OrdersService } from '../orders/orders.service';
import { PlaceOrderDto } from '../orders/dto';
import { SessionsService } from '../sessions/sessions.service';
import { PaymentsService } from '../payments/payments.service';

class CheckoutDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(10_000_00) tipPaise?: number;
}

class VerifyDto {
  @IsString() paymentId: string;
  @IsString() razorpayOrderId: string;
  @IsString() razorpayPaymentId: string;
  @IsString() razorpaySignature: string;
}

@Controller()
export class GuestController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly sessions: SessionsService,
    private readonly payments: PaymentsService,
  ) {}

  /** QR landing: resolves a table token to venue + table (public). */
  @Get('tables/:qrToken')
  async table(@Param('qrToken') qrToken: string): Promise<TableContextDto> {
    const table = await this.prisma.diningTable.findUnique({
      where: { qrToken },
      include: { venue: true, sessions: { where: { status: { not: 'CLOSED' } }, take: 1 } },
    });
    if (!table) throw new NotFoundException('Table not found');
    return {
      venue: toVenueDto(table.venue),
      table: { id: table.id, number: table.number, seats: table.seats, qrToken: table.qrToken },
      openSessionId: table.sessions[0]?.id ?? null,
    };
  }

  @Post('tables/:qrToken/orders')
  @GuestAuth()
  placeOrder(@Param('qrToken') qrToken: string, @CurrentGuest() guest: Guest, @Body() body: PlaceOrderDto) {
    return this.orders.placeOrder(qrToken, guest, body);
  }

  @Get('sessions/:id')
  @GuestAuth()
  async session(@Param('id') id: string, @CurrentGuest() guest: Guest): Promise<SessionDto> {
    const s = await this.sessions.load(id);
    this.assertMember(s.orders.map((o) => o.guestId), guest);
    return this.sessions.toSessionDto(s);
  }

  @Post('sessions/:id/checkout')
  @GuestAuth()
  async checkout(@Param('id') id: string, @CurrentGuest() guest: Guest, @Body() body: CheckoutDto): Promise<CheckoutResponse> {
    const s = await this.sessions.load(id);
    this.assertMember(s.orders.map((o) => o.guestId), guest);
    return this.payments.checkout(id, body.tipPaise ?? 0);
  }

  @Post('payments/verify')
  @HttpCode(200)
  @GuestAuth()
  async verify(@Body() body: VerifyDto, @CurrentGuest() guest: Guest): Promise<SessionDto> {
    const sessionId = await this.payments.verify(body);
    const s = await this.sessions.load(sessionId);
    this.assertMember(s.orders.map((o) => o.guestId), guest);
    return this.sessions.toSessionDto(s);
  }

  /** Only guests who ordered in a session may view or pay its bill. */
  private assertMember(guestIds: string[], guest: Guest) {
    if (!guestIds.includes(guest.id)) throw new ForbiddenException('You are not part of this table session');
  }
}
