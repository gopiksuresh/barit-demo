import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ORDER_STATUS_LABEL, type LiveSessionDto, type OrderStatus } from '@barit/shared';
import { AdminApi, apiError } from '../core/api.service';
import { InrPipe } from '../shared/inr.pipe';

const POLL_MS = 5000;

@Component({
  selector: 'ba-orders-page',
  imports: [DatePipe, MatButtonModule, MatIconModule, MatCardModule, MatMenuModule, MatChipsModule, MatButtonToggleModule, InrPipe],
  templateUrl: './orders.page.html',
  styleUrl: './orders.page.scss',
})
export class OrdersPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly sessions = signal<LiveSessionDto[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly filter = signal<'active' | 'closed'>('active');
  protected readonly activeCount = computed(() => this.sessions().filter((s) => s.status !== 'CLOSED').length);
  protected readonly shown = computed(() =>
    this.sessions().filter((s) => (this.filter() === 'active' ? s.status !== 'CLOSED' : s.status === 'CLOSED')),
  );

  ngOnInit() {
    void this.refresh();
    const t = setInterval(() => void this.refresh(), POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(t));
  }

  private async refresh() {
    try {
      this.sessions.set(await this.api.liveSessions());
      this.error.set(null);
    } catch (e) {
      this.error.set(apiError(e));
    }
  }

  protected label(s: OrderStatus) {
    return ORDER_STATUS_LABEL[s];
  }

  protected statusLabel(s: LiveSessionDto) {
    if (s.status === 'CLOSED') return 'Settled';
    if (s.status === 'PAYING') return 'Guest is paying…';
    const pending = s.orders.filter((o) => o.status !== 'SERVED' && o.status !== 'CANCELLED').length;
    return pending ? `${pending} order${pending > 1 ? 's' : ''} in progress` : 'All served';
  }

  protected maskPhone(p: string | null) {
    return p ? `•••• ${p.slice(-4)}` : 'Guest';
  }

  protected methodLabel(m?: string) {
    return m === 'CASH' ? 'Cash' : m === 'CARD' ? 'Card' : 'UPI (Razorpay)';
  }

  protected async markPaid(s: LiveSessionDto, method: 'CASH' | 'CARD') {
    try {
      const updated = await this.api.markPaid(s.id, method);
      this.sessions.update((ss) => ss.map((x) => (x.id === s.id ? updated : x)));
      this.snack.open(`Table ${s.tableNumber} settled (${method.toLowerCase()})`, undefined, { duration: 2500 });
    } catch (e) {
      this.snack.open(apiError(e), 'OK', { duration: 4000 });
    }
  }
}
