import { NextResponse } from "next/server";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { createOrder } from "@/src/server/domain/orders/service";
import { PAYMENT_METHODS, type OrderDraft } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaymentMethod(value: unknown): value is OrderDraft["paymentMethod"] {
  return typeof value === "string" && PAYMENT_METHODS.some((method) => method === value);
}

function parseOrderDraft(body: unknown): OrderDraft {
  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object");
  }

  const { phone, fullName, addressLine, notes, items, payment_method: paymentMethod } = body;

  if (typeof phone !== "string" || !phone.trim()) {
    throw new Error("Phone is required");
  }

  if (typeof fullName !== "string" || !fullName.trim()) {
    throw new Error("Full name is required");
  }

  if (typeof addressLine !== "string" || !addressLine.trim()) {
    throw new Error("Address line is required");
  }

  if (!isPaymentMethod(paymentMethod)) {
    throw new Error("payment_method is invalid");
  }

  if (notes !== undefined && typeof notes !== "string") {
    throw new Error("Notes must be a string");
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("At least one order item is required");
  }

  const normalizedItems = items.map((item, index) => {
    if (!isRecord(item)) {
      throw new Error(`Item ${index + 1} is invalid`);
    }

    if (typeof item.productId !== "string" || !item.productId.trim()) {
      throw new Error(`Item ${index + 1} is missing a productId`);
    }

    if (typeof item.quantity !== "number" || !Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error(`Item ${index + 1} must have a positive integer quantity`);
    }

    return {
      productId: item.productId.trim(),
      quantity: item.quantity
    };
  });

  const uniqueProductIds = new Set(normalizedItems.map((item) => item.productId));

  if (uniqueProductIds.size !== normalizedItems.length) {
    throw new Error("Duplicate productId entries are not allowed");
  }

  return {
    phone,
    fullName,
    addressLine,
    paymentMethod,
    notes,
    items: normalizedItems
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ dealerSlug: string }> }
) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    return NextResponse.json({ error: "Dealer not found" }, { status: 404 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  try {
    const draft = parseOrderDraft(body);
    const order = await createOrder(dealer.id, draft);
    const totalCents =
      order.payments[0]?.amountCents ??
      order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const discountLine = order.items.find((item) => item.unitPriceCents < 0);

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      totalCents,
      campaign: discountLine
        ? {
            name: discountLine?.name.replace("Kampanya indirimi: ", "") ?? "Hediye ürün kampanyası",
            discountAmountCents: discountLine ? Math.abs(discountLine.unitPriceCents) : 0,
            giftItems: []
          }
        : null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Order could not be created";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
