import { NextResponse } from "next/server";
import { retrieveIyzicoCheckoutForm } from "@/src/server/payments/iyzico";
import { updateOnlinePaymentResultByToken } from "@/src/server/domain/orders/service";

async function readToken(request: Request) {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token");

  if (queryToken) {
    return queryToken;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    return typeof body?.token === "string" ? body.token : "";
  }

  const formData = await request.formData().catch(() => null);
  const formToken = formData?.get("token");
  return typeof formToken === "string" ? formToken : "";
}

function redirectToOrderResult(request: Request, params: Record<string, string>) {
  const url = new URL(request.url);
  const dealerSlug = params.dealerSlug || url.searchParams.get("dealerSlug") || "javsu";
  const redirectUrl = new URL(`/${dealerSlug}/order/success`, url.origin);

  for (const [key, value] of Object.entries(params)) {
    redirectUrl.searchParams.set(key, value);
  }

  return NextResponse.redirect(redirectUrl, { status: 303 });
}

export async function GET(request: Request) {
  return handleIyzicoCallback(request);
}

export async function POST(request: Request) {
  return handleIyzicoCallback(request);
}

async function handleIyzicoCallback(request: Request) {
  const token = await readToken(request);

  if (!token) {
    return redirectToOrderResult(request, {
      dealerSlug: "javsu",
      paymentStatus: "failed",
      paymentMessage: "Odeme sonucu alinamadi"
    });
  }

  try {
    const result = await retrieveIyzicoCheckoutForm(token);
    const order = await updateOnlinePaymentResultByToken(token, result.paymentStatus);
    const payment = order.payments[0];
    const totalCents = payment?.amountCents ?? 0;

    return redirectToOrderResult(request, {
      dealerSlug: order.company.slug,
      orderId: order.id,
      customerName: order.customerName,
      total: String(totalCents),
      paymentMethod: "online",
      paymentStatus: result.paymentStatus,
      itemCount: String(
        order.items
          .filter((item) => item.unitPriceCents >= 0)
          .reduce((sum, item) => sum + item.quantity, 0)
      )
    });
  } catch {
    return redirectToOrderResult(request, {
      dealerSlug: "javsu",
      paymentStatus: "failed",
      paymentMessage: "Odeme sonucu dogrulanamadi"
    });
  }
}
