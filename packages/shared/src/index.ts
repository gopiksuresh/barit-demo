// Types shared by api, guest and admin. Money is always integer paise.

export type VenueType = 'RESTAURANT' | 'BAR';
export type StaffRole = 'OWNER' | 'STAFF' | 'KITCHEN';
export type SessionStatus = 'OPEN' | 'PAYING' | 'CLOSED';
export type OrderStatus = 'ORDERED' | 'COOKING' | 'READY' | 'SERVED' | 'CANCELLED';
export type PaymentMethod = 'RAZORPAY' | 'CASH' | 'CARD';
export type PaymentStatus = 'CREATED' | 'PAID' | 'FAILED';

/** Allowed KDS transitions — the only forward path a ticket can take. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ORDERED: ['COOKING', 'CANCELLED'],
  COOKING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
  CANCELLED: [],
};

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ORDERED: 'Ordered',
  COOKING: 'Cooking',
  READY: 'Ready to Serve',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to);
}

/** Fixed "simulated location" for the demo — MG Road, Kochi. */
export const SIMULATED_LOCATION = { lat: 9.9658, lng: 76.2854, label: 'MG Road, Kochi' };

export function formatInr(paise: number): string {
  return '₹' + (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- DTO shapes ----------

export interface PortionDto { id: string; label: string; pricePaise: number; }

export interface MenuItemDto {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isVeg: boolean;
  isSpecial: boolean;
  isAvailable: boolean;
  sortOrder: number;
  portions: PortionDto[];
}

export interface CategoryDto {
  id: string;
  name: string;
  sortOrder: number;
  gstRatePct: number;
  items: MenuItemDto[];
}

export interface VenueDto {
  id: string;
  slug: string;
  name: string;
  type: VenueType;
  address: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  distanceKm?: number;
}

export interface VenueMenuDto { venue: VenueDto; categories: CategoryDto[]; }

export interface TableContextDto {
  venue: VenueDto;
  table: { id: string; number: number; seats: number; qrToken: string };
  openSessionId: string | null;
}

export interface PlaceOrderItem { portionId: string; qty: number; notes?: string; }
export interface PlaceOrderRequest { items: PlaceOrderItem[]; notes?: string; guestName?: string; }

export interface OrderItemDto {
  id: string;
  itemName: string;
  portionLabel: string;
  qty: number;
  unitPricePaise: number;
  notes: string | null;
}

export interface OrderDto {
  id: string;
  sessionId: string;
  tableNumber: number;
  guestName: string | null;
  guestPhone: string | null;
  status: OrderStatus;
  notes: string | null;
  placedAt: string;
  updatedAt: string;
  items: OrderItemDto[];
}

export interface BillLine {
  itemName: string;
  portionLabel: string;
  qty: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  gstRatePct: number;
  gstPaise: number;
}

export interface Bill {
  lines: BillLine[];
  subtotalPaise: number;
  gstPaise: number;
  /** CGST/SGST split shown on the bill (each half of gstPaise). */
  cgstPaise: number;
  sgstPaise: number;
  tipPaise: number;
  totalPaise: number;
}

export interface SessionDto {
  id: string;
  status: SessionStatus;
  venue: VenueDto;
  tableNumber: number;
  orders: OrderDto[];
  bill: Bill;
  payment: { status: PaymentStatus; method: PaymentMethod; totalPaise: number } | null;
}

export interface CheckoutResponse {
  paymentId: string;
  stub: boolean;
  amountPaise: number;
  currency: 'INR';
  razorpayOrderId: string;
  razorpayKeyId: string | null;
  bill: Bill;
}

export interface VerifyPaymentRequest {
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface StaffMeDto {
  id: string;
  phone: string;
  name: string | null;
  role: StaffRole;
  venue: VenueDto;
}

export interface LiveSessionDto {
  id: string;
  status: SessionStatus;
  tableNumber: number;
  openedAt: string;
  orders: OrderDto[];
  bill: Bill;
  payment: { status: PaymentStatus; method: PaymentMethod; totalPaise: number } | null;
}
