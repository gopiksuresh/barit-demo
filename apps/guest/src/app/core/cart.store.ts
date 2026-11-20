import { computed, effect, Injectable, signal } from '@angular/core';
import type { TableContextDto } from '@barit/shared';

export interface CartLine {
  portionId: string;
  itemName: string;
  portionLabel: string;
  pricePaise: number;
  isVeg: boolean;
  qty: number;
  /** Optional per-dish instructions — sent as the order item's `notes` (existing API field). */
  notes?: string;
  /** Category GST rate, for the estimated-tax line in the cart. Older saved carts may lack it. */
  gstRatePct?: number;
  imageUrl?: string | null;
}

export type NewCartLine = Omit<CartLine, 'qty'>;

interface Persisted {
  table: TableContextDto;
  lines: CartLine[];
}

const KEY = 'barit.cart';
const SESSION_KEY = (qr: string) => `barit.session.${qr}`;
const MAX_QTY = 50;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode) — cart just won't survive a reload */
  }
}

/** Cart for the current table. Persisted so a reload or login redirect keeps it. */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly saved = read<Persisted>(KEY);

  readonly table = signal<TableContextDto | null>(this.saved?.table ?? null);
  readonly lines = signal<CartLine[]>(this.saved?.lines ?? []);

  readonly count = computed(() => this.lines().reduce((n, l) => n + l.qty, 0));
  readonly subtotalPaise = computed(() => this.lines().reduce((s, l) => s + l.qty * l.pricePaise, 0));
  /** GST estimate (same per-line rounding as the server); null if any line's rate is unknown. */
  readonly estTaxPaise = computed<number | null>(() => {
    let tax = 0;
    for (const l of this.lines()) {
      if (l.gstRatePct == null) return null;
      tax += Math.round((l.qty * l.pricePaise * l.gstRatePct) / 100);
    }
    return tax;
  });

  constructor() {
    effect(() => {
      const table = this.table();
      write(KEY, table ? { table, lines: this.lines() } : null);
    });
  }

  /** Switch to a table; the cart is kept only if it's the same table. */
  bindTable(ctx: TableContextDto) {
    if (this.table()?.table.qrToken !== ctx.table.qrToken) this.lines.set([]);
    this.table.set(ctx);
  }

  qtyOf(portionId: string): number {
    return this.lines().find((l) => l.portionId === portionId)?.qty ?? 0;
  }

  /** Total quantity across all portions of a set (e.g. every portion of one dish). */
  qtyOfAny(portionIds: string[]): number {
    return this.lines()
      .filter((l) => portionIds.includes(l.portionId))
      .reduce((n, l) => n + l.qty, 0);
  }

  add(line: NewCartLine, qty = 1) {
    const existing = this.lines().find((l) => l.portionId === line.portionId);
    if (existing) {
      this.lines.update((ls) =>
        ls.map((l) =>
          l.portionId === line.portionId
            ? { ...l, ...line, qty: Math.min(l.qty + qty, MAX_QTY), notes: line.notes ?? l.notes }
            : l,
        ),
      );
    } else {
      this.lines.update((ls) => [...ls, { ...line, qty: Math.min(qty, MAX_QTY) }]);
    }
  }

  setQty(portionId: string, qty: number) {
    if (qty <= 0) this.remove(portionId);
    else this.lines.update((ls) => ls.map((l) => (l.portionId === portionId ? { ...l, qty: Math.min(qty, MAX_QTY) } : l)));
  }

  remove(portionId: string) {
    this.lines.update((ls) => ls.filter((l) => l.portionId !== portionId));
  }

  clear() {
    this.lines.set([]);
  }

  /** The guest's own session at a table (set after their first order). */
  sessionFor(qrToken: string): string | null {
    return read<string>(SESSION_KEY(qrToken));
  }
  rememberSession(qrToken: string, sessionId: string | null) {
    write(SESSION_KEY(qrToken), sessionId);
  }
}
