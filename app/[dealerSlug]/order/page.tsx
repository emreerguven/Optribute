import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { listActiveCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

function getBrandStyle(primaryColor: string | null): CSSProperties | undefined {
  if (!primaryColor || !/^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
    return undefined;
  }

  return {
    "--color-primary": primaryColor,
    "--color-primary-strong": primaryColor,
    "--color-primary-soft": `color-mix(in srgb, ${primaryColor} 10%, white)`,
    "--color-primary-softer": `color-mix(in srgb, ${primaryColor} 6%, white)`,
    "--color-primary-border": `color-mix(in srgb, ${primaryColor} 38%, transparent)`,
    "--color-primary-shadow": `color-mix(in srgb, ${primaryColor} 20%, transparent)`
  } as CSSProperties;
}

export default async function DealerOrderPage({
  params
}: {
  params: Promise<{ dealerSlug: string }>;
}) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const [products, campaigns] = await Promise.all([
    listProductsForCompany(dealer.id),
    listActiveCampaignsForCompany(dealer.id)
  ]);

  const brandStyle = getBrandStyle(dealer.primaryColor);

  return (
    <main className="shell order-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="inline-meta">
          <span className="kicker">Online sipariş</span>
          <span className="pill">{dealer.city ?? "Su teslimatı"}</span>
        </div>
        <div className="stack compact-copy">
          <div className="dealer-brand-row">
            {dealer.logoUrl ? (
              <img src={dealer.logoUrl} alt={`${dealer.name} logosu`} className="dealer-logo" />
            ) : null}
            <div>
              <h1>{dealer.name} Online Şubesine Hoş Geldiniz</h1>
              <p className="lead">
                Su ve içecek siparişinizi birkaç dokunuşla verin. Önce ürünlerinizi seçin,
                sonra telefon numaranızla kayıtlı adresinizi hızlıca kontrol edelim.
              </p>
            </div>
          </div>
          <div className="tag-row">
            <span className="status">Tahmini teslimat: {dealer.orderLeadTimeMinutes} dk</span>
            {dealer.supportPhone ? <span className="pill">Destek: {dealer.supportPhone}</span> : null}
          </div>
        </div>
      </section>

      <OrderForm
        dealerSlug={dealer.slug}
        dealerName={dealer.name}
        products={products}
        campaigns={campaigns}
      />
    </main>
  );
}
