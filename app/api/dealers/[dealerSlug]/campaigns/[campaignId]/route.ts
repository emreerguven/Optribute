import { NextResponse } from "next/server";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import {
  updateCampaignForCompany,
  updateCampaignStatusForCompany
} from "@/src/server/domain/campaigns/service";
import type { CampaignType } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCampaignType(value: unknown): value is CampaignType {
  return value === "bundle-gift" || value === "quantity" || value === "cart-discount";
}

function parsePositiveInteger(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${label} geçersiz`);
  }

  return parsed;
}

function parsePriceCents(value: unknown, label: string) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim().replace(",", "."));

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`${label} geçersiz`);
    }

    return Math.round(parsed * 100);
  }

  throw new Error(`${label} geçersiz`);
}

function parseProductId(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseStatusUpdate(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  if (typeof body.isActive !== "boolean") {
    throw new Error("Aktif durumu geçersiz");
  }

  return {
    isActive: body.isActive
  };
}

function parseCampaignUpdate(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  const { name, type, isActive } = body;

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Kampanya adı zorunludur");
  }

  if (!isCampaignType(type)) {
    throw new Error("Kampanya tipi geçersiz");
  }

  if (typeof isActive !== "boolean") {
    throw new Error("Aktif durumu geçersiz");
  }

  return {
    name: name.trim(),
    type,
    isActive,
    targetProductId: parseProductId(body.targetProductId),
    giftProductId: parseProductId(body.giftProductId),
    requiredQuantity: parsePositiveInteger(body.requiredQuantity, "Gerekli adet"),
    payableQuantity: parsePositiveInteger(body.payableQuantity, "Ödenecek adet"),
    minCartTotalCents: parsePriceCents(body.minCartTotal, "Minimum sepet tutarı"),
    discountAmountCents: parsePriceCents(body.discountAmount, "İndirim tutarı")
  };
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params: Promise<{ dealerSlug: string; campaignId: string }>;
  }
) {
  const { dealerSlug, campaignId } = await params;
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
    const campaign = isRecord(body) && "name" in body
      ? await updateCampaignForCompany(dealer.id, campaignId, parseCampaignUpdate(body))
      : await updateCampaignStatusForCompany(
          dealer.id,
          campaignId,
          parseStatusUpdate(body).isActive
        );
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kampanya güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
