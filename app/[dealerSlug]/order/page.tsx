import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";
import { OrderForm } from "./order-form";

export const dynamic = "force-dynamic";

export default async function DealerOrderPage({
  params
}: {
  params: Promise<{ dealerSlug: string }> | { dealerSlug: string };
}) {
  const { dealerSlug } = await Promise.resolve(params);
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const products = await listProductsForCompany(dealer.id);

  return (
    <main className="shell order-shell stack">
      <section className="hero hero-compact stack">
        <div className="inline-meta">
          <span className="kicker">QR sipariş sayfası</span>
          <span className="pill">{dealer.city ?? "Su teslimatı"}</span>
        </div>
        <div className="stack compact-copy">
          <div>
            <h1>{dealer.name}</h1>
            <p className="lead">
              Su ve içecek siparişinizi birkaç dokunuşla verin. Önce ürünlerinizi seçin,
              sonra telefon numaranızla kayıtlı adresinizi hızlıca kontrol edelim.
            </p>
          </div>
          <div className="tag-row">
            <span className="status">Tahmini teslimat: {dealer.orderLeadTimeMinutes} dk</span>
            {dealer.supportPhone ? <span className="pill">Destek: {dealer.supportPhone}</span> : null}
          </div>
        </div>
      </section>

      <OrderForm dealerSlug={dealer.slug} dealerName={dealer.name} products={products} />
    </main>
  );
}
