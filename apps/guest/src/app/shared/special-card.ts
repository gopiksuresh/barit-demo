import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { MenuItemDto } from '@barit/shared';
import { InrPipe } from './inr.pipe';
import { VegMark } from './veg-mark';
import { Icon } from './icon';
import { DishImage } from './dish-image';
import { QtyStepper } from './qty-stepper';

/** "Today's specials" carousel card: photo on top (with subtle parallax), round + to add. */
@Component({
  selector: 'bg-special-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InrPipe, VegMark, Icon, DishImage, QtyStepper],
  templateUrl: './special-card.html',
  styleUrl: './special-card.scss',
})
export class SpecialCard {
  readonly item = input.required<MenuItemDto>();
  readonly qty = input(0);
  readonly canOrder = input(false);

  readonly open = output<void>();
  readonly add = output<void>();
  readonly remove = output<void>();

  protected readonly hasOptions = computed(() => this.item().portions.length > 1);
  protected readonly minPrice = computed(() => Math.min(...this.item().portions.map((p) => p.pricePaise)));
}
