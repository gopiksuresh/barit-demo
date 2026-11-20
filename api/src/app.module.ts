import { Controller, Get, Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.service';
import { AuthModule } from './auth/auth.module';
import { VenuesController } from './venues/venues.controller';
import { GuestController } from './guest/guest.controller';
import { KdsController } from './kds/kds.controller';
import { AdminMenuController } from './admin/menu.controller';
import { AdminTablesController } from './admin/tables.controller';
import { AdminOrdersController } from './admin/orders.controller';
import { AdminUploadsController } from './admin/uploads.controller';
import { OrdersService } from './orders/orders.service';
import { SessionsService } from './sessions/sessions.service';
import { PaymentsService } from './payments/payments.service';

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { ok: true, payments: process.env.RAZORPAY_KEY_ID ? 'razorpay-test' : 'stub' };
  }
}

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    HealthController,
    VenuesController,
    GuestController,
    KdsController,
    AdminMenuController,
    AdminTablesController,
    AdminOrdersController,
    AdminUploadsController,
  ],
  providers: [OrdersService, SessionsService, PaymentsService],
})
export class AppModule {}
