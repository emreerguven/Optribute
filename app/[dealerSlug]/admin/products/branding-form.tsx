"use client";

import { useState } from "react";
import type { Company } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialLogoUrl: string;
  initialPrimaryColor: string;
};

export function BrandingForm({
  dealerSlug,
  initialLogoUrl,
  initialPrimaryColor
}: Props) {
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor);
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
          primaryColor
        })
      });

      const payload = (await response.json()) as { company?: Company; error?: string };

      if (!response.ok || !payload.company) {
        throw new Error(payload.error ?? "Bayi görünümü güncellenemedi");
      }

      setLogoUrl(payload.company.logoUrl ?? "");
      setPrimaryColor(payload.company.primaryColor ?? "");
      setMessage("Bayi görünümü güncellendi.");
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Bayi görünümü güncellenemedi";
      setMessage(fallback);
    } finally {
      setIsSaving(false);
    }
  }

  const previewColor = /^#[0-9A-Fa-f]{6}$/.test(primaryColor) ? primaryColor : "#0f766e";

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
            Ana renk
            <input
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              placeholder="#0f766e"
              disabled={isSaving}
            />
          </label>

          <div className="branding-preview">
            <span
              className="branding-color-dot"
              style={{ backgroundColor: previewColor }}
              aria-hidden="true"
            />
            <span>Önizleme rengi</span>
          </div>
        </div>

        {message ? <p className="note">{message}</p> : null}

        <button type="submit" className="button admin-submit" disabled={isSaving}>
          {isSaving ? "Kaydediliyor..." : "Marka bilgilerini kaydet"}
        </button>
      </form>
    </section>
  );
}
