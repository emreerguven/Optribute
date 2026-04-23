import { NextResponse } from "next/server";
import { requireAdminApi } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateCourierForCompany } from "@/src/server/domain/couriers/service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseCourierInput(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  const { fullName, phone, isActive } = body;

  if (typeof fullName !== "string" || !fullName.trim()) {
    throw new Error("Kurye adı zorunludur");
  }

  if (typeof phone !== "string" || !phone.trim()) {
    throw new Error("Kurye telefonu zorunludur");
  }

  if (typeof isActive !== "boolean") {
    throw new Error("Aktif durumu geçersiz");
  }

  return {
    fullName: fullName.trim(),
    phone: phone.trim(),
    isActive
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ dealerSlug: string; courierId: string }> }
) {
  const { dealerSlug, courierId } = await params;
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
    const courier = await updateCourierForCompany(dealer.id, courierId, parseCourierInput(body));
    return NextResponse.json({ ok: true, courier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kurye güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
