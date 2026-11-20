import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, apiError } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { CartStore } from '../core/cart.store';
import { InrPipe } from '../shared/inr.pipe';
import { VegMark } from '../shared/veg-mark';
import { Icon } from '../shared/icon';
import { DishImage } from '../shared/dish-image';
import { QtyStepper } from '../shared/qty-stepper';
import { SwipeRow } from '../shared/swipe-row';

@Component({
  selector: 'bg-cart-page',
  imports: [FormsModule, RouterLink, InrPipe, VegMark, Icon, DishImage, QtyStepper, SwipeRow],
  templateUrl: './cart.page.html',
  styleUrl: './cart.page.scss',
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  protected notes = '';
  protected guestName = '';
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Estimated total; the restaurant's bill (server-side) is authoritative. */
  protected readonly estTotalPaise = computed(() => this.cart.subtotalPaise() + (this.cart.estTaxPaise() ?? 0));

  protected async place() {
    const t = this.cart.table();
    if (!t) return;
    await this.auth.ready;
    if (!this.auth.isLoggedIn()) {
      await this.router.navigate(['/login'], { queryParams: { redirect: '/cart' } });
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const res = await this.api.placeOrder(t.table.qrToken, {
        items: this.cart.lines().map((l) => ({ portionId: l.portionId, qty: l.qty, ...(l.notes ? { notes: l.notes } : {}) })),
        notes: this.notes.trim() || undefined,
        guestName: this.guestName.trim() || undefined,
      });
      this.cart.rememberSession(t.table.qrToken, res.sessionId);
      this.cart.clear();
      await this.router.navigate(['/session', res.sessionId], { queryParams: { placed: 1 } });
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
