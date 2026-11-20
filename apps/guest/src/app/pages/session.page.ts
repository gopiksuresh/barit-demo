import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import type { CheckoutResponse, OrderDto, OrderStatus, SessionDto } from '@barit/shared';
import { ApiService, apiError } from '../core/api.service';
import { CartStore } from '../core/cart.store';
import { InrPipe } from '../shared/inr.pipe';
import { Icon } from '../shared/icon';
import { loadRazorpay } from '../core/razorpay';

const POLL_MS = 5000;
const STEPS: OrderStatus[] = ['ORDERED', 'COOKING', 'READY', 'SERVED'];
/** Guest-facing wording for kitchen statuses (staff screens keep the KDS labels). */
const GUEST_LABEL: Record<OrderStatus, string> = {
  ORDERED: 'Received',
  COOKING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};
type TipChoice = 0 | 5 | 10 | 'custom';

@Component({
  selector: 'bg-session-page',
  imports: [RouterLink, InrPipe, DatePipe, Icon],
  templateUrl: './session.page.html',
  styleUrl: './session.page.scss',
})
export class SessionPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly id = input.required<string>();
  /** ?placed=1 after a fresh order. */
  readonly placedParam = input<string | undefined>(undefined, { alias: 'placed' });

  protected readonly s = signal<SessionDto | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly paying = signal(false);
  protected readonly stub = signal<CheckoutResponse | null>(null);
  protected readonly tip = signal<TipChoice>(0);
  protected readonly customRupees = signal(0);
  private readonly confirmDismissed = signal(false);

  protected readonly steps = STEPS;
  protected readonly tipChoices: TipChoice[] = [0, 5, 10, 'custom'];
  protected readonly placed = computed(() => this.placedParam() === '1');
  protected readonly tableQr = computed(() => this.cart.table()?.table.qrToken ?? null);

  /** The order just placed — the newest one in the session. */
  protected readonly latestOrder = computed<OrderDto | undefined>(() => this.s()?.orders.at(-1));
  protected readonly showConfirm = computed(
    () => this.placed() && !this.confirmDismissed() && !!this.latestOrder() && this.s()?.status !== 'CLOSED',
  );

  protected readonly tipPaise = computed(() => {
    const sub = this.s()?.bill.subtotalPaise ?? 0;
    const t = this.tip();
    if (t === 'custom') return Math.max(0, Math.round(this.customRupees() * 100));
    return Math.round((sub * t) / 100);
  });
  protected readonly grandTotal = computed(() => {
    const b = this.s()?.bill;
    return b ? b.subtotalPaise + b.gstPaise + this.tipPaise() : 0;
  });

  ngOnInit() {
    void this.refresh();
    const timer = setInterval(() => {
      if (this.s()?.status !== 'CLOSED' && !this.paying() && !this.stub()) void this.refresh();
    }, POLL_MS);
    this.destroyRef.onDestroy(() => clearInterval(timer));
  }

  private async refresh() {
    try {
      this.s.set(await this.api.session(this.id()));
      this.error.set(null);
    } catch (e) {
      if (!this.s()) this.error.set(apiError(e));
    }
  }

  protected label(st: OrderStatus) {
    return GUEST_LABEL[st];
  }
  protected reached(current: OrderStatus, step: OrderStatus) {
    return STEPS.indexOf(current) >= STEPS.indexOf(step);
  }
  /** Short, human-friendly order reference derived from the order id. */
  protected orderNo(o: OrderDto) {
    return '#' + o.id.slice(-4).toUpperCase();
  }
  protected methodLabel(m?: string) {
    return m === 'CASH' ? 'cash' : m === 'CARD' ? 'card at the counter' : 'UPI / Razorpay';
  }

  /** Close the confirmation and drop ?placed from the URL so a refresh doesn't reopen it. */
  protected dismissConfirm() {
    this.confirmDismissed.set(true);
    void this.router.navigate([], { queryParams: { placed: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected async pay() {
    const s = this.s();
    if (!s) return;
    this.paying.set(true);
    this.error.set(null);
    try {
      const co = await this.api.checkout(s.id, this.tipPaise());
      if (co.stub) {
        this.stub.set(co);
      } else {
        await this.openRazorpay(co);
      }
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.paying.set(false);
    }
  }

  protected async completeStub(co: CheckoutResponse, success: boolean) {
    if (!success) {
      this.stub.set(null);
      this.error.set('Payment failed (simulated). You can try again.');
      return;
    }
    this.paying.set(true);
    try {
      const s = await this.api.verifyPayment({
        paymentId: co.paymentId,
        razorpayOrderId: co.razorpayOrderId,
        razorpayPaymentId: `stub_pay_${Date.now()}`,
        razorpaySignature: 'stub',
      });
      this.finish(s);
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.stub.set(null);
      this.paying.set(false);
    }
  }

  private async openRazorpay(co: CheckoutResponse) {
    const Razorpay = await loadRazorpay();
    const s = this.s()!;
    await new Promise<void>((resolve) => {
      const rzp = new Razorpay({
        key: co.razorpayKeyId,
        amount: co.amountPaise,
        currency: co.currency,
        order_id: co.razorpayOrderId,
        name: s.venue.name,
        description: `Table ${s.tableNumber}`,
        theme: { color: '#E8A43A' },
        handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          try {
            this.finish(
              await this.api.verifyPayment({
                paymentId: co.paymentId,
                razorpayOrderId: r.razorpay_order_id,
                razorpayPaymentId: r.razorpay_payment_id,
                razorpaySignature: r.razorpay_signature,
              }),
            );
          } catch (e) {
            this.error.set(apiError(e));
          }
          resolve();
        },
        modal: { ondismiss: () => resolve() },
      });
      rzp.on('payment.failed', () => this.error.set('Payment failed. You can try again.'));
      rzp.open();
    });
  }

  private finish(s: SessionDto) {
    this.s.set(s);
    const qr = this.tableQr();
    if (qr) this.cart.rememberSession(qr, null);
  }
}
