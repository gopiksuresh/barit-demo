import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { InrPipe } from './inr.pipe';
import { Icon } from './icon';

/**
 * Floating "n items · ₹x | View cart →" bar pinned above the bottom safe area.
 * The parent controls visibility (and its spring enter/leave); the count bounces on change.
 */
@Component({
  selector: 'bg-cart-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, InrPipe, Icon],
  templateUrl: './cart-bar.html',
  styleUrl: './cart-bar.scss',
})
export class CartBar {
  readonly count = input.required<number>();
  readonly subtotalPaise = input.required<number>();

  protected readonly bump = signal<0 | 1 | null>(null);
  private last = -1;

  constructor() {
    effect(() => {
      const n = this.count();
      if (this.last !== -1 && n !== this.last) this.bump.update((b) => (b === 0 ? 1 : 0));
      this.last = n;
    });
  }
}
