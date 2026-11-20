import { Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Patch } from '@nestjs/common';
import { canTransition, type OrderDto, type OrderStatus } from '@barit/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { StaffUser } from '../generated/prisma/client';
import { CurrentStaff, StaffOnly } from '../auth/decorators';
import { orderInclude, toOrderDto } from '../common/mappers';
import { UpdateOrderStatusDto } from '../orders/dto';

const STATUS_TIMESTAMP: Partial<Record<OrderStatus, 'cookingAt' | 'readyAt' | 'servedAt' | 'cancelledAt'>> = {
  COOKING: 'cookingAt',
  READY: 'readyAt',
  SERVED: 'servedAt',
  CANCELLED: 'cancelledAt',
};

/**
 * Kitchen Display. Polled every few seconds by the admin /kds route; Express's
 * automatic ETag means unchanged boards come back as a cheap 304.
 */
@Controller('kds')
@StaffOnly()
export class KdsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('orders')
  async active(@CurrentStaff() staff: StaffUser): Promise<OrderDto[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: ['ORDERED', 'COOKING', 'READY'] },
        session: { table: { venueId: staff.venueId } },
      },
      orderBy: { placedAt: 'asc' },
      include: orderInclude,
    });
    return orders.map(toOrderDto);
  }

  @Patch('orders/:id/status')
  async setStatus(
    @Param('id') id: string,
    @Body() body: UpdateOrderStatusDto,
    @CurrentStaff() staff: StaffUser,
  ): Promise<OrderDto> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude });
    if (!order) throw new NotFoundException('Order not found');
    if (order.session.table.venueId !== staff.venueId) throw new ForbiddenException('Order belongs to another venue');
    if (!canTransition(order.status, body.status)) {
      throw new ConflictException(`Cannot move an order from ${order.status} to ${body.status}`);
    }
    const tsField = STATUS_TIMESTAMP[body.status];
    // Conditional update so two kitchen screens tapping at once can't double-advance.
    const res = await this.prisma.order.updateMany({
      where: { id, status: order.status },
      data: { status: body.status, ...(tsField ? { [tsField]: new Date() } : {}) },
    });
    if (res.count === 0) throw new ConflictException('Order was updated by someone else — refresh');
    const updated = await this.prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude });
    return toOrderDto(updated);
  }
}
