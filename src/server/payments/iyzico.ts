import { createHmac, randomUUID } from "node:crypto";
import type { OrderPaymentSnapshot } from "@/src/server/domain/types";
import { normalizePhone } from "@/src/server/domain/phone";

const CHECKOUT_FORM_INITIALIZE_PATH = "/payment/iyzipos/checkoutform/initialize/auth/ecom";
const CHECKOUT_FORM_RETRIEVE_PATH = "/payment/iyzipos/checkoutform/auth/ecom/detail";

type IyzicoConfig = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
  appBaseUrl: string;
};

type IyzicoCheckoutInitializeResponse = {
  status?: "success" | "failure";
  errorMessage?: string;
  token?: string;
  paymentPageUrl?: string;
};

type IyzicoCheckoutRetrieveResponse = {
  status?: "success" | "failure";
  errorMessage?: string;
  token?: string;
  paymentStatus?: "SUCCESS" | "FAILURE" | "INIT_THREEDS" | string;
  paidPrice?: string;
};

export type IyzicoCheckoutSession = {
  token: string;
  paymentPageUrl: string;
};

function getIyzicoConfig(): IyzicoConfig {
  const apiKey = process.env.IYZI_API_KEY;
  const secretKey = process.env.IYZI_SECRET_KEY;
  const baseUrl = process.env.IYZI_BASE_URL ?? "https://sandbox-api.iyzipay.com";
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!apiKey || !secretKey || !appBaseUrl) {
    throw new Error("iyzico yapılandırması eksik. IYZI_API_KEY, IYZI_SECRET_KEY ve APP_BASE_URL ayarlanmalıdır.");
  }

  return {
    apiKey,
    secretKey,
    baseUrl: baseUrl.replace(/\/$/, ""),
    appBaseUrl: appBaseUrl.replace(/\/$/, "")
  };
}

function centsToIyzicoPrice(valueCents: number) {
  return (valueCents / 100).toFixed(2);
}

function createAuthorizationHeader(
  config: IyzicoConfig,
  path: string,
  body: string
) {
  const randomKey = `${Date.now()}${randomUUID().replace(/-/g, "")}`;
  const signature = createHmac("sha256", config.secretKey)
    .update(`${randomKey}${path}${body}`)
    .digest("hex");
  const authorizationString = `apiKey:${config.apiKey}&randomKey:${randomKey}&signature:${signature}`;

  return {
    authorization: `IYZWSv2 ${Buffer.from(authorizationString, "utf8").toString("base64")}`,
    randomKey
  };
}

async function postToIyzico<T>(path: string, payload: Record<string, unknown>): Promise<T> {
  const config = getIyzicoConfig();
  const body = JSON.stringify(payload);
  const { authorization, randomKey } = createAuthorizationHeader(config, path, body);
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      "x-iyzi-rnd": randomKey
    },
    body
  });
  const result = (await response.json()) as T & { errorMessage?: string };

  if (!response.ok) {
    throw new Error(result.errorMessage ?? "iyzico isteği başarısız oldu");
  }

  return result;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const name = parts[0] ?? "Musteri";
  const surname = parts.slice(1).join(" ") || "Optribute";

  return { name, surname };
}

function formatPhoneForIyzico(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized ? `+90${normalized}` : "+905350000000";
}

function createFallbackBuyerEmail(phone: string) {
  const sanitizedPhone = normalizePhone(phone).replace(/\D/g, "") || "unknown";
  return `customer-${sanitizedPhone}@optribute.com`;
}

function getPrimaryPayment(order: OrderPaymentSnapshot) {
  const payment = order.payments[0];

  if (!payment) {
    throw new Error("Sipariş için ödeme kaydı bulunamadı");
  }

  return payment;
}

export async function initializeIyzicoCheckoutForm(order: OrderPaymentSnapshot) {
  const config = getIyzicoConfig();
  const payment = getPrimaryPayment(order);
  const total = centsToIyzicoPrice(payment.amountCents);
  const { name, surname } = splitFullName(order.customerName);
  const callbackUrl = `${config.appBaseUrl}/api/payments/iyzico/callback?dealerSlug=${encodeURIComponent(order.company.slug)}`;
  const address = order.addressLine || "Adres belirtilmedi";
  const city = order.company.city ?? "Istanbul";

  const payload = {
    locale: "tr",
    conversationId: order.id,
    price: total,
    paidPrice: total,
    currency: order.company.currency || "TRY",
    basketId: order.id,
    paymentGroup: "PRODUCT",
    callbackUrl,
    buyer: {
      id: order.customerId ?? order.id,
      name,
      surname,
      gsmNumber: formatPhoneForIyzico(order.phone),
      email: createFallbackBuyerEmail(order.phone),
      identityNumber: "11111111111",
      registrationAddress: address,
      ip: "127.0.0.1",
      city,
      country: "Turkey"
    },
    shippingAddress: {
      contactName: order.customerName,
      city,
      country: "Turkey",
      address
    },
    billingAddress: {
      contactName: order.customerName,
      city,
      country: "Turkey",
      address
    },
    basketItems: [
      {
        id: order.id,
        name: `Optribute sipariş ${order.id}`,
        category1: "Su siparişi",
        itemType: "PHYSICAL",
        price: total
      }
    ]
  };

  const result = await postToIyzico<IyzicoCheckoutInitializeResponse>(
    CHECKOUT_FORM_INITIALIZE_PATH,
    payload
  );

  if (result.status !== "success" || !result.token || !result.paymentPageUrl) {
    throw new Error(result.errorMessage ?? "iyzico ödeme sayfası başlatılamadı");
  }

  return {
    token: result.token,
    paymentPageUrl: result.paymentPageUrl
  } satisfies IyzicoCheckoutSession;
}

export async function retrieveIyzicoCheckoutForm(token: string) {
  const result = await postToIyzico<IyzicoCheckoutRetrieveResponse>(
    CHECKOUT_FORM_RETRIEVE_PATH,
    {
      locale: "tr",
      conversationId: token,
      token
    }
  );

  if (result.status !== "success") {
    return {
      paymentStatus: "failed" as const,
      rawStatus: result.paymentStatus,
      errorMessage: result.errorMessage ?? "iyzico ödeme sonucu başarısız"
    };
  }

  return {
    paymentStatus: result.paymentStatus === "SUCCESS" ? "paid" as const : "failed" as const,
    rawStatus: result.paymentStatus,
    errorMessage: result.errorMessage
  };
}
