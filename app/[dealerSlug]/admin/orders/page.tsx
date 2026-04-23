import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/src/lib/currency";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listOrdersForCompany } from "@/src/server/domain/orders/service";
import { OrdersManager } from "./orders-manager";

export const dynamic = "force-dynamic";

export default async function DealerOrdersAdminPage({
  params
}: {
  params: Promise<{ dealerSlug: string }>;
}) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const orders = await listOrdersForCompany(dealer.id);
  const pendingOrders = orders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled"
  );
  const pendingAmount = pendingOrders.reduce(
    (sum, order) =>
      sum + order.items.reduce((orderSum, item) => orderSum + item.quantity * item.unitPriceCents, 0),
    0
  );

  return (
    <main className="shell admin-shell stack">
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Sipariş yönetimi</span>
            <h1>Siparişler</h1>
            <p className="lead">
              Gelen siparişleri takip edin, durumlarını güncelleyin ve ödeme bilgisini kontrol edin.
            </p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
                Ürünleri yönet
              </Link>
              <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
                Kampanyaları yönet
              </Link>
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

      <OrdersManager dealerSlug={dealer.slug} initialOrders={orders} />
    </main>
  );
}
