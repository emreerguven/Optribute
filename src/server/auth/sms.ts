type SmsResult = {
  channel: "console";
  developmentCode?: string;
};

export async function sendAdminLoginSms(input: { phone: string; code: string }): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER;

  if (provider && provider !== "console") {
    throw new Error(`SMS provider is not supported yet: ${provider}`);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SMS provider is not configured for production");
  }

  console.log(`[admin-auth] SMS code for ${input.phone}: ${input.code}`);

  return {
    channel: "console",
    developmentCode: input.code
  };
}
