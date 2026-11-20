import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import type { StaffMeDto } from '@barit/shared';
import { AdminApi } from './api.service';
import { AuthService } from './auth.service';

/** The signed-in staff member and their venue. */
@Injectable({ providedIn: 'root' })
export class StaffStore {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);

  readonly me = signal<StaffMeDto | null>(null);
  readonly notStaff = signal(false);
  readonly canEditMenu = computed(() => ['OWNER', 'STAFF'].includes(this.me()?.role ?? ''));
  readonly isOwner = computed(() => this.me()?.role === 'OWNER');

  /** Loads /admin/me. Returns false if the phone isn't registered staff. */
  async load(): Promise<boolean> {
    if (this.me()) return true;
    try {
      this.me.set(await this.api.me());
      this.notStaff.set(false);
      return true;
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 403) {
        this.notStaff.set(true);
        await this.auth.logout();
      }
      return false;
    }
  }

  async logout() {
    this.me.set(null);
    await this.auth.logout();
  }
}
