import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { PhoneLogin } from '../shared/phone-login';
import { StaffStore } from '../core/staff.store';
import { environment } from '../../environments/environment';

@Component({
  selector: 'ba-login-page',
  imports: [MatCardModule, PhoneLogin],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  protected readonly staff = inject(StaffStore);
  private readonly router = inject(Router);
  protected readonly dev = environment.useEmulators;

  protected async signedIn() {
    if (await this.staff.load()) {
      await this.router.navigateByUrl(this.staff.me()?.role === 'KITCHEN' ? '/kds' : '/orders');
    }
  }
}
