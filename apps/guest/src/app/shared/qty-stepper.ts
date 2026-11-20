import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { Icon } from './icon';

/** Haptic-style tick on devices that support it (Android); silently ignored elsewhere. */
export function tick() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* not allowed — ignore */
  }
}

/**
 * "ADD" button that morphs in place into a − n + stepper once qty > 0.
 * The count does a quick bounce whenever it changes.
 */
@Component({
  selector: 'bg-qty-stepper',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icon],
  templateUrl: './qty-stepper.html',
  styleUrl: './qty-stepper.scss',
  host: { '[class.compact]': 'variant() === "compact"', '[class.round]': 'variant() === "round"' },
})
export class QtyStepper {
  readonly qty = input(0);
  readonly label = input('Add');
  /** Accessible name of the dish, e.g. "Beef Fry". */
  readonly itemName = input('');
  /** "row" (default, overlaps a thumbnail), "round" (circular + on cards), "compact" (cart lines). */
  readonly variant = input<'row' | 'round' | 'compact'>('row');
  /** Show a "+" hint that tapping opens options instead of adding directly. */
  readonly hasOptions = input(false);

  readonly increment = output<void>();
  readonly decrement = output<void>();

  /** Alternates to retrigger the bounce animation on every change. */
  protected readonly bump = signal<0 | 1 | null>(null);
  private last = -1;

  constructor() {
    effect(() => {
      const q = this.qty();
      if (this.last !== -1 && q !== this.last) this.bump.update((b) => (b === 0 ? 1 : 0));
      this.last = q;
    });
  }

  protected inc(ev: Event) {
    ev.stopPropagation();
    tick();
    this.increment.emit();
  }

  protected dec(ev: Event) {
    ev.stopPropagation();
    tick();
    this.decrement.emit();
  }
}
