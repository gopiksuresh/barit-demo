import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { MenuItemDto, PortionDto } from '@barit/shared';
import { InrPipe } from './inr.pipe';
import { VegMark } from './veg-mark';
import { Icon } from './icon';
import { DishImage } from './dish-image';
import { tick } from './qty-stepper';

export interface ItemSheetResult {
  portion: PortionDto;
  qty: number;
  notes?: string;
}

const DISMISS_PX = 110;
const DISMISS_VELOCITY = 0.6; // px per ms
const LEAVE_MS = 200;

/**
 * Item detail bottom sheet: photo, description, portion choice, special instructions,
 * quantity and a live-priced "Add item" button. Swipe the handle/photo down, tap the
 * scrim or press Escape to dismiss. Plays its own exit animation before emitting `closed`.
 */
@Component({
  selector: 'bg-item-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, InrPipe, VegMark, Icon, DishImage],
  templateUrl: './item-sheet.html',
  styleUrl: './item-sheet.scss',
  host: { '(document:keydown.escape)': 'close()' },
})
export class ItemSheet implements OnDestroy {
  readonly item = input.required<MenuItemDto>();
  /** False in browse-only mode (no table) — the sheet is informational. */
  readonly canOrder = input(false);
  readonly closeHint = input('Scan the QR code on your table to order.');

  readonly add = output<ItemSheetResult>();
  readonly closed = output<void>();

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');

  protected readonly selectedId = signal<string | null>(null);
  protected readonly qty = signal(1);
  protected notes = '';
  protected readonly closing = signal(false);
  protected readonly dragY = signal(0);
  protected readonly dragging = signal(false);

  protected readonly selected = computed<PortionDto | undefined>(
    () => this.item().portions.find((p) => p.id === this.selectedId()) ?? this.item().portions.at(0),
  );
  protected readonly totalPaise = computed(() => (this.selected()?.pricePaise ?? 0) * this.qty());
  protected readonly titleId = `sheet-title-${Math.random().toString(36).slice(2, 8)}`;

  private readonly returnFocus = document.activeElement as HTMLElement | null;
  private startY = 0;
  private startT = 0;

  constructor() {
    afterNextRender(() => this.panel().nativeElement.focus({ preventScroll: true }));
  }

  ngOnDestroy() {
    this.returnFocus?.focus?.({ preventScroll: true });
  }

  protected setQty(q: number) {
    tick();
    this.qty.set(Math.min(50, Math.max(1, q)));
  }

  protected confirm() {
    const portion = this.selected();
    if (!portion) return;
    tick();
    this.add.emit({ portion, qty: this.qty(), notes: this.notes.trim() || undefined });
    this.close();
  }

  close() {
    if (this.closing()) return;
    this.closing.set(true);
    setTimeout(() => this.closed.emit(), LEAVE_MS);
  }

  // ── drag to dismiss ────────────────────────────────────────────────────
  protected onDown(e: PointerEvent) {
    if (e.button !== 0 || this.body().nativeElement.scrollTop > 0) return;
    this.dragging.set(true);
    this.startY = e.clientY;
    this.startT = performance.now();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  protected onMove(e: PointerEvent) {
    if (!this.dragging()) return;
    this.dragY.set(Math.max(0, e.clientY - this.startY));
  }

  protected onUp() {
    if (!this.dragging()) return;
    this.dragging.set(false);
    const dy = this.dragY();
    const velocity = dy / Math.max(1, performance.now() - this.startT);
    if (dy > DISMISS_PX || (dy > 24 && velocity > DISMISS_VELOCITY)) this.close();
    else this.dragY.set(0);
  }
}
