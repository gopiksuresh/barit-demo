import type { CategoryDto, MenuItemDto, OrderDto, VenueDto } from '@barit/shared';
import type { Prisma, Venue } from '../generated/prisma/client';

export function toVenueDto(v: Venue, distanceKm?: number): VenueDto {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    type: v.type,
    address: v.address,
    lat: v.lat,
    lng: v.lng,
    isOpen: v.isOpen,
    ...(distanceKm !== undefined ? { distanceKm: Math.round(distanceKm * 10) / 10 } : {}),
  };
}

export const itemInclude = {
  portions: { where: { archived: false }, orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.MenuItemInclude;

type ItemWithPortions = Prisma.MenuItemGetPayload<{ include: typeof itemInclude }>;

export function toItemDto(i: ItemWithPortions): MenuItemDto {
  return {
    id: i.id,
    categoryId: i.categoryId,
    name: i.name,
    description: i.description,
    imageUrl: i.imageUrl,
    isVeg: i.isVeg,
    isSpecial: i.isSpecial,
    isAvailable: i.isAvailable,
    sortOrder: i.sortOrder,
    portions: i.portions.map((p) => ({ id: p.id, label: p.label, pricePaise: p.pricePaise })),
  };
}

type CategoryWithItems = Prisma.CategoryGetPayload<{
  include: { items: { include: typeof itemInclude } };
}>;

export function toCategoryDto(c: CategoryWithItems): CategoryDto {
  return {
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    gstRatePct: Number(c.gstRatePct),
    items: c.items.map(toItemDto),
  };
}

export const orderInclude = {
  items: true,
  guest: true,
  session: { include: { table: true } },
} satisfies Prisma.OrderInclude;

type OrderFull = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export function toOrderDto(o: OrderFull): OrderDto {
  return {
    id: o.id,
    sessionId: o.sessionId,
    tableNumber: o.session.table.number,
    guestName: o.guest.name,
    guestPhone: o.guest.phone,
    status: o.status,
    notes: o.notes,
    placedAt: o.placedAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      itemName: it.itemName,
      portionLabel: it.portionLabel,
      qty: it.qty,
      unitPricePaise: it.unitPricePaise,
      notes: it.notes,
    })),
  };
}
