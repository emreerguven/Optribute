"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import type { Company } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialLogoUrl: string;
  initialPrimaryColor: string;
  initialLeadTimeMinutes: number;
};

const COLOR_PRESETS = [
  "#0f766e",
  "#2563eb",
  "#1d4ed8",
  "#047857",
  "#b45309",
  "#be123c",
  "#334155",
  "#7c3aed"
];

function brandStyle(color: string): CSSProperties {
  return {
    "--color-primary": color,
    "--color-primary-strong": color,
    "--color-primary-soft": `color-mix(in srgb, ${color} 10%, white)`,
    "--color-primary-softer": `color-mix(in srgb, ${color} 6%, white)`,
    "--color-primary-border": `color-mix(in srgb, ${color} 38%, transparent)`,
    "--color-primary-shadow": `color-mix(in srgb, ${color} 20%, transparent)`
  } as CSSProperties;
}

export function BrandingForm({
  dealerSlug,
  initialLogoUrl,
  initialPrimaryColor,
  initialLeadTimeMinutes
}: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor || COLOR_PRESETS[0]);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState(String(initialLeadTimeMinutes));
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/branding`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          logoUrl,
          primaryColor,
          orderLeadTimeMinutes: Number(leadTimeMinutes)
        })
      });

      const payload = (await response.json()) as { company?: Company; error?: string };

      if (!response.ok || !payload.company) {
        throw new Error(payload.error ?? "Bayi görünümü güncellenemedi");
      }

      setLogoUrl(payload.company.logoUrl ?? "");
      setPrimaryColor(payload.company.primaryColor ?? COLOR_PRESETS[0]);
      setLeadTimeMinutes(String(payload.company.orderLeadTimeMinutes));
      setMessage("Bayi görünümü güncellendi.");
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Bayi görünümü güncellenemedi";
      setMessage(fallback);
    } finally {
      setIsSaving(false);
    }
  }

  const previewColor = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : COLOR_PRESETS[0];
  const previewStyle = brandStyle(previewColor);

  return (
    <section className="panel stack">
      <div>
        <span className="kicker">Bayi görünümü</span>
        <h2>Marka bilgileri</h2>
        <p className="caption">
          Logo ve ana renk, müşterinin sipariş ekranında görünür.
        </p>
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <div className="product-form-grid">
          <label className="product-form-wide">
            Logo URL
            <input
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="https://... veya /logo.svg"
              disabled={isSaving}
            />
          </label>

          <label>
            Tahmini teslimat süresi
            <input
              type="number"
              min="10"
              max="240"
              step="5"
              value={leadTimeMinutes}
              onChange={(event) => setLeadTimeMinutes(event.target.value)}
              placeholder="45"
              disabled={isSaving}
            />
          </label>

          <div className="product-form-wide branding-color-panel">
            <div>
              <strong>Ana renk</strong>
              <p className="caption">Hazır renklerden seçin veya renk seçiciyle ince ayar yapın.</p>
            </div>
            <div className="branding-controls">
              <input
                type="color"
                className="branding-color-input"
                value={previewColor}
                onChange={(event) => setPrimaryColor(event.target.value)}
                aria-label="Ana renk seç"
                disabled={isSaving}
              />
              <div className="branding-preview">
                <span
                  className="branding-color-dot"
                  style={{ backgroundColor: previewColor }}
                  aria-hidden="true"
                />
                <span>{previewColor.toUpperCase()}</span>
              </div>
            </div>
            <div className="color-preset-grid">
              {COLOR_PRESETS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-preset ${
                    previewColor.toLowerCase() === color ? "color-preset-selected" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setPrimaryColor(color)}
                  disabled={isSaving}
                  aria-label={`${color} rengini seç`}
                />
              ))}
            </div>
            <div className="branding-live-preview" style={previewStyle}>
              <span>Önizleme</span>
              <strong>Online sipariş</strong>
              <em>Buton ve vurgular bu renkle görünür</em>
            </div>
          </div>
        </div>

        {message ? <p className="note">{message}</p> : null}

        <button
          type="submit"
          className="button admin-submit"
          style={previewStyle}
          disabled={isSaving}
        >
          {isSaving ? "Kaydediliyor..." : "Marka bilgilerini kaydet"}
        </button>
      </form>
    </section>
  );
}
