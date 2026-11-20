import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Tiny inline SVG icon set (1.75px strokes, currentColor) — no icon font or library. */
const PATHS = {
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.35-4.35',
  table: 'M3 9h18M5 9v10M19 9v10M7 9l1.5-4h7L17 9M9 14h6',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6M9 16h3',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6 6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7',
  chevron: 'M9 6l6 6-6 6',
  star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9L12 3.5Z',
  leaf: 'M5 19c0-8 5-14 14-14 0 9-6 14-14 14Zm0 0 7-7',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  pin: 'M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z',
  bag: 'M5 8h14l-1 12H6L5 8Zm4 0V6a3 3 0 0 1 6 0v2',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z',
} as const;

export type IconName = keyof typeof PATHS;

@Component({
  selector: 'bg-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  templateUrl: './icon.html',
  styleUrl: './icon.scss',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(20);
  readonly stroke = input(1.75);
  readonly filled = input(false);
  protected readonly d = computed(() => PATHS[this.name()]);
}
