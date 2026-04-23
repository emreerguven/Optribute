import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/src/lib/currency";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { requireAdminPage } from "@/src/server/auth/guards";
import { listActiveCampaignsForCompany } from "@/src/server/domain/campaigns/service";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listCouriersForCompany } from "@/src/server/domain/couriers/service";
import { getOperationalOrders } from "@/src/server/domain/orders/retention";
import { listOrdersForCompany } from "@/src/server/domain/orders/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";
import { LogoutButton } from "../logout-button";
import { OrdersManager } from "./orders-manager";

export const dynamic = "force-dynamic";

export default async function DealerOrdersAdminPage({
  params,
  searchParams
}: {
  params: Promise<{ dealerSlug: string }>;
  searchParams: Promise<{ courier?: string }>;
}) {
  const { dealerSlug } = await params;
  const { courier } = await searchParams;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  await requireAdminPage(dealer);

  const [orders, products, campaigns, couriers] = await Promise.all([
    listOrdersForCompany(dealer.id),
    listProductsForCompany(dealer.id),
    listActiveCampaignsForCompany(dealer.id),
    listCouriersForCompany(dealer.id)
  ]);
  const pendingOrders = getOperationalOrders(orders);
  const pendingAmount = pendingOrders.reduce(
    (sum, order) =>
      sum + order.items.reduce((orderSum, item) => orderSum + item.quantity * item.unitPriceCents, 0),
    0
  );
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Sipariş yönetimi</span>
            <h1>Siparişler</h1>
            <p className="lead">Gelen siparişleri takip edin ve durumlarını güncelleyin.</p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/dashboard`} className="button-secondary">
                Dashboard
              </Link>
              <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
                Ürünleri yönet
              </Link>
              <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
                Kampanyaları yönet
              </Link>
              <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
                Kuryeleri yönet
              </Link>
              <LogoutButton dealerSlug={dealer.slug} />
            </div>
          </div>
          <div className="stats-grid">
            <div className="metric">
              <div className="metric-value">{pendingOrders.length}</div>
              <div>Bekleyen sipariş</div>
            </div>
            <div className="metric">
              <div className="metric-value">{formatCurrency(pendingAmount)}</div>
              <div>Bekleyen tutar</div>
            </div>
          </div>
        </div>
      </section>

      <OrdersManager
        dealerSlug={dealer.slug}
        initialOrders={orders}
        products={products}
        campaigns={campaigns}
        couriers={couriers}
        initialCourierFilter={courier ?? "all"}
      />
    </main>
  );
}
