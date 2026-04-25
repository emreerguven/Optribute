import { NextResponse } from "next/server";
import { requireAdminApi } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import {
  updateOrderCollectionStatusForCompany,
  updateOrderStatusForCompany
} from "@/src/server/domain/orders/service";
import type { CollectionStatus, OrderStatus } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === "pending" ||
    value === "confirmed" ||
    value === "preparing" ||
    value === "delivering" ||
    value === "completed" ||
    value === "cancelled"
  );
}

function isCollectionStatus(value: unknown): value is CollectionStatus {
  return value === "pending" || value === "paid" || value === "on-account";
}

function parseStatusUpdate(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  if (body.status !== undefined) {
    if (!isOrderStatus(body.status)) {
      throw new Error("Sipariş durumu geçersiz");
    }

    return {
      kind: "order-status" as const,
      status: body.status
    };
  }

  if (body.collectionStatus !== undefined) {
    if (!isCollectionStatus(body.collectionStatus)) {
      throw new Error("Tahsilat durumu geçersiz");
    }

    return {
      kind: "collection-status" as const,
      collectionStatus: body.collectionStatus
    };
  }

  throw new Error("Güncellenecek alan bulunamadı");
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: Promise<{ dealerSlug: string; orderId: string }>;
  }
) {
  const { dealerSlug, orderId } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    return NextResponse.json({ error: "Bayi bulunamadı" }, { status: 404 });
  }

  const authError = await requireAdminApi(dealer.id);

  if (authError) {
    return authError;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "İstek gövdesi geçerli JSON olmalıdır" }, { status: 400 });
  }

  try {
    const input = parseStatusUpdate(body);
    const order =
      input.kind === "order-status"
        ? await updateOrderStatusForCompany(dealer.id, orderId, input.status)
        : await updateOrderCollectionStatusForCompany(dealer.id, orderId, input.collectionStatus);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sipariş durumu güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
