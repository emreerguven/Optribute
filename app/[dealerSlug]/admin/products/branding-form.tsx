"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrandStyle, isHexColor } from "@/src/lib/branding";
import type { Company } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialLogoUrl: string;
  initialHeroImageUrl: string;
  initialDepotName: string;
  initialDepotAddress: string;
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

export function BrandingForm({
  dealerSlug,
  initialLogoUrl,
  initialHeroImageUrl,
  initialDepotName,
  initialDepotAddress,
  initialPrimaryColor,
  initialLeadTimeMinutes
}: Props) {
  const router = useRouter();
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [heroImageUrl, setHeroImageUrl] = useState(initialHeroImageUrl);
  const [depotName, setDepotName] = useState(initialDepotName);
  const [depotAddress, setDepotAddress] = useState(initialDepotAddress);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor || COLOR_PRESETS[0]);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState(String(initialLeadTimeMinutes));
  const [isOpen, setIsOpen] = useState(false);
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
          heroImageUrl,
          depotName,
          depotAddress,
          primaryColor,
          orderLeadTimeMinutes: Number(leadTimeMinutes)
        })
      });

      const payload = (await response.json()) as { company?: Company; error?: string };

      if (!response.ok || !payload.company) {
        throw new Error(payload.error ?? "Bayi görünümü güncellenemedi");
      }

      setLogoUrl(payload.company.logoUrl ?? "");
      setHeroImageUrl(payload.company.heroImageUrl ?? "");
      setDepotName(payload.company.depotName ?? "");
      setDepotAddress(payload.company.depotAddress ?? "");
      setPrimaryColor(payload.company.primaryColor ?? COLOR_PRESETS[0]);
      setLeadTimeMinutes(String(payload.company.orderLeadTimeMinutes));
      setMessage("Bayi görünümü güncellendi.");
      router.refresh();
    } catch (error) {
      const fallback = error instanceof Error ? error.message : "Bayi görünümü güncellenemedi";
      setMessage(fallback);
    } finally {
      setIsSaving(false);
    }
  }

  const previewColor = isHexColor(primaryColor) ? primaryColor : COLOR_PRESETS[0];
  const previewStyle = getBrandStyle(previewColor);

  return (
    <section className="panel stack">
      <div className="admin-section-header">
        <div>
          <span className="kicker">Bayi görünümü</span>
          <h2>Marka bilgileri</h2>
          <p className="caption">
            Logo, renk ve depo konumu sipariş ve teslimat ekranlarında görünür.
          </p>
        </div>
        <button
          type="button"
          className="button-secondary admin-inline-button"
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "Marka bilgilerini kapat" : "Marka bilgilerini aç"}
        </button>
      </div>

      {isOpen ? (
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

          <label className="product-form-wide">
            Hero görsel URL
            <input
              value={heroImageUrl}
              onChange={(event) => setHeroImageUrl(event.target.value)}
              placeholder="https://... veya /banner.svg"
              disabled={isSaving}
            />
          </label>

          <label>
            Depo adı
            <input
              value={depotName}
              onChange={(event) => setDepotName(event.target.value)}
              placeholder="Örn. Merkez depo"
              disabled={isSaving}
            />
          </label>

          <label className="product-form-wide">
            Depo konumu
            <input
              value={depotAddress}
              onChange={(event) => setDepotAddress(event.target.value)}
              placeholder="100. Yıl Mah. 1526. Cad. No: 12 Çankaya / Ankara"
              disabled={isSaving}
            />
            <span className="caption">Kurye rotaları bu adresten başlasın.</span>
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
            {heroImageUrl ? (
              <div className="branding-hero-preview">
                <img src={heroImageUrl} alt="Hero görsel önizleme" />
              </div>
            ) : null}
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
      ) : null}
    </section>
  );
}
