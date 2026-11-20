import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import type { CategoryDto, MenuItemDto } from '@barit/shared';
import { AdminApi, apiError, type ItemInput } from '../core/api.service';

export interface ItemDialogData {
  item: MenuItemDto | null;
  categoryId: string;
  categories: CategoryDto[];
}

@Component({
  selector: 'ba-item-dialog',
  imports: [
    ReactiveFormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatSlideToggleModule, MatIconModule, MatProgressBarModule,
  ],
  templateUrl: './item-dialog.html',
  styleUrl: './item-dialog.scss',
})
export class ItemDialog {
  protected readonly data = inject<ItemDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<ItemDialog, MenuItemDto>);
  private readonly api = inject(AdminApi);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    name: [this.data.item?.name ?? '', [Validators.required, Validators.maxLength(80)]],
    description: [this.data.item?.description ?? ''],
    categoryId: [this.data.item?.categoryId ?? this.data.categoryId, Validators.required],
    imageUrl: this.fb.control<string | null>(this.data.item?.imageUrl ?? null),
    isVeg: [this.data.item?.isVeg ?? false],
    isSpecial: [this.data.item?.isSpecial ?? false],
    isAvailable: [this.data.item?.isAvailable ?? true],
    portions: this.fb.array(
      (this.data.item?.portions.length ? this.data.item.portions : [{ id: undefined, label: 'Regular', pricePaise: 0 }]).map((p) =>
        this.portionGroup(p.id, p.label, p.pricePaise / 100),
      ),
    ),
  });

  protected get portions() {
    return this.form.controls.portions as FormArray;
  }

  private portionGroup(id: string | undefined, label: string, rupees: number | null) {
    return this.fb.group({
      id: this.fb.control<string | undefined>(id),
      label: [label, [Validators.required, Validators.maxLength(30)]],
      rupees: this.fb.control<number | null>(rupees, [Validators.required, Validators.min(0)]),
    });
  }

  protected addPortion() {
    this.portions.push(this.portionGroup(undefined, '', null));
  }

  protected removePortion(i: number) {
    this.portions.removeAt(i);
  }

  protected async onFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0];
    input.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      this.error.set('Image is larger than 5 MB');
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const { url } = await this.api.upload(f);
      this.form.patchValue({ imageUrl: url });
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async save() {
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const body: ItemInput = {
      categoryId: v.categoryId,
      name: v.name.trim(),
      description: v.description.trim() || null,
      imageUrl: v.imageUrl,
      isVeg: v.isVeg,
      isSpecial: v.isSpecial,
      isAvailable: v.isAvailable,
      portions: (v.portions as Array<{ id?: string; label: string; rupees: number }>).map((p) => ({
        ...(p.id ? { id: p.id } : {}),
        label: p.label.trim(),
        pricePaise: Math.round(Number(p.rupees) * 100),
      })),
    };
    this.busy.set(true);
    this.error.set(null);
    try {
      const saved = this.data.item ? await this.api.updateItem(this.data.item.id, body) : await this.api.createItem(body);
      this.ref.close(saved);
    } catch (e) {
      this.error.set(apiError(e));
    } finally {
      this.busy.set(false);
    }
  }
}
