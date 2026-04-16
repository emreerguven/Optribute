import { NextResponse } from "next/server";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateOrderStatusForCompany } from "@/src/server/domain/orders/service";
import type { OrderStatus } from "@/src/server/domain/types";

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

function parseStatusUpdate(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  if (!isOrderStatus(body.status)) {
    throw new Error("Sipariş durumu geçersiz");
  }

  return {
    status: body.status
  };
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "İstek gövdesi geçerli JSON olmalıdır" }, { status: 400 });
  }

  try {
    const input = parseStatusUpdate(body);
    const order = await updateOrderStatusForCompany(dealer.id, orderId, input.status);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sipariş durumu güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
