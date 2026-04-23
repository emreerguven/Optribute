export type AdminAuthMode = "demo" | "sms";

export function getAdminAuthMode(): AdminAuthMode {
  const mode = process.env.ADMIN_AUTH_MODE?.trim().toLowerCase();

  if (!mode) {
    return process.env.NODE_ENV === "production" ? "sms" : "demo";
  }

  if (mode === "demo" || mode === "sms") {
    return mode;
  }

  throw new Error(`Unsupported ADMIN_AUTH_MODE: ${process.env.ADMIN_AUTH_MODE}`);
}

export function isDemoAdminAuthMode() {
  return getAdminAuthMode() === "demo";
}
