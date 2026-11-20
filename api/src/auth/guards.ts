import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { Guest, StaffUser, StaffRole } from '../generated/prisma/client';
import { TOKEN_VERIFIER, TokenVerifier, VerifiedUser } from './firebase';

export const STAFF_ROLES_KEY = 'barit:staffRoles';

export interface AuthedRequest extends Request {
  firebaseUser?: VerifiedUser;
  staff?: StaffUser;
  guest?: Guest;
}

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(@Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) throw new UnauthorizedException('Missing bearer token');
    try {
      req.firebaseUser = await this.verifier.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!req.firebaseUser.phone) throw new UnauthorizedException('Phone sign-in required');
    return true;
  }
}

/** Requires the phone number to belong to a StaffUser; binds req.staff (venue scope). */
@Injectable()
export class StaffGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = req.firebaseUser!;
    let staff = await this.prisma.staffUser.findUnique({ where: { phone: user.phone! } });
    if (!staff) throw new ForbiddenException('This phone number is not registered as venue staff');
    if (staff.firebaseUid !== user.uid) {
      staff = await this.prisma.staffUser.update({ where: { id: staff.id }, data: { firebaseUid: user.uid } });
    }
    const roles = this.reflector.getAllAndOverride<StaffRole[] | undefined>(STAFF_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles?.length && !roles.includes(staff.role)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
    req.staff = staff;
    return true;
  }
}

/** Any phone-verified user becomes a Guest (upserted by Firebase uid). */
@Injectable()
export class GuestGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const user = req.firebaseUser!;
    req.guest = await this.prisma.guest.upsert({
      where: { firebaseUid: user.uid },
      create: { firebaseUid: user.uid, phone: user.phone! },
      update: { phone: user.phone! },
    });
    return true;
  }
}
