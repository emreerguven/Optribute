import { NextResponse } from "next/server";
import { deriveAddressSnapshot } from "@/src/lib/address";
import { requireAdminApi } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import {
  createOrder,
  getOrderPaymentSnapshot,
  setPaymentReferenceForOrder
} from "@/src/server/domain/orders/service";
import { initializeIyzicoCheckoutForm } from "@/src/server/payments/iyzico";
import { ORDER_SOURCES, PAYMENT_METHODS, type OrderDraft } from "@/src/server/domain/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPaymentMethod(value: unknown): value is OrderDraft["paymentMethod"] {
  return typeof value === "string" && PAYMENT_METHODS.some((method) => method === value);
}

function isOrderSource(value: unknown): value is NonNullable<OrderDraft["source"]> {
  return typeof value === "string" && ORDER_SOURCES.some((source) => source === value);
}

function parseDeliveryAddress(value: unknown): OrderDraft["deliveryAddress"] {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error("delivery_address is invalid");
  }

  const parsed = {
    district: typeof value.district === "string" ? value.district : undefined,
    neighborhood: typeof value.neighborhood === "string" ? value.neighborhood : undefined,
    street: typeof value.street === "string" ? value.street : undefined,
    buildingNo: typeof value.buildingNo === "string" ? value.buildingNo : undefined,
    apartmentNo: typeof value.apartmentNo === "string" ? value.apartmentNo : undefined,
    siteName: typeof value.siteName === "string" ? value.siteName : undefined,
    addressNote: typeof value.addressNote === "string" ? value.addressNote : undefined
  };

  return parsed;
}

function parseOrderDraft(body: unknown, city?: string | null): OrderDraft {
  if (!isRecord(body)) {
    throw new Error("Request body must be a JSON object");
  }

  const {
    phone,
    fullName,
    addressLine,
    notes,
    items,
    payment_method: paymentMethod,
    source,
    delivery_address: deliveryAddress
  } = body;

  if (typeof phone !== "string" || !phone.trim()) {
    throw new Error("Phone is required");
  }

  if (typeof fullName !== "string" || !fullName.trim()) {
    throw new Error("Full name is required");
  }

  if (addressLine !== undefined && typeof addressLine !== "string") {
    throw new Error("Address line is invalid");
  }

  if (!isPaymentMethod(paymentMethod)) {
    throw new Error("payment_method is invalid");
  }

  if (notes !== undefined && typeof notes !== "string") {
    throw new Error("Notes must be a string");
  }

  if (source !== undefined && !isOrderSource(source)) {
    throw new Error("source is invalid");
  }

  const parsedDeliveryAddress = parseDeliveryAddress(deliveryAddress);
  const addressSnapshot = deriveAddressSnapshot({
    addressLine: typeof addressLine === "string" ? addressLine : undefined,
    ...parsedDeliveryAddress
  }, { city });

  if (!addressSnapshot.normalizedAddressLine) {
    throw new Error("Address line is required");
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
    addressLine: typeof addressLine === "string" ? addressLine : undefined,
    deliveryAddress: parsedDeliveryAddress,
    paymentMethod,
    source: source ?? "qr",
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
    const draft = parseOrderDraft(body, dealer.city);

    if (draft.source === "manual") {
      const authError = await requireAdminApi(dealer.id);

      if (authError) {
        return authError;
      }
    }

    const order = await createOrder(dealer.id, draft);
    const primaryPayment = order.payments[0];
    const totalCents =
      primaryPayment?.amountCents ??
      order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
    const discountLine = order.items.find((item) => item.unitPriceCents < 0);

    if (draft.paymentMethod === "online") {
      if (!primaryPayment) {
        throw new Error("Online ödeme için ödeme kaydı oluşturulamadı");
      }

      const snapshot = await getOrderPaymentSnapshot(order.id);

      if (!snapshot) {
        throw new Error("Online ödeme için sipariş bilgisi bulunamadı");
      }

      const checkout = await initializeIyzicoCheckoutForm(snapshot);
      await setPaymentReferenceForOrder(order.id, primaryPayment.id, checkout.token);

      return NextResponse.json({
        ok: true,
        orderId: order.id,
        order,
        totalCents,
        paymentPageUrl: checkout.paymentPageUrl,
        paymentToken: checkout.token
      });
    }

    return NextResponse.json({
      ok: true,
      orderId: order.id,
      order,
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
