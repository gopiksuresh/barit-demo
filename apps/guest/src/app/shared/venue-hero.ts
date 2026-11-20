import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { VenueDto } from '@barit/shared';
import { Icon } from './icon';
import { DishImage } from './dish-image';

/**
 * Restaurant header: signature-dish photo (or lamplit gradient art) under a dark
 * gradient, venue name in Fraunces, address, open status and the glowing table pill.
 */
@Component({
  selector: 'bg-venue-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icon, DishImage],
  templateUrl: './venue-hero.html',
  styleUrl: './venue-hero.scss',
  host: { '[class.has-photo]': '!!image()' },
})
export class VenueHero {
  readonly venue = input.required<VenueDto>();
  readonly image = input<string | null>(null);
  readonly tableNumber = input<number | null>(null);
  /** The guest's open session at this table — enables "Request bill". */
  readonly sessionId = input<string | null>(null);
}
