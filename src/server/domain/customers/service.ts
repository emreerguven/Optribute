import { randomUUID } from "node:crypto";
import { deriveAddressSnapshot, type StructuredAddressInput } from "@/src/lib/address";
import { db, type DbClient } from "@/src/server/db";
import { normalizePhone } from "@/src/server/domain/phone";
import type { Customer } from "@/src/server/domain/types";

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toCustomer(customer: {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  notes: string | null;
    addresses: Array<{
      id: string;
      label: string | null;
      line1: string;
      line1Raw: string | null;
      line1Normalized: string | null;
      addressQualityStatus: "VERIFIED" | "PARTIAL" | "FAILED";
      district: string | null;
      neighborhood: string | null;
      street: string | null;
    buildingNo: string | null;
    apartmentNo: string | null;
    siteName: string | null;
    addressNote: string | null;
    city: string | null;
    isDefault: boolean;
  }>;
}): Customer {
  return {
    id: customer.id,
    companyId: customer.companyId,
    fullName: customer.fullName,
    phone: customer.phone,
    notes: customer.notes,
    addresses: customer.addresses.map((address) => ({
      ...address,
      addressQualityStatus:
        address.addressQualityStatus === "VERIFIED"
          ? "verified"
          : address.addressQualityStatus === "FAILED"
            ? "failed"
            : "partial"
    }))
  };
}

async function loadCustomerByNormalizedPhone(
  client: DbClient,
  companyId: string,
  normalizedPhone: string
) {
  return client.customer.findUnique({
    where: {
      companyId_normalizedPhone: {
        companyId,
        normalizedPhone
      }
    },
    include: {
      addresses: {
        orderBy: [
          {
            isDefault: "desc"
          },
          {
            createdAt: "asc"
          }
        ]
      }
    }
  });
}

export async function findCustomerByNormalizedPhone(companyId: string, normalizedPhone: string) {
  if (!normalizedPhone) {
    return null;
  }

  const customer = await loadCustomerByNormalizedPhone(db, companyId, normalizedPhone);
  return customer ? toCustomer(customer) : null;
}

export async function findCustomerByPhone(companyId: string, phone: string) {
  return findCustomerByNormalizedPhone(companyId, normalizePhone(phone));
}

export type CustomerOperatorOrderSummary = {
  id: string;
  createdAt: string;
  paymentMethod: "cash-on-delivery" | "card-on-delivery" | "online" | null;
  items: Array<{
    productId: string | null;
    name: string;
    quantity: number;
  }>;
};

export type CustomerOperatorQuickProduct = {
  productId: string;
  name: string;
  quantity: number;
};

export type CustomerOperatorProfile = {
  customer: Customer;
  lastOrderDate: string | null;
  recentOrder: CustomerOperatorOrderSummary | null;
  frequentProducts: CustomerOperatorQuickProduct[];
};

function toOperatorPaymentMethod(
  method: "CASH_ON_DELIVERY" | "CARD_ON_DELIVERY" | "ACCOUNT_BALANCE" | null | undefined
): CustomerOperatorOrderSummary["paymentMethod"] {
  switch (method) {
    case "CASH_ON_DELIVERY":
      return "cash-on-delivery";
    case "CARD_ON_DELIVERY":
      return "card-on-delivery";
    case "ACCOUNT_BALANCE":
      return "online";
    default:
      return null;
  }
}

export async function findCustomerOperatorProfileByNormalizedPhone(
  companyId: string,
  normalizedPhone: string
): Promise<CustomerOperatorProfile | null> {
  if (!normalizedPhone) {
    return null;
  }

  const customerRecord = await loadCustomerByNormalizedPhone(db, companyId, normalizedPhone);

  if (!customerRecord) {
    return null;
  }

  const customer = toCustomer(customerRecord);
  const recentOrders = await db.order.findMany({
    where: {
      companyId,
      OR: customerRecord.id
        ? [
            {
              customerId: customerRecord.id
            },
            {
              normalizedPhone
            }
          ]
        : [
            {
              normalizedPhone
            }
          ]
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
        },
        take: 1
      }
    },
    orderBy: [
      {
        submittedAt: "desc"
      },
      {
        createdAt: "desc"
      }
    ],
    take: 5
  });

  const recentOrder = recentOrders[0]
    ? {
        id: recentOrders[0].id,
        createdAt: recentOrders[0].submittedAt.toISOString(),
        paymentMethod: toOperatorPaymentMethod(recentOrders[0].payments[0]?.method),
        items: recentOrders[0].orderItems
          .filter((item) => item.unitPriceCents > 0)
          .map((item) => ({
            productId: item.productId,
            name: item.productName,
            quantity: item.quantity
          }))
      }
    : null;

  const frequentProductsMap = new Map<
    string,
    {
      productId: string;
      name: string;
      quantity: number;
    }
  >();

  for (const order of recentOrders) {
    for (const item of order.orderItems) {
      if (!item.productId || item.unitPriceCents <= 0) {
        continue;
      }

      const existing = frequentProductsMap.get(item.productId);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        frequentProductsMap.set(item.productId, {
          productId: item.productId,
          name: item.productName,
          quantity: item.quantity
        });
      }
    }
  }

  const frequentProducts = [...frequentProductsMap.values()]
    .sort((left, right) => right.quantity - left.quantity || left.name.localeCompare(right.name, "tr"))
    .slice(0, 4);

  return {
    customer,
    lastOrderDate: recentOrders[0]?.submittedAt.toISOString() ?? null,
    recentOrder,
    frequentProducts
  };
}

export async function upsertCustomerForOrder(
  input: {
    companyId: string;
    phone: string;
    fullName: string;
    addressLine?: string;
    deliveryAddress?: StructuredAddressInput;
    city?: string | null;
    notes?: string;
  },
  client: DbClient = db
) {
  const normalizedPhone = normalizePhone(input.phone);
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const addressSnapshot = deriveAddressSnapshot(
    {
      addressLine: input.addressLine,
      ...input.deliveryAddress
    },
    {
      city: input.city
    }
  );
  const addressLine = addressSnapshot.normalizedAddressLine;

  if (!normalizedPhone || !fullName || !addressLine) {
    throw new Error("Customer details are incomplete");
  }

  const customer = await client.customer.upsert({
    where: {
      companyId_normalizedPhone: {
        companyId: input.companyId,
        normalizedPhone
      }
    },
    update: {
      fullName,
      phone,
      notes: cleanOptionalText(input.notes)
    },
    create: {
      id: `cust_${randomUUID()}`,
      companyId: input.companyId,
      fullName,
      phone,
      normalizedPhone,
      notes: cleanOptionalText(input.notes)
    }
  });

  const existingDefaultAddress = await client.customerAddress.findFirst({
    where: {
      customerId: customer.id,
      isDefault: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  if (existingDefaultAddress) {
    await client.customerAddress.update({
      where: {
        id: existingDefaultAddress.id
      },
      data: {
        line1: addressLine,
        line1Raw: addressSnapshot.rawAddressLine,
        line1Normalized: addressSnapshot.normalizedAddressLine,
        addressQualityStatus:
          addressSnapshot.qualityStatus === "verified"
            ? "VERIFIED"
            : addressSnapshot.qualityStatus === "failed"
              ? "FAILED"
              : "PARTIAL",
        district: addressSnapshot.structuredAddress.district,
        neighborhood: addressSnapshot.structuredAddress.neighborhood,
        street: addressSnapshot.structuredAddress.street,
        buildingNo: addressSnapshot.structuredAddress.buildingNo,
        apartmentNo: addressSnapshot.structuredAddress.apartmentNo,
        siteName: addressSnapshot.structuredAddress.siteName,
        addressNote: addressSnapshot.structuredAddress.addressNote,
        label: existingDefaultAddress.label ?? "Primary",
        isDefault: true
      }
    });
  } else {
    await client.customerAddress.create({
      data: {
        id: `addr_${randomUUID()}`,
        customerId: customer.id,
        label: "Primary",
        line1: addressLine,
        line1Raw: addressSnapshot.rawAddressLine,
        line1Normalized: addressSnapshot.normalizedAddressLine,
        addressQualityStatus:
          addressSnapshot.qualityStatus === "verified"
            ? "VERIFIED"
            : addressSnapshot.qualityStatus === "failed"
              ? "FAILED"
              : "PARTIAL",
        district: addressSnapshot.structuredAddress.district,
        neighborhood: addressSnapshot.structuredAddress.neighborhood,
        street: addressSnapshot.structuredAddress.street,
        buildingNo: addressSnapshot.structuredAddress.buildingNo,
        apartmentNo: addressSnapshot.structuredAddress.apartmentNo,
        siteName: addressSnapshot.structuredAddress.siteName,
        addressNote: addressSnapshot.structuredAddress.addressNote,
        isDefault: true
      }
    });
  }

  const updatedCustomer = await loadCustomerByNormalizedPhone(client, input.companyId, normalizedPhone);

  if (!updatedCustomer) {
    throw new Error("Customer could not be loaded after save");
  }

  return toCustomer(updatedCustomer);
}
