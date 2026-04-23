import { randomUUID } from "node:crypto";
import {
  OrderStatus as PrismaOrderStatus,
  PaymentMethod as PrismaPaymentMethod,
  PaymentStatus as PrismaPaymentStatus
} from "@/src/generated/prisma/index";
import { db } from "@/src/server/db";
import { evaluateBestCampaign } from "@/src/lib/campaigns";
import { normalizePhone } from "@/src/server/domain/phone";
import { listActiveCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { upsertCustomerForOrder } from "@/src/server/domain/customers/service";
import type {
  Company,
  Order,
  OrderDraft,
  OrderPaymentSnapshot,
  OrderStatus,
  PaymentMethod,
  PaymentStatus
} from "@/src/server/domain/types";

function getAllowedNextStatuses(currentStatus: OrderStatus): OrderStatus[] {
  switch (currentStatus) {
    case "pending":
      return ["preparing", "completed", "cancelled"];
    case "preparing":
      return ["completed", "cancelled"];
    case "confirmed":
    case "delivering":
    case "completed":
    case "cancelled":
      return [];
  }
}

function toOrderStatus(status: PrismaOrderStatus): OrderStatus {
  switch (status) {
    case PrismaOrderStatus.PENDING:
      return "pending";
    case PrismaOrderStatus.CONFIRMED:
      return "confirmed";
    case PrismaOrderStatus.PREPARING:
      return "preparing";
    case PrismaOrderStatus.DELIVERING:
      return "delivering";
    case PrismaOrderStatus.COMPLETED:
      return "completed";
    case PrismaOrderStatus.CANCELLED:
      return "cancelled";
  }

  const exhaustiveStatus: never = status;
  throw new Error(`Unsupported order status: ${exhaustiveStatus}`);
}

function toPaymentStatus(status: PrismaPaymentStatus): PaymentStatus {
  switch (status) {
    case PrismaPaymentStatus.PENDING:
      return "pending";
    case PrismaPaymentStatus.PAID:
      return "paid";
    case PrismaPaymentStatus.FAILED:
      return "failed";
    case PrismaPaymentStatus.CANCELLED:
      return "cancelled";
  }

  const exhaustiveStatus: never = status;
  throw new Error(`Unsupported payment status: ${exhaustiveStatus}`);
}

function toPaymentMethod(method: PrismaPaymentMethod): PaymentMethod {
  switch (method) {
    case PrismaPaymentMethod.CASH_ON_DELIVERY:
      return "cash-on-delivery";
    case PrismaPaymentMethod.CARD_ON_DELIVERY:
      return "card-on-delivery";
    case PrismaPaymentMethod.ACCOUNT_BALANCE:
      return "online";
  }

  const exhaustiveMethod: never = method;
  throw new Error(`Unsupported payment method: ${exhaustiveMethod}`);
}

function toPrismaPaymentMethod(method: PaymentMethod): PrismaPaymentMethod {
  switch (method) {
    case "cash-on-delivery":
      return PrismaPaymentMethod.CASH_ON_DELIVERY;
    case "card-on-delivery":
      return PrismaPaymentMethod.CARD_ON_DELIVERY;
    case "online":
      return PrismaPaymentMethod.ACCOUNT_BALANCE;
  }

  const exhaustiveMethod: never = method;
  throw new Error(`Unsupported payment method: ${exhaustiveMethod}`);
}

function toPrismaOrderStatus(status: OrderStatus): PrismaOrderStatus {
  switch (status) {
    case "pending":
      return PrismaOrderStatus.PENDING;
    case "confirmed":
      return PrismaOrderStatus.CONFIRMED;
    case "preparing":
      return PrismaOrderStatus.PREPARING;
    case "delivering":
      return PrismaOrderStatus.DELIVERING;
    case "completed":
      return PrismaOrderStatus.COMPLETED;
    case "cancelled":
      return PrismaOrderStatus.CANCELLED;
  }

  const exhaustiveStatus: never = status;
  throw new Error(`Unsupported order status: ${exhaustiveStatus}`);
}

function toOrder(order: {
  id: string;
  companyId: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  addressLine: string;
  deliveryNotes: string | null;
  status: PrismaOrderStatus;
  submittedAt: Date;
  orderItems: Array<{
    productId: string | null;
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
  payments: Array<{
    id: string;
    orderId: string;
    amountCents: number;
    method: PrismaPaymentMethod;
    status: PrismaPaymentStatus;
    reference: string | null;
  }>;
}): Order {
  return {
    id: order.id,
    companyId: order.companyId,
    customerId: order.customerId,
    customerName: order.customerName,
    phone: order.phone,
    addressLine: order.addressLine,
    status: toOrderStatus(order.status),
    createdAt: order.submittedAt.toISOString(),
    notes: order.deliveryNotes,
    items: order.orderItems.map((item) => ({
      productId: item.productId ?? "",
      name: item.productName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      orderId: payment.orderId,
      amountCents: payment.amountCents,
      method: toPaymentMethod(payment.method),
      status: toPaymentStatus(payment.status),
      reference: payment.reference
    }))
  };
}

function toCompany(company: {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  supportPhone: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string | null;
  currency: string;
  orderLeadTimeMinutes: number;
}): Company {
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    city: company.city,
    supportPhone: company.supportPhone,
    logoUrl: company.logoUrl,
    heroImageUrl: company.heroImageUrl,
    primaryColor: company.primaryColor,
    currency: company.currency,
    orderLeadTimeMinutes: company.orderLeadTimeMinutes
  };
}

function toOrderPaymentSnapshot(order: Parameters<typeof toOrder>[0] & {
  company: {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    supportPhone: string | null;
    logoUrl: string | null;
    heroImageUrl: string | null;
    primaryColor: string | null;
    currency: string;
    orderLeadTimeMinutes: number;
  };
}): OrderPaymentSnapshot {
  return {
    ...toOrder(order),
    company: toCompany(order.company)
  };
}

export async function listOrdersForCompany(companyId: string) {
  const orders = await db.order.findMany({
    where: {
      companyId
    },
    include: {
      orderItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    },
    orderBy: [
      {
        submittedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ]
  });

  return orders.map(toOrder);
}

export async function updateOrderStatusForCompany(
  companyId: string,
  orderId: string,
  nextStatus: OrderStatus
) {
  const existingOrder = await db.order.findFirst({
    where: {
      id: orderId,
      companyId
    },
    include: {
      orderItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!existingOrder) {
    throw new Error("Sipariş bulunamadı");
  }

  const currentStatus = toOrderStatus(existingOrder.status);
  const allowedNextStatuses = getAllowedNextStatuses(currentStatus);

  if (!allowedNextStatuses.includes(nextStatus)) {
    throw new Error("Bu durum geçişine izin verilmiyor");
  }

  const updatedOrder = await db.order.update({
    where: {
      id: existingOrder.id
    },
    data: {
      status: toPrismaOrderStatus(nextStatus)
    },
    include: {
      orderItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  return toOrder(updatedOrder);
}

export async function createOrder(companyId: string, draft: OrderDraft) {
  const fullName = draft.fullName.trim();
  const phone = draft.phone.trim();
  const normalizedPhone = normalizePhone(phone);
  const addressLine = draft.addressLine.trim();
  const items = draft.items.filter((item) => item.quantity > 0);
  const uniqueProductIds = [...new Set(items.map((item) => item.productId))];

  if (!normalizedPhone || !fullName || !addressLine || items.length === 0) {
    throw new Error("Missing required order fields");
  }

  return db.$transaction(async (tx) => {
    const orderId = `ord_${randomUUID()}`;
    const customer = await upsertCustomerForOrder(
      {
        companyId,
        phone,
        fullName,
        addressLine,
        notes: draft.notes
      },
      tx
    );

    const products = await tx.product.findMany({
      where: {
        companyId,
        isActive: true,
        id: {
          in: uniqueProductIds
        }
      }
    });

    if (products.length !== uniqueProductIds.length) {
      throw new Error("One or more products were not found for this company");
    }

    const productMap = new Map(products.map((product) => [product.id, product]));
    const pricedItems = items.map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} was not found for company ${companyId}`);
      }

      return {
        productId: product.id,
        name: product.name,
        quantity: item.quantity,
        unitPriceCents: product.priceCents
      };
    });
    const campaigns = await listActiveCampaignsForCompany(companyId, tx);
    const campaignResult = evaluateBestCampaign(campaigns, pricedItems);
    const orderItems = [
      ...pricedItems,
      ...(campaignResult.appliedCampaign?.giftItems ?? []),
      ...(campaignResult.appliedCampaign?.adjustmentItems ?? [])
    ];

    const order = await tx.order.create({
      data: {
        id: orderId,
        companyId,
        customerId: customer.id,
        customerName: customer.fullName,
        phone: customer.phone,
        normalizedPhone,
        addressLine,
        deliveryNotes: draft.notes?.trim() || null,
        status: PrismaOrderStatus.PENDING,
        source: "qr",
        orderItems: {
          create: orderItems.map((item) => ({
            id: `order_item_${randomUUID()}`,
            productId: item.productId || null,
            productName: item.name,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents
          }))
        },
        payments: {
          create: [
            {
              id: `pay_${randomUUID()}`,
              amountCents: campaignResult.finalTotalCents,
              method: toPrismaPaymentMethod(draft.paymentMethod),
              status: PrismaPaymentStatus.PENDING,
              reference: null
            }
          ]
        }
      },
      include: {
        orderItems: {
          orderBy: {
            createdAt: "asc"
          }
        },
        payments: {
          orderBy: {
            createdAt: "asc"
          }
        }
      }
    });

    return toOrder(order);
  });
}

export async function getOrderPaymentSnapshot(orderId: string) {
  const order = await db.order.findUnique({
    where: {
      id: orderId
    },
    include: {
      company: true,
      orderItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  return order ? toOrderPaymentSnapshot(order) : null;
}

export async function setPaymentReferenceForOrder(
  orderId: string,
  paymentId: string,
  reference: string
) {
  const payment = await db.payment.findFirst({
    where: {
      id: paymentId,
      orderId
    },
    select: {
      id: true
    }
  });

  if (!payment) {
    throw new Error("Ödeme kaydı bulunamadı");
  }

  await db.payment.update({
    where: {
      id: payment.id
    },
    data: {
      reference
    }
  });
}

export async function updateOnlinePaymentResultByToken(
  token: string,
  status: Extract<PaymentStatus, "paid" | "failed" | "pending">
) {
  const payment = await db.payment.findFirst({
    where: {
      reference: token,
      method: PrismaPaymentMethod.ACCOUNT_BALANCE
    },
    include: {
      order: {
        include: {
          company: true,
          orderItems: {
            orderBy: {
              createdAt: "asc"
            }
          },
          payments: {
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      }
    }
  });

  if (!payment) {
    throw new Error("Online ödeme kaydı bulunamadı");
  }

  await db.payment.update({
    where: {
      id: payment.id
    },
    data: {
      status:
        status === "paid"
          ? PrismaPaymentStatus.PAID
          : status === "failed"
            ? PrismaPaymentStatus.FAILED
            : PrismaPaymentStatus.PENDING
    }
  });

  const updatedOrder = await db.order.findUnique({
    where: {
      id: payment.orderId
    },
    include: {
      company: true,
      orderItems: {
        orderBy: {
          createdAt: "asc"
        }
      },
      payments: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!updatedOrder) {
    throw new Error("Sipariş bulunamadı");
  }

  return toOrderPaymentSnapshot(updatedOrder);
}

export async function countCustomersForCompany(companyId: string) {
  return db.customer.count({
    where: {
      companyId
    }
  });
}
