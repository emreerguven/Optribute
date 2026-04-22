import { NextResponse } from "next/server";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateCampaignStatusForCompany } from "@/src/server/domain/campaigns/service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const input = parseStatusUpdate(body);
    const campaign = await updateCampaignStatusForCompany(dealer.id, campaignId, input.isActive);
    return NextResponse.json({ ok: true, campaign });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kampanya güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
