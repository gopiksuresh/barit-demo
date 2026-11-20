import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  OnInit,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CategoryDto, MenuItemDto, PortionDto, TableContextDto, VenueMenuDto } from '@barit/shared';
import { ApiService, apiError } from '../core/api.service';
import { CartStore } from '../core/cart.store';
import { Icon } from '../shared/icon';
import { ItemSheet, type ItemSheetResult } from '../shared/item-sheet';
import { MenuItemRow } from '../shared/menu-item-row';
import { CartBar } from '../shared/cart-bar';
import { SpecialCard } from '../shared/special-card';
import { VenueHero } from '../shared/venue-hero';

interface Section {
  id: string;
  name: string;
}

const SPECIALS = 'specials';

/**
 * Live menu. Two modes:
 *  - /v/:slug          browse only (no table → no ordering)
 *  - /table/:qrToken   ordering mode — reached by scanning the table QR
 */
@Component({
  selector: 'bg-menu-page',
  imports: [RouterLink, Icon, ItemSheet, MenuItemRow, CartBar, SpecialCard, VenueHero],
  templateUrl: './menu.page.html',
  styleUrl: './menu.page.scss',
})
export class MenuPage implements OnInit {
  private readonly api = inject(ApiService);
  protected readonly cart = inject(CartStore);

  /** Route params (bound via withComponentInputBinding). */
  readonly slug = input<string>();
  readonly qrToken = input<string>();

  protected readonly menu = signal<VenueMenuDto | null>(null);
  protected readonly table = signal<TableContextDto | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly mySessionId = signal<string | null>(null);

  // UI state
  protected readonly sheetItem = signal<MenuItemDto | null>(null);
  protected readonly compact = signal(false);
  protected readonly activeSection = signal<string>('');
  protected readonly query = signal('');
  protected readonly vegOnly = signal(false);
  protected readonly specialsOnly = signal(false);

  private readonly heroSentinel = viewChild<ElementRef<HTMLElement>>('heroSentinel');
  private readonly compactBar = viewChild<ElementRef<HTMLElement>>('compactBar');
  private readonly chipBar = viewChild<ElementRef<HTMLElement>>('chipBar');
  private readonly chipRow = viewChild<ElementRef<HTMLElement>>('chipRow');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('search');
  private readonly sectionEls = viewChildren<ElementRef<HTMLElement>>('spy');

  private spyPausedUntil = 0;
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly ordering = computed(() => !!this.table() && !!this.menu()?.venue.isOpen);
  private readonly allItems = computed(() => (this.menu()?.categories ?? []).flatMap((c) => c.items));
  private readonly gstByItem = computed(() => {
    const m = new Map<string, number>();
    for (const c of this.menu()?.categories ?? []) for (const it of c.items) m.set(it.id, c.gstRatePct);
    return m;
  });

  protected readonly specials = computed(() =>
    this.allItems().filter((i) => i.isSpecial && (!this.vegOnly() || i.isVeg)),
  );
  /** Hero photo: the first special (else any dish) that has one. */
  protected readonly heroImage = computed(() => {
    const items = this.allItems();
    return (items.find((i) => i.isSpecial && i.imageUrl) ?? items.find((i) => i.imageUrl))?.imageUrl ?? null;
  });

  protected readonly filtering = computed(() => !!this.query().trim() || this.vegOnly() || this.specialsOnly());
  protected readonly filtered = computed<CategoryDto[]>(() => {
    const q = this.query().trim().toLowerCase();
    return (this.menu()?.categories ?? [])
      .map((c) => ({
        ...c,
        items: c.items.filter(
          (i) =>
            (!this.vegOnly() || i.isVeg) &&
            (!this.specialsOnly() || i.isSpecial) &&
            (!q || i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)),
        ),
      }))
      .filter((c) => c.items.length > 0);
  });
  protected readonly showSpecials = computed(() => !this.query().trim() && !this.specialsOnly() && this.specials().length > 0);
  protected readonly sections = computed<Section[]>(() => [
    ...(this.showSpecials() ? [{ id: SPECIALS, name: 'Specials' }] : []),
    ...this.filtered().map((c) => ({ id: c.id, name: c.name })),
  ]);

  constructor() {
    // Collapse the hero into the glass bar once it scrolls under it.
    effect((onCleanup) => {
      const s = this.heroSentinel()?.nativeElement;
      if (!s) return;
      const io = new IntersectionObserver(([e]) => this.compact.set(!e.isIntersecting), {
        rootMargin: `-${this.barHeight()}px 0px 0px 0px`,
      });
      io.observe(s);
      onCleanup(() => io.disconnect());
    });

    // Scroll-spy: highlight the chip of the first section inside the reading band.
    effect((onCleanup) => {
      const els = this.sectionEls();
      if (!els.length) return;
      const visible = new Set<string>();
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const id = (e.target as HTMLElement).dataset['spy']!;
            if (e.isIntersecting) visible.add(id);
            else visible.delete(id);
          }
          if (performance.now() < this.spyPausedUntil) return;
          const first = this.sections().find((s) => visible.has(s.id));
          if (first) this.setActive(first.id);
        },
        { rootMargin: `-${this.stickyOffset()}px 0px -55% 0px` },
      );
      els.forEach((el) => io.observe(el.nativeElement));
      if (!this.activeSection() || !this.sections().some((s) => s.id === this.activeSection())) {
        this.activeSection.set(this.sections()[0]?.id ?? '');
      }
      onCleanup(() => io.disconnect());
    });
  }

  async ngOnInit() {
    try {
      let slug = this.slug();
      const qr = this.qrToken();
      if (qr) {
        const ctx = await this.api.table(qr);
        this.table.set(ctx);
        this.cart.bindTable(ctx);
        slug = ctx.venue.slug;
        // Only offer "view bill" if the guest's remembered session is still the open one.
        const mine = this.cart.sessionFor(qr);
        if (mine && mine === ctx.openSessionId) this.mySessionId.set(mine);
        else if (mine) this.cart.rememberSession(qr, null);
      }
      if (!slug) throw new Error('Venue not found');
      this.menu.set(await this.api.menu(slug));
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.loading.set(false);
    }
  }

  // ── helpers used by the template ─────────────────────────────────────────
  protected qtyOf(it: MenuItemDto) {
    return this.cart.qtyOfAny(it.portions.map((p) => p.id));
  }
  protected onSearch(ev: Event) {
    this.query.set((ev.target as HTMLInputElement).value);
  }
  protected clearSearch() {
    this.query.set('');
    this.searchInput()?.nativeElement.focus();
  }

  // ── cart actions ─────────────────────────────────────────────────────────
  /** Single-portion dishes add directly; dishes with options open the sheet. */
  protected quickAdd(it: MenuItemDto) {
    if (it.portions.length === 1) this.addPortion(it, it.portions[0]!);
    else this.sheetItem.set(it);
  }

  protected decrement(it: MenuItemDto) {
    const p = it.portions[0]!;
    this.cart.setQty(p.id, this.cart.qtyOf(p.id) - 1);
  }

  protected addFromSheet(it: MenuItemDto, r: ItemSheetResult) {
    this.addPortion(it, r.portion, r.qty, r.notes);
  }

  private addPortion(it: MenuItemDto, p: PortionDto, qty = 1, notes?: string) {
    this.cart.add(
      {
        portionId: p.id,
        itemName: it.name,
        portionLabel: p.label,
        pricePaise: p.pricePaise,
        isVeg: it.isVeg,
        gstRatePct: this.gstByItem().get(it.id),
        imageUrl: it.imageUrl,
        ...(notes ? { notes } : {}),
      },
      qty,
    );
  }

  // ── navigation: chips, search, sticky offsets ────────────────────────────
  private barHeight() {
    return this.compactBar()?.nativeElement.offsetHeight ?? 56;
  }
  private stickyOffset() {
    return this.barHeight() + (this.chipBar()?.nativeElement.offsetHeight ?? 0);
  }

  protected jump(id: string) {
    const el = document.getElementById('sec-' + id);
    if (!el) return;
    this.setActive(id);
    this.spyPausedUntil = performance.now() + 900; // don't let the spy flicker mid-scroll
    const top = el.getBoundingClientRect().top + window.scrollY - this.stickyOffset() + 1;
    window.scrollTo({ top, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  private setActive(id: string) {
    if (this.activeSection() === id) return;
    this.activeSection.set(id);
    const row = this.chipRow()?.nativeElement;
    const chip = row?.querySelector<HTMLElement>(`[data-chip="${CSS.escape(id)}"]`);
    if (row && chip) {
      row.scrollTo({
        left: chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2,
        behavior: this.reducedMotion ? 'auto' : 'smooth',
      });
    }
  }

  protected focusSearch() {
    const input = this.searchInput()?.nativeElement;
    if (!input) return;
    const top = input.getBoundingClientRect().top + window.scrollY - this.barHeight() - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: this.reducedMotion ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
  }
}
