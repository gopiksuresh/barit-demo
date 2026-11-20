import { Global, Module } from '@nestjs/common';
import { FirebaseTokenVerifier, TOKEN_VERIFIER } from './firebase';
import { FirebaseAuthGuard, GuestGuard, StaffGuard } from './guards';

@Global()
@Module({
  providers: [
    { provide: TOKEN_VERIFIER, useClass: FirebaseTokenVerifier },
    FirebaseAuthGuard,
    StaffGuard,
    GuestGuard,
  ],
  exports: [TOKEN_VERIFIER, FirebaseAuthGuard, StaffGuard, GuestGuard],
})
export class AuthModule {}
