import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { CategoryDto, LiveSessionDto, MenuItemDto, OrderDto, OrderStatus, StaffMeDto, VenueDto } from '@barit/shared';
import { environment } from '../../environments/environment';

export interface AdminTable {
  id: string;
  number: number;
  seats: number;
  qrToken: string;
  url: string;
  occupied: boolean;
  sessionId: string | null;
}

export interface ItemInput {
  categoryId: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  isVeg?: boolean;
  isSpecial?: boolean;
  isAvailable?: boolean;
  portions?: Array<{ id?: string; label: string; pricePaise: number }>;
}

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);
  private readonly b = environment.apiBase;

  me = () => firstValueFrom(this.http.get<StaffMeDto>(`${this.b}/admin/me`));
  setVenueOpen = (isOpen: boolean) => firstValueFrom(this.http.patch<VenueDto>(`${this.b}/admin/venue`, { isOpen }));

  // menu
  menu = () => firstValueFrom(this.http.get<CategoryDto[]>(`${this.b}/admin/menu`));
  createCategory = (body: { name: string; gstRatePct: number }) =>
    firstValueFrom(this.http.post<CategoryDto>(`${this.b}/admin/categories`, body));
  updateCategory = (id: string, body: Partial<{ name: string; gstRatePct: number }>) =>
    firstValueFrom(this.http.patch<CategoryDto>(`${this.b}/admin/categories/${id}`, body));
  deleteCategory = (id: string) => firstValueFrom(this.http.delete<void>(`${this.b}/admin/categories/${id}`));
  reorderCategories = (ids: string[]) => firstValueFrom(this.http.post<void>(`${this.b}/admin/categories/reorder`, { ids }));
  createItem = (body: ItemInput) => firstValueFrom(this.http.post<MenuItemDto>(`${this.b}/admin/items`, body));
  updateItem = (id: string, body: Partial<ItemInput>) => firstValueFrom(this.http.patch<MenuItemDto>(`${this.b}/admin/items/${id}`, body));
  deleteItem = (id: string) => firstValueFrom(this.http.delete<void>(`${this.b}/admin/items/${id}`));
  upload = (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return firstValueFrom(this.http.post<{ url: string }>(`${this.b}/admin/uploads`, fd));
  };

  // tables
  tables = () => firstValueFrom(this.http.get<AdminTable[]>(`${this.b}/admin/tables`));
  createTable = (number: number, seats: number) => firstValueFrom(this.http.post<AdminTable>(`${this.b}/admin/tables`, { number, seats }));
  deleteTable = (id: string) => firstValueFrom(this.http.delete<void>(`${this.b}/admin/tables/${id}`));
  rotateQr = (id: string) => firstValueFrom(this.http.post<AdminTable>(`${this.b}/admin/tables/${id}/rotate-qr`, {}));
  qr = (id: string) => firstValueFrom(this.http.get<{ tableNumber: number; url: string; dataUrl: string }>(`${this.b}/admin/tables/${id}/qr`));

  // orders / kds
  liveSessions = () => firstValueFrom(this.http.get<LiveSessionDto[]>(`${this.b}/admin/sessions/live`));
  markPaid = (id: string, method: 'CASH' | 'CARD', tipPaise = 0) =>
    firstValueFrom(this.http.post<LiveSessionDto>(`${this.b}/admin/sessions/${id}/mark-paid`, { method, tipPaise }));
  kdsOrders = () => firstValueFrom(this.http.get<OrderDto[]>(`${this.b}/kds/orders`));
  setOrderStatus = (id: string, status: OrderStatus) =>
    firstValueFrom(this.http.patch<OrderDto>(`${this.b}/kds/orders/${id}/status`, { status }));
}

export function apiError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Can’t reach the API — is it running on :3000?';
    const msg = e.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return `Request failed (${e.status})`;
  }
  return (e as Error)?.message ?? 'Something went wrong';
}
