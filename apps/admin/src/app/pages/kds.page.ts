import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { ORDER_STATUS_LABEL, type OrderDto, type OrderStatus } from '@barit/shared';
import { AdminApi, apiError } from '../core/api.service';
import { StaffStore } from '../core/staff.store';

const POLL_MS = 4000;
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  ORDERED: { to: 'COOKING', label: 'Start cooking' },
  COOKING: { to: 'READY', label: 'Ready to serve' },
  READY: { to: 'SERVED', label: 'Served' },
};
const COLUMNS: OrderStatus[] = ['ORDERED', 'COOKING', 'READY'];

/** Full-screen Kitchen Display: Ordered → Cooking → Ready to Serve → Served. */
@Component({
  selector: 'ba-kds-page',
  imports: [RouterLink, MatIconModule, MatButtonModule],
  templateUrl: './kds.page.html',
  styleUrl: './kds.page.scss',
})
export class KdsPage implements OnInit {
  private readonly api = inject(AdminApi);
  protected readonly staff = inject(StaffStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly columns = COLUMNS;
  protected readonly orders = signal<OrderDto[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly pending = signal(new Set<string>());
  private readonly now = signal(Date.now());
  private readonly seenAt = new Map<string, number>();
  private firstLoad = true;

  protected readonly clock = computed(() =>
    new Date(this.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
  );
  protected readonly byStatus = computed(() => {
    const map: Record<string, OrderDto[]> = { ORDERED: [], COOKING: [], READY: [] };
    for (const o of this.orders()) map[o.status]?.push(o);
    return map as Record<OrderStatus, OrderDto[]>;
  });

  ngOnInit() {
    void this.refresh();
    const poll = setInterval(() => void this.refresh(), POLL_MS);
    const tick = setInterval(() => this.now.set(Date.now()), 1000);
    this.destroyRef.onDestroy(() => {
      clearInterval(poll);
      clearInterval(tick);
    });
  }

  private async refresh() {
    try {
      const orders = await this.api.kdsOrders();
      const t = Date.now();
      // Tickets arriving after the board first loads flash briefly.
      for (const o of orders) if (!this.seenAt.has(o.id)) this.seenAt.set(o.id, this.firstLoad ? 0 : t);
      this.firstLoad = false;
      this.orders.set(orders);
      this.error.set(null);
    } catch (e) {
      this.error.set(apiError(e));
    }
  }

  protected label(s: OrderStatus) {
    return ORDER_STATUS_LABEL[s];
  }
  protected next(o: OrderDto) {
    return NEXT[o.status];
  }
  protected isFresh(o: OrderDto) {
    const t = this.seenAt.get(o.id) ?? 0;
    return t > 0 && this.now() - t < 8000;
  }
  protected ageMin(o: OrderDto) {
    return Math.floor((this.now() - new Date(o.placedAt).getTime()) / 60000);
  }
  protected ageLabel(o: OrderDto) {
    const s = Math.max(0, Math.floor((this.now() - new Date(o.placedAt).getTime()) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  protected async advance(o: OrderDto, to: OrderStatus) {
    this.pending.update((p) => new Set(p).add(o.id));
    // Optimistic: move the ticket now; the next poll reconciles.
    const prev = this.orders();
    this.orders.update((os) => (to === 'SERVED' || to === 'CANCELLED' ? os.filter((x) => x.id !== o.id) : os.map((x) => (x.id === o.id ? { ...x, status: to } : x))));
    try {
      await this.api.setOrderStatus(o.id, to);
    } catch (e) {
      this.orders.set(prev);
      this.error.set(apiError(e));
      void this.refresh();
    } finally {
      this.pending.update((p) => {
        const n = new Set(p);
        n.delete(o.id);
        return n;
      });
    }
  }

  protected async logout() {
    await this.staff.logout();
    location.assign('/login');
  }
}
