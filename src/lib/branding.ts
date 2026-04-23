import type { CSSProperties } from "react";

export function isHexColor(value: string | null | undefined): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function getDealerBrandStyle(primaryColor: string | null): CSSProperties | undefined {
  if (!isHexColor(primaryColor)) {
    return undefined;
  }

  return getBrandStyle(primaryColor);
}

export function getBrandStyle(primaryColor: string): CSSProperties {
  return {
    "--color-primary": primaryColor,
    "--color-primary-strong": primaryColor,
    "--color-primary-soft": `color-mix(in srgb, ${primaryColor} 10%, white)`,
    "--color-primary-softer": `color-mix(in srgb, ${primaryColor} 6%, white)`,
    "--color-primary-border": `color-mix(in srgb, ${primaryColor} 38%, transparent)`,
    "--color-primary-shadow": `color-mix(in srgb, ${primaryColor} 20%, transparent)`,
    "--card-border": `color-mix(in srgb, ${primaryColor} 18%, transparent)`
  } as CSSProperties;
}
