import { getAdminAuthMode, type AdminAuthMode } from "@/src/server/auth/config";

type SmsResult =
  | {
      mode: "demo";
      demoCode: string;
    }
  | {
      mode: "sms";
    };

async function sendViaConfiguredProvider(_input: { phone: string; code: string }) {
  const provider = process.env.SMS_PROVIDER?.trim().toLowerCase();

  if (!provider) {
    throw new Error("SMS modu için sağlayıcı yapılandırılmadı");
  }

  throw new Error(`SMS sağlayıcısı henüz uygulanmadı: ${provider}`);
}

export function getAdminVerificationDeliveryMode(): AdminAuthMode {
  return getAdminAuthMode();
}

export async function deliverAdminLoginCode(input: { phone: string; code: string }): Promise<SmsResult> {
  const mode = getAdminAuthMode();

  if (mode === "demo") {
    console.log(`[admin-auth][demo] verification code for ${input.phone}: ${input.code}`);

    return {
      mode: "demo",
      demoCode: input.code
    };
  }

  await sendViaConfiguredProvider(input);

  return {
    mode: "sms"
  };
}
