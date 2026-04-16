import { NextResponse } from "next/server";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { updateProductForCompany } from "@/src/server/domain/products/service";
import type { ProductCategory } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isProductCategory(value: unknown): value is ProductCategory {
  return value === "water" || value === "soft-drink" || value === "bundle";
}

function parsePriceCents(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");

    if (!normalized) {
      throw new Error("Fiyat zorunludur");
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("Fiyat geçersiz");
    }

    return Math.round(parsed * 100);
  }

  throw new Error("Fiyat geçersiz");
}

function parseProductInput(body: unknown) {
  if (!isRecord(body)) {
    throw new Error("İstek gövdesi JSON nesnesi olmalıdır");
  }

  const { name, unitLabel, category, imageUrl, isActive, price } = body;

  if (typeof name !== "string" || !name.trim()) {
    throw new Error("Ürün adı zorunludur");
  }

  if (typeof unitLabel !== "string" || !unitLabel.trim()) {
    throw new Error("Birim etiketi zorunludur");
  }

  if (!isProductCategory(category)) {
    throw new Error("Kategori geçersiz");
  }

  if (typeof isActive !== "boolean") {
    throw new Error("Aktif durumu geçersiz");
  }

  if (imageUrl !== null && imageUrl !== undefined && typeof imageUrl !== "string") {
    throw new Error("Görsel bağlantısı geçersiz");
  }

  return {
    name: name.trim(),
    unitLabel: unitLabel.trim(),
    category,
    imageUrl: typeof imageUrl === "string" && imageUrl.trim() ? imageUrl.trim() : null,
    isActive,
    priceCents: parsePriceCents(price)
  };
}

export async function PATCH(
  request: Request,
  {
    params
  }: {
    params:
      | Promise<{ dealerSlug: string; productId: string }>
      | { dealerSlug: string; productId: string };
  }
) {
  const { dealerSlug, productId } = await Promise.resolve(params);
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
    const input = parseProductInput(body);
    const product = await updateProductForCompany(dealer.id, productId, input);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ürün güncellenemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
