import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { Icon } from './icon';
import { tick } from './qty-stepper';

const REMOVE_AT = 96; // px
const MAX_DRAG = 160;

/**
 * Swipe-left-to-remove row. Horizontal drags reveal a "Remove" action; releasing past
 * the threshold slides the row out and emits `removed`. Vertical scrolling is untouched
 * (touch-action: pan-y). Keyboard / screen-reader users remove via the quantity stepper.
 */
@Component({
  selector: 'bg-swipe-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './swipe-row.html',
  styleUrl: './swipe-row.scss',
  host: { '[class.leaving]': 'leaving()' },
})
export class SwipeRow {
  readonly label = input('Remove');
  readonly removed = output<void>();

  protected readonly dx = signal(0);
  protected readonly dragging = signal(false);
  protected readonly leaving = signal(false);

  private startX = 0;
  private startY = 0;
  private decided: 'x' | 'y' | null = null;

  protected onDown(e: PointerEvent) {
    if (e.button !== 0 || this.leaving()) return;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.decided = null;
  }

  protected onMove(e: PointerEvent) {
    if (this.leaving() || (e.buttons === 0 && e.pointerType === 'mouse')) return;
    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;
    if (!this.decided) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      this.decided = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (this.decided === 'x') {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        this.dragging.set(true);
      }
    }
    if (this.decided === 'x') this.dx.set(Math.max(-MAX_DRAG, Math.min(0, dx)));
  }

  protected onUp() {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (this.dx() <= -REMOVE_AT) this.remove();
    else this.dx.set(0);
  }

  protected remove() {
    tick();
    this.leaving.set(true);
    setTimeout(() => this.removed.emit(), 220);
  }
}
