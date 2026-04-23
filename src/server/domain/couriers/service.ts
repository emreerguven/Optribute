import { randomUUID } from "node:crypto";
import { db } from "@/src/server/db";
import type { Courier } from "@/src/server/domain/types";

function toCourier(courier: {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  isActive: boolean;
  createdAt: Date;
}): Courier {
  return {
    id: courier.id,
    companyId: courier.companyId,
    fullName: courier.fullName,
    phone: courier.phone,
    isActive: courier.isActive,
    createdAt: courier.createdAt.toISOString()
  };
}

export async function listCouriersForCompany(companyId: string) {
  const couriers = await db.courier.findMany({
    where: {
      companyId
    },
    orderBy: [
      {
        isActive: "desc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  return couriers.map(toCourier);
}

export async function createCourierForCompany(
  companyId: string,
  input: {
    fullName: string;
    phone: string;
    isActive: boolean;
  }
) {
  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  if (!fullName || !phone) {
    throw new Error("Kurye adı ve telefon numarası zorunludur");
  }

  const courier = await db.courier.create({
    data: {
      id: `courier_${randomUUID()}`,
      companyId,
      fullName,
      phone,
      isActive: input.isActive
    }
  });

  return toCourier(courier);
}

export async function updateCourierForCompany(
  companyId: string,
  courierId: string,
  input: {
    fullName: string;
    phone: string;
    isActive: boolean;
  }
) {
  const existing = await db.courier.findFirst({
    where: {
      id: courierId,
      companyId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new Error("Kurye bulunamadı");
  }

  const fullName = input.fullName.trim();
  const phone = input.phone.trim();

  if (!fullName || !phone) {
    throw new Error("Kurye adı ve telefon numarası zorunludur");
  }

  const courier = await db.courier.update({
    where: {
      id: existing.id
    },
    data: {
      fullName,
      phone,
      isActive: input.isActive
    }
  });

  return toCourier(courier);
}
