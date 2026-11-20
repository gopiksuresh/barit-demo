import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  SIMULATED_LOCATION,
  type CheckoutResponse,
  type OrderDto,
  type PlaceOrderRequest,
  type SessionDto,
  type TableContextDto,
  type VenueDto,
  type VenueMenuDto,
  type VerifyPaymentRequest,
} from '@barit/shared';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBase;

  venues() {
    const { lat, lng } = SIMULATED_LOCATION;
    return firstValueFrom(this.http.get<VenueDto[]>(`${this.base}/venues`, { params: { lat, lng } }));
  }

  menu(slug: string) {
    return firstValueFrom(this.http.get<VenueMenuDto>(`${this.base}/venues/${encodeURIComponent(slug)}/menu`));
  }

  table(qrToken: string) {
    return firstValueFrom(this.http.get<TableContextDto>(`${this.base}/tables/${encodeURIComponent(qrToken)}`));
  }

  placeOrder(qrToken: string, body: PlaceOrderRequest) {
    return firstValueFrom(
      this.http.post<{ sessionId: string; order: OrderDto }>(`${this.base}/tables/${encodeURIComponent(qrToken)}/orders`, body),
    );
  }

  session(id: string) {
    return firstValueFrom(this.http.get<SessionDto>(`${this.base}/sessions/${id}`));
  }

  checkout(id: string, tipPaise: number) {
    return firstValueFrom(this.http.post<CheckoutResponse>(`${this.base}/sessions/${id}/checkout`, { tipPaise }));
  }

  verifyPayment(body: VerifyPaymentRequest) {
    return firstValueFrom(this.http.post<SessionDto>(`${this.base}/payments/verify`, body));
  }
}

/** Human-readable message from an API error. */
export function apiError(e: unknown): string {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return 'Can’t reach the server. Check your connection.';
    const msg = e.error?.message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
    return `Request failed (${e.status})`;
  }
  return (e as Error)?.message ?? 'Something went wrong';
}
