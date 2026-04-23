import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getCompanyBySlug,
  updateCompanyBranding
} from "@/src/server/domain/companies/service";
import { isHexColor } from "@/src/lib/branding";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalText(value: unknown, fieldName: string) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} geçersiz`);
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseBrandingInput(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  const logoUrl = normalizeOptionalText(body.logoUrl, "Logo bağlantısı");
  const heroImageUrl = normalizeOptionalText(body.heroImageUrl, "Hero görsel bağlantısı");
  const primaryColor = normalizeOptionalText(body.primaryColor, "Ana renk");
  const orderLeadTimeMinutes = body.orderLeadTimeMinutes;

  if (primaryColor && !isHexColor(primaryColor)) {
    throw new Error("Ana renk #RRGGBB formatında olmalıdır");
  }

  if (
    typeof orderLeadTimeMinutes !== "number" ||
    !Number.isInteger(orderLeadTimeMinutes) ||
    orderLeadTimeMinutes < 10 ||
    orderLeadTimeMinutes > 240
  ) {
    throw new Error("Teslimat süresi 10-240 dakika arasında olmalıdır");
  }

  return {
    logoUrl,
    heroImageUrl,
    primaryColor,
    orderLeadTimeMinutes
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealerSlug: string }> }
) {
  const { dealerSlug } = await params;
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
    const input = parseBrandingInput(body);
    const company = await updateCompanyBranding(dealer.id, input);
    revalidatePath(`/${dealer.slug}/order`);
    revalidatePath(`/${dealer.slug}/order/success`);
    revalidatePath(`/${dealer.slug}/admin/products`);
    return NextResponse.json({ ok: true, company });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bayi görünümü güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
