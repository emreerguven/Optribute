import { listCouriersForCompany } from "@/src/server/domain/couriers/service";
import { listOrdersForCompany } from "@/src/server/domain/orders/service";
import type {
  Courier,
  DeliveryStatus,
  Order,
  PaymentMethod,
  PaymentStatus
} from "@/src/server/domain/types";

type ProductMovement = {
  name: string;
  quantity: number;
};

type PaymentDistributionRow<T extends string> = {
  key: T;
  count: number;
};

type CourierWorkload = {
  courier: Courier;
  activeOrdersCount: number;
  assignedCount: number;
  outForDeliveryCount: number;
};

export type DealerDashboardSnapshot = {
  todayDateLabel: string;
  todayOrdersCount: number;
  todayRevenueCents: number;
  unassignedOrdersCount: number;
  outForDeliveryOrdersCount: number;
  topProducts: ProductMovement[];
  paymentMethodDistribution: PaymentDistributionRow<PaymentMethod>[];
  paymentStatusDistribution: PaymentDistributionRow<PaymentStatus>[];
  courierWorkloads: CourierWorkload[];
  recentOrders: Order[];
};

function getOrderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

function getDateKey(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function formatTodayLabel(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone,
    day: "numeric",
    month: "long"
  }).format(date);
}

function toSortedDistribution<T extends string>(map: Map<T, number>) {
  return [...map.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key, "tr"));
}

function getPrimaryPayment(order: Order) {
  return order.payments[0] ?? null;
}

function countCourierStatuses(orders: Order[], courierId: string, status: DeliveryStatus) {
  return orders.filter((order) => order.courier?.id === courierId && order.deliveryStatus === status).length;
}

export async function getDealerDashboardSnapshot(
  companyId: string,
  options?: { timeZone?: string }
): Promise<DealerDashboardSnapshot> {
  const timeZone = options?.timeZone ?? "Europe/Istanbul";
  const [orders, couriers] = await Promise.all([
    listOrdersForCompany(companyId),
    listCouriersForCompany(companyId)
  ]);

  const now = new Date();
  const todayKey = getDateKey(now, timeZone);
  const todayOrders = orders.filter((order) => getDateKey(new Date(order.createdAt), timeZone) === todayKey);

  const todayRevenueCents = todayOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const unassignedOrdersCount = orders.filter((order) => order.deliveryStatus === "unassigned").length;
  const outForDeliveryOrdersCount = orders.filter(
    (order) => order.deliveryStatus === "out-for-delivery"
  ).length;

  const productQuantities = new Map<string, number>();

  for (const order of todayOrders) {
    for (const item of order.items) {
      const nextQuantity = (productQuantities.get(item.name) ?? 0) + item.quantity;
      productQuantities.set(item.name, nextQuantity);
    }
  }

  const topProducts = [...productQuantities.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name, "tr"))
    .slice(0, 6);

  const paymentMethodCounts = new Map<PaymentMethod, number>();
  const paymentStatusCounts = new Map<PaymentStatus, number>();

  for (const order of todayOrders) {
    const payment = getPrimaryPayment(order);

    if (!payment) {
      continue;
    }

    paymentMethodCounts.set(payment.method, (paymentMethodCounts.get(payment.method) ?? 0) + 1);
    paymentStatusCounts.set(payment.status, (paymentStatusCounts.get(payment.status) ?? 0) + 1);
  }

  const courierWorkloads = couriers
    .filter((courier) => courier.isActive)
    .map((courier) => {
      const assignedCount = countCourierStatuses(orders, courier.id, "assigned");
      const outForDeliveryCount = countCourierStatuses(orders, courier.id, "out-for-delivery");

      return {
        courier,
        assignedCount,
        outForDeliveryCount,
        activeOrdersCount: assignedCount + outForDeliveryCount
      };
    })
    .sort((left, right) => {
      return (
        right.activeOrdersCount - left.activeOrdersCount ||
        right.outForDeliveryCount - left.outForDeliveryCount ||
        left.courier.fullName.localeCompare(right.courier.fullName, "tr")
      );
    });

  return {
    todayDateLabel: formatTodayLabel(now, timeZone),
    todayOrdersCount: todayOrders.length,
    todayRevenueCents,
    unassignedOrdersCount,
    outForDeliveryOrdersCount,
    topProducts,
    paymentMethodDistribution: toSortedDistribution(paymentMethodCounts),
    paymentStatusDistribution: toSortedDistribution(paymentStatusCounts),
    courierWorkloads,
    recentOrders: orders.slice(0, 8)
  };
}
