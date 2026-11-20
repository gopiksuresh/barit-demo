import { Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService, friendlyAuthError } from '../core/auth.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'ba-phone-login',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatProgressBarModule],
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

  protected validPhone = () => /^[6-9]\d{9}$/.test(this.phone().trim());
  private e164 = () => `+91${this.phone().trim()}`;

  protected async send() {
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
      else this.error.set('No code in the emulator for this number yet.');
    } catch {
      this.error.set('Could not reach the Auth emulator on :9099.');
    }
  }
}
