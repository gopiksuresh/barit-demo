import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { PhoneLogin } from '../shared/phone-login';
import { Icon } from '../shared/icon';

@Component({
  selector: 'bg-login-page',
  imports: [PhoneLogin, Icon],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly router = inject(Router);
  readonly redirect = input<string>();

  protected continue() {
    const target = this.redirect();
    // Only allow in-app redirects.
    void this.router.navigateByUrl(target && target.startsWith('/') && !target.startsWith('//') ? target : '/');
  }

  protected back() {
    history.length > 1 ? history.back() : void this.router.navigateByUrl('/');
  }
}
