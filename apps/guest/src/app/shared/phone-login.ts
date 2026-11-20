import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, friendlyAuthError } from '../core/auth.service';
import { environment } from '../../environments/environment';

/** Mobile number → OTP flow (Firebase Phone Auth). */
@Component({
  selector: 'bg-phone-login',
  imports: [FormsModule],
  templateUrl: './phone-login.html',
  styleUrl: './phone-login.scss',
})
export class PhoneLogin {
  private readonly auth = inject(AuthService);
  private readonly recaptcha = viewChild.required<ElementRef<HTMLElement>>('recaptcha');

  readonly done = output<void>();

  protected readonly dev = environment.useEmulators;
  protected readonly step = signal<'phone' | 'otp'>('phone');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  // Signals (not plain fields): the app is zoneless, so values set after an await —
  // e.g. the emulator OTP fill — must notify Angular to re-render.
  protected readonly phone = signal('');
  protected readonly code = signal('');

  protected validPhone = () => /^[6-9]\d{9}$/.test(this.phone().replace(/\s/g, ''));
  private e164 = () => `+91${this.phone().replace(/\s/g, '')}`;

  protected async send() {
    if (!this.validPhone()) return;
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.sendOtp(this.e164(), this.recaptcha().nativeElement);
      this.step.set('otp');
    } catch (e) {
      this.error.set(friendlyAuthError(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async verify() {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.auth.verifyOtp(this.code().trim());
      this.done.emit();
    } catch (e) {
      this.error.set(friendlyAuthError(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async fillFromEmulator() {
    try {
      const code = await this.auth.fetchEmulatorOtp(this.e164());
      if (code) this.code.set(code);
      else this.error.set('No code found in the emulator for this number yet.');
    } catch {
      this.error.set('Could not reach the Auth emulator on :9099.');
    }
  }

  protected reset() {
    this.step.set('phone');
    this.code.set('');
    this.error.set(null);
  }
}
