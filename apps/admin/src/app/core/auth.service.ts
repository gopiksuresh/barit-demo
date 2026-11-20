import { computed, Injectable, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import {
  Auth,
  ConfirmationResult,
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  User,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

/** Firebase Phone Auth (mobile + OTP). Uses the Auth emulator in dev. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth: Auth;
  private confirmation: ConfirmationResult | null = null;
  private verifier: RecaptchaVerifier | null = null;

  /** undefined until Firebase has restored the persisted session. */
  readonly user = signal<User | null | undefined>(undefined);
  readonly isLoggedIn = computed(() => !!this.user());
  readonly phone = computed(() => this.user()?.phoneNumber ?? null);
  readonly ready: Promise<void>;

  constructor() {
    this.auth = getAuth(initializeApp(environment.firebase));
    if (environment.useEmulators) {
      connectAuthEmulator(this.auth, environment.authEmulatorUrl, { disableWarnings: true });
      // The emulator does not check reCAPTCHA; skip the widget entirely.
      this.auth.settings.appVerificationDisabledForTesting = true;
    }
    this.ready = new Promise((resolve) =>
      onAuthStateChanged(this.auth, (u) => {
        this.user.set(u);
        resolve();
      }),
    );
  }

  async sendOtp(phoneE164: string, recaptchaHost: HTMLElement): Promise<void> {
    this.verifier?.clear();
    this.verifier = new RecaptchaVerifier(this.auth, recaptchaHost, { size: 'invisible' });
    this.confirmation = await signInWithPhoneNumber(this.auth, phoneE164, this.verifier);
  }

  async verifyOtp(code: string): Promise<void> {
    if (!this.confirmation) throw new Error('Request a code first');
    const cred = await this.confirmation.confirm(code);
    this.user.set(cred.user);
  }

  async idToken(): Promise<string | null> {
    await this.ready;
    return this.auth.currentUser ? this.auth.currentUser.getIdToken() : null;
  }

  async logout(): Promise<void> {
    await signOut(this.auth);
  }

  /** Dev only: the Auth emulator exposes generated codes instead of sending SMS. */
  async fetchEmulatorOtp(phoneE164: string): Promise<string | null> {
    if (!environment.useEmulators) return null;
    const res = await fetch(
      `${environment.authEmulatorUrl}/emulator/v1/projects/${environment.firebase.projectId}/verificationCodes`,
    );
    const body = (await res.json()) as { verificationCodes?: Array<{ phoneNumber: string; code: string }> };
    const mine = (body.verificationCodes ?? []).filter((c) => c.phoneNumber === phoneE164);
    return mine.at(-1)?.code ?? null;
  }
}

export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-phone-number':
      return 'That phone number doesn’t look right.';
    case 'auth/invalid-verification-code':
      return 'Incorrect code — please check and try again.';
    case 'auth/code-expired':
      return 'That code has expired. Request a new one.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes.';
    case 'auth/network-request-failed':
      return 'Network error — is the Firebase Auth emulator running?';
    default:
      return (e as Error)?.message || 'Something went wrong.';
  }
}
