import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StaffStore } from './core/staff.store';
import { AdminApi, apiError } from './core/api.service';

@Component({
  selector: 'ba-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatListModule, MatToolbarModule, MatIconModule, MatButtonModule, MatSlideToggleModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly staff = inject(StaffStore);
  private readonly api = inject(AdminApi);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);
  protected readonly handset = toSignal(
    inject(BreakpointObserver).observe('(max-width: 899px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected async toggleOpen(isOpen: boolean) {
    try {
      const venue = await this.api.setVenueOpen(isOpen);
      this.staff.me.update((m) => (m ? { ...m, venue } : m));
      this.snack.open(isOpen ? 'Now taking orders' : 'Ordering paused for guests', undefined, { duration: 2500 });
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 4000 });
    }
  }

  protected async logout() {
    await this.staff.logout();
    await this.router.navigateByUrl('/login');
  }
}
