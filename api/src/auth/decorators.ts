import { applyDecorators, createParamDecorator, ExecutionContext, SetMetadata, UseGuards } from '@nestjs/common';
import type { StaffRole } from '../generated/prisma/client';
import { AuthedRequest, FirebaseAuthGuard, GuestGuard, STAFF_ROLES_KEY, StaffGuard } from './guards';

/** Venue staff only. Omit roles to allow any staff role. */
export const StaffOnly = (...roles: StaffRole[]) =>
  applyDecorators(SetMetadata(STAFF_ROLES_KEY, roles), UseGuards(FirebaseAuthGuard, StaffGuard));

/** Phone-verified guest. */
export const GuestAuth = () => applyDecorators(UseGuards(FirebaseAuthGuard, GuestGuard));

export const CurrentStaff = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().staff!,
);

export const CurrentGuest = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().guest!,
);
