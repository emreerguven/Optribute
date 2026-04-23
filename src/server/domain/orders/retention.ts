import type { Order } from "@/src/server/domain/types";

export const OPERATIONAL_ORDER_STATUSES = [
  "pending",
  "confirmed",
  "preparing",
  "delivering"
] as const;

export const ARCHIVE_READY_ORDER_STATUSES = ["completed", "cancelled"] as const;

// This helper keeps archive/retention rules centralized so future retention jobs
// can distinguish active dispatch records from older closed orders.
export function isOperationalOrder(order: Pick<Order, "status">) {
  return OPERATIONAL_ORDER_STATUSES.includes(
    order.status as (typeof OPERATIONAL_ORDER_STATUSES)[number]
  );
}

export function isArchiveReadyOrder(order: Pick<Order, "status">) {
  return ARCHIVE_READY_ORDER_STATUSES.includes(
    order.status as (typeof ARCHIVE_READY_ORDER_STATUSES)[number]
  );
}

export function getOperationalOrders<T extends Pick<Order, "status">>(orders: T[]) {
  return orders.filter((order) => isOperationalOrder(order));
}
