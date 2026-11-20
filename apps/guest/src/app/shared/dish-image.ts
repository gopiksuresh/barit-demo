import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * Food photo with a fixed aspect ratio (no layout shift), native lazy loading and a
 * blur-up reveal. Without a photo — or if it fails to load — shows the dish initials
 * in Fraunces on a warm amber→teak gradient.
 */
@Component({
  selector: 'bg-dish-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dish-image.html',
  styleUrl: './dish-image.scss',
  host: { '[style.aspect-ratio]': 'ratio()' },
})
export class DishImage {
  readonly src = input<string | null | undefined>(null);
  readonly name = input.required<string>();
  /** CSS aspect-ratio, e.g. "1" or "4 / 3". */
  readonly ratio = input('1');
  /** Eager-load images that are visible on first paint (e.g. the hero). */
  readonly eager = input(false);

  protected readonly loaded = signal(false);
  protected readonly failed = signal(false);
  protected readonly showImage = computed(() => !!this.src() && !this.failed());

  protected readonly initials = computed(() =>
    this.name()
      .replace(/\(.*?\)/g, '')
      .split(/[\s&,-]+/)
      .filter((w) => w.length > 1 || /[A-Z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join(''),
  );
}
