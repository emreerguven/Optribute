import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { listAdminProductsForCompany } from "@/src/server/domain/products/service";
import { LogoutButton } from "../logout-button";
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

  await requireAdminPage(dealer);

  const [campaigns, products] = await Promise.all([
    listCampaignsForCompany(dealer.id),
    listAdminProductsForCompany(dealer.id)
  ]);
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Bayi kampanyaları</span>
            <h1>Kampanyalar</h1>
            <p className="lead">Siparişlerde otomatik çalışacak kampanyaları yönetin.</p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
                Siparişleri gör
              </Link>
              <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
                Ürünleri yönet
              </Link>
              <LogoutButton dealerSlug={dealer.slug} />
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
