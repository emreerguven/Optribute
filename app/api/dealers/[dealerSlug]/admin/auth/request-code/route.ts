import { NextResponse } from "next/server";
import { requestAdminLoginCode } from "@/src/server/auth/admin";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(
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

  if (!isRecord(body) || typeof body.phone !== "string") {
    return NextResponse.json({ error: "Telefon numarası zorunludur" }, { status: 400 });
  }

  try {
    const result = await requestAdminLoginCode(dealer.id, body.phone);
    return NextResponse.json({
      ok: true,
      developmentCode: process.env.NODE_ENV === "production" ? undefined : result.developmentCode
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Kod gönderilemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
