import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { listActiveCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

function getBranchTitle(dealer: { slug: string; name: string }) {
  if (dealer.slug === "javsu") {
    return "Javsu 100. Yıl Online Şubesi";
  }

  return `${dealer.name.replace(/\s+Bayi$/i, "")} Online Şubesi`;
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

  const brandStyle = getDealerBrandStyle(dealer.primaryColor);
  const branchTitle = getBranchTitle(dealer);

  return (
    <main className="shell order-shell stack" style={brandStyle}>
      <section className="hero hero-compact order-hero stack">
        {dealer.heroImageUrl ? (
          <div className="dealer-hero-visual">
            <img src={dealer.heroImageUrl} alt={`${dealer.name} hero görseli`} />
          </div>
        ) : null}
        <div className="inline-meta">
          <span className="kicker">Online sipariş</span>
          <span className="pill">{dealer.city ?? "Su teslimatı"}</span>
        </div>
        <div className="stack compact-copy">
          <div className="dealer-brand-row">
            {!dealer.heroImageUrl && dealer.logoUrl ? (
              <img src={dealer.logoUrl} alt={`${dealer.name} logosu`} className="dealer-logo" />
            ) : null}
            <div>
              <h1>{branchTitle}</h1>
              <p className="lead">Hoş geldiniz, siparişinizi birkaç dokunuşla tamamlayın.</p>
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
        products={products}
        campaigns={campaigns}
      />
    </main>
  );
}
