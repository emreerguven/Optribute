import { randomUUID } from "node:crypto";
import { normalizeStructuredAddress, type StructuredAddressInput } from "@/src/lib/address";
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
    addresses: customer.addresses
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

export async function upsertCustomerForOrder(
  input: {
    companyId: string;
    phone: string;
    fullName: string;
    addressLine?: string;
    deliveryAddress?: StructuredAddressInput;
    notes?: string;
  },
  client: DbClient = db
) {
  const normalizedPhone = normalizePhone(input.phone);
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();
  const normalizedAddress = normalizeStructuredAddress({
    addressLine: input.addressLine,
    ...input.deliveryAddress
  });
  const addressLine = normalizedAddress.addressLine;

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
        district: normalizedAddress.district,
        neighborhood: normalizedAddress.neighborhood,
        street: normalizedAddress.street,
        buildingNo: normalizedAddress.buildingNo,
        apartmentNo: normalizedAddress.apartmentNo,
        siteName: normalizedAddress.siteName,
        addressNote: normalizedAddress.addressNote,
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
        district: normalizedAddress.district,
        neighborhood: normalizedAddress.neighborhood,
        street: normalizedAddress.street,
        buildingNo: normalizedAddress.buildingNo,
        apartmentNo: normalizedAddress.apartmentNo,
        siteName: normalizedAddress.siteName,
        addressNote: normalizedAddress.addressNote,
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
