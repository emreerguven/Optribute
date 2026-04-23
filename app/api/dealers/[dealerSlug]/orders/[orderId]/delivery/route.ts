import { NextResponse } from "next/server";
import { requireAdminApi } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateOrderDeliveryForCompany } from "@/src/server/domain/orders/service";
import type { DeliveryStatus } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDeliveryStatus(value: unknown): value is DeliveryStatus {
  return (
    value === "unassigned" ||
    value === "assigned" ||
    value === "out-for-delivery" ||
    value === "delivered"
  );
}

function parseDeliveryInput(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  if (!isDeliveryStatus(body.deliveryStatus)) {
    throw new Error("Teslimat durumu geçersiz");
  }

  if (
    body.courierId !== null &&
    body.courierId !== undefined &&
    (typeof body.courierId !== "string" || !body.courierId.trim())
  ) {
    throw new Error("Kurye seçimi geçersiz");
  }

  return {
    courierId: typeof body.courierId === "string" && body.courierId.trim() ? body.courierId.trim() : null,
    deliveryStatus: body.deliveryStatus
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealerSlug: string; orderId: string }> }
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
    const order = await updateOrderDeliveryForCompany(dealer.id, orderId, parseDeliveryInput(body));
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Teslimat bilgisi güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
