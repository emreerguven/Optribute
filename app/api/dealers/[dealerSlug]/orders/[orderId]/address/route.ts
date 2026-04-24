import { NextResponse } from "next/server";
import { requireAdminApi } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateOrderAddressForCompany } from "@/src/server/domain/orders/service";
import type { StructuredAddressInput } from "@/src/lib/address";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDeliveryAddress(value: unknown): StructuredAddressInput | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error("Teslimat adresi geçersiz");
  }

  return {
    district: typeof value.district === "string" ? value.district : undefined,
    neighborhood: typeof value.neighborhood === "string" ? value.neighborhood : undefined,
    street: typeof value.street === "string" ? value.street : undefined,
    buildingNo: typeof value.buildingNo === "string" ? value.buildingNo : undefined,
    apartmentNo: typeof value.apartmentNo === "string" ? value.apartmentNo : undefined,
    siteName: typeof value.siteName === "string" ? value.siteName : undefined,
    addressNote: typeof value.addressNote === "string" ? value.addressNote : undefined
  };
}

function parseAddressUpdate(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  if (body.addressLine !== undefined && typeof body.addressLine !== "string") {
    throw new Error("Adres satırı geçersiz");
  }

  const deliveryAddress = parseDeliveryAddress(body.delivery_address);

  if ((!body.addressLine || !String(body.addressLine).trim()) && !deliveryAddress) {
    throw new Error("Adres bilgisi girin");
  }

  return {
    addressLine: typeof body.addressLine === "string" ? body.addressLine : undefined,
    deliveryAddress
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
    const input = parseAddressUpdate(body);
    const order = await updateOrderAddressForCompany(dealer.id, orderId, input);
    return NextResponse.json({ ok: true, order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Adres güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
