import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { listAdminProductsForCompany } from "@/src/server/domain/products/service";
import { CampaignsManager } from "./campaigns-manager";

export const dynamic = "force-dynamic";

export default async function DealerCampaignsAdminPage({
  params
}: {
  params: Promise<{ dealerSlug: string }>;
}) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const [campaigns, products] = await Promise.all([
    listCampaignsForCompany(dealer.id),
    listAdminProductsForCompany(dealer.id)
  ]);

  return (
    <main className="shell admin-shell stack">
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Bayi kampanyaları</span>
            <h1>Kampanyalar</h1>
            <p className="lead">
              Müşteri siparişlerinde otomatik çalışacak kampanyaları yönetin.
            </p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
                Siparişleri gör
              </Link>
              <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
                Ürünleri yönet
              </Link>
            </div>
          </div>
          <div className="stats-grid">
            <div className="metric">
              <div className="metric-value">{campaigns.length}</div>
              <div>Toplam kampanya</div>
            </div>
            <div className="metric">
              <div className="metric-value">
                {campaigns.filter((campaign) => campaign.isActive).length}
              </div>
              <div>Aktif kampanya</div>
            </div>
          </div>
        </div>
      </section>

      <CampaignsManager dealerSlug={dealer.slug} initialCampaigns={campaigns} products={products} />
    </main>
  );
}
