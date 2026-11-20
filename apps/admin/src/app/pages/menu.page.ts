import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { CategoryDto, MenuItemDto } from '@barit/shared';
import { AdminApi, apiError } from '../core/api.service';
import { StaffStore } from '../core/staff.store';
import { InrPipe } from '../shared/inr.pipe';
import { ItemDialog, type ItemDialogData } from './item-dialog';

@Component({
  selector: 'ba-menu-page',
  imports: [
    FormsModule, DragDropModule, MatButtonModule, MatIconModule, MatExpansionModule, MatSlideToggleModule,
    MatFormFieldModule, MatInputModule, MatChipsModule, MatTooltipModule, MatProgressBarModule, InrPipe,
  ],
  templateUrl: './menu.page.html',
  styleUrl: './menu.page.scss',
})
export class MenuPage implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  protected readonly staff = inject(StaffStore);

  protected readonly cats = signal<CategoryDto[]>([]);
  protected readonly loading = signal(true);
  protected readonly showNewCat = signal(false);
  protected newCatName = '';
  protected newCatGst = 5;

  async ngOnInit() {
    await this.reload();
  }

  private async reload() {
    this.loading.set(true);
    try {
      this.cats.set(await this.api.menu());
    } catch (e) {
      this.toast(apiError(e));
    } finally {
      this.loading.set(false);
    }
  }

  private toast(msg: string) {
    this.snack.open(msg, 'OK', { duration: 3500 });
  }

  protected async addCategory() {
    try {
      const c = await this.api.createCategory({ name: this.newCatName.trim(), gstRatePct: Number(this.newCatGst) || 0 });
      this.cats.update((cs) => [...cs, c]);
      this.newCatName = '';
      this.showNewCat.set(false);
    } catch (e) {
      this.toast(apiError(e));
    }
  }

  protected async renameCategory(c: CategoryDto) {
    // Small inline prompt via the dialog-free approach: reuse the new-category form values.
    const name = window.prompt('Category name', c.name)?.trim();
    if (!name) return;
    const gstRaw = window.prompt('GST % for this category', String(c.gstRatePct));
    const gst = gstRaw === null ? c.gstRatePct : Number(gstRaw);
    if (!Number.isFinite(gst) || gst < 0 || gst > 28) return this.toast('GST must be between 0 and 28');
    try {
      const updated = await this.api.updateCategory(c.id, { name, gstRatePct: gst });
      this.cats.update((cs) => cs.map((x) => (x.id === c.id ? updated : x)));
    } catch (e) {
      this.toast(apiError(e));
    }
  }

  protected async removeCategory(c: CategoryDto) {
    if (!window.confirm(`Delete category “${c.name}”?`)) return;
    try {
      await this.api.deleteCategory(c.id);
      this.cats.update((cs) => cs.filter((x) => x.id !== c.id));
    } catch (e) {
      this.toast(apiError(e));
    }
  }

  protected async drop(ev: CdkDragDrop<CategoryDto[]>) {
    if (ev.previousIndex === ev.currentIndex) return;
    const next = [...this.cats()];
    moveItemInArray(next, ev.previousIndex, ev.currentIndex);
    const prev = this.cats();
    this.cats.set(next);
    try {
      await this.api.reorderCategories(next.map((c) => c.id));
    } catch (e) {
      this.cats.set(prev);
      this.toast(apiError(e));
    }
  }

  protected editItem(c: CategoryDto, item: MenuItemDto | null) {
    const ref = this.dialog.open<ItemDialog, ItemDialogData, MenuItemDto>(ItemDialog, {
      data: { item, categoryId: c.id, categories: this.cats() },
      width: '680px',
      maxWidth: '96vw',
      autoFocus: 'first-tabbable',
    });
    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        this.snack.open(`Saved “${saved.name}”`, undefined, { duration: 2000 });
        void this.reload();
      }
    });
  }

  protected async quick(it: MenuItemDto, patch: Partial<Pick<MenuItemDto, 'isSpecial' | 'isAvailable'>>) {
    try {
      const updated = await this.api.updateItem(it.id, patch);
      this.cats.update((cs) => cs.map((c) => ({ ...c, items: c.items.map((x) => (x.id === it.id ? updated : x)) })));
    } catch (e) {
      this.toast(apiError(e));
      void this.reload();
    }
  }

  protected async removeItem(c: CategoryDto, it: MenuItemDto) {
    if (!window.confirm(`Remove “${it.name}” from the menu?`)) return;
    try {
      await this.api.deleteItem(it.id);
      this.cats.update((cs) => cs.map((x) => (x.id === c.id ? { ...x, items: x.items.filter((i) => i.id !== it.id) } : x)));
    } catch (e) {
      this.toast(apiError(e));
    }
  }
}
