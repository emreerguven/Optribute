import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { formatCurrency } from "@/src/lib/currency";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { AdminBrandHeader } from "@/src/components/admin-brand-header";
import {
  getDealerDashboardSnapshot,
} from "@/src/server/domain/dashboard/service";
import type { DeliveryStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/src/server/domain/types";
import { LogoutButton } from "../logout-button";
import { TrendChartCard } from "./trend-chart-card";

export const dynamic = "force-dynamic";

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function paymentMethodLabel(method: PaymentMethod) {
  switch (method) {
    case "cash-on-delivery":
      return "Kapıda nakit";
    case "card-on-delivery":
      return "Kapıda kart";
    case "online":
      return "Online";
  }
}

function paymentStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "Ödendi";
    case "failed":
      return "Ödeme alınamadı";
    case "cancelled":
      return "İptal";
    case "pending":
    default:
      return "Bekliyor";
  }
}

function paymentStatusClass(status: PaymentStatus) {
  switch (status) {
    case "paid":
      return "payment-status-paid";
    case "failed":
    case "cancelled":
      return "payment-status-failed";
    case "pending":
    default:
      return "payment-status-pending";
  }
}

function orderStatusLabel(status: OrderStatus) {
  switch (status) {
    case "pending":
      return "Yeni";
    case "confirmed":
      return "Onaylandı";
    case "preparing":
      return "Hazırlanıyor";
    case "delivering":
      return "Dağıtımda";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
  }
}

function deliveryStatusLabel(status: DeliveryStatus) {
  switch (status) {
    case "assigned":
      return "Atandı";
    case "out-for-delivery":
      return "Dağıtıma çıktı";
    case "delivered":
      return "Teslim edildi";
    case "unassigned":
    default:
      return "Atanmadı";
  }
}

function deliveryStatusClass(status: DeliveryStatus) {
  switch (status) {
    case "assigned":
      return "delivery-status-assigned";
    case "out-for-delivery":
      return "delivery-status-out";
    case "delivered":
      return "delivery-status-delivered";
    case "unassigned":
    default:
      return "delivery-status-unassigned";
  }
}

function getOrderTotalCents(order: { items: Array<{ quantity: number; unitPriceCents: number }> }) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

export default async function DealerDashboardPage({
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

  const snapshot = await getDealerDashboardSnapshot(dealer.id, {
    timeZone: "Europe/Istanbul"
  });
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);
  const todayOrdersHref = `/${dealer.slug}/admin/orders?today=1`;

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <AdminBrandHeader
        dealer={dealer}
        kicker="Genel görünüm"
        title="Dashboard"
        description="Bugünkü sipariş akışını, ödeme görünümünü ve kurye yükünü tek ekranda izleyin."
        actions={
          <>
            <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
              Siparişler
            </Link>
            <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
              Ürünler
            </Link>
            <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
              Kampanyalar
            </Link>
            <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
              Kuryeler
            </Link>
            <LogoutButton dealerSlug={dealer.slug} />
          </>
        }
        summary={
          <>
            <Link href={todayOrdersHref} className="metric metric-link">
              <div className="metric-label">Bugün</div>
              <div className="metric-value">{snapshot.todayOrdersCount}</div>
              <div>Bugünkü siparişler</div>
            </Link>
            <Link href={todayOrdersHref} className="metric metric-link">
              <div className="metric-label">Bugün</div>
              <div className="metric-value">{formatCurrency(snapshot.todayRevenueCents)}</div>
              <div>Bugünkü ciro</div>
            </Link>
            <Link href={`/${dealer.slug}/admin/orders?delivery=unassigned`} className="metric metric-link">
              <div className="metric-label">Canlı operasyon</div>
              <div className="metric-value">{snapshot.unassignedOrdersCount}</div>
              <div>Atanmamış siparişler</div>
            </Link>
            <Link
              href={`/${dealer.slug}/admin/orders?delivery=out-for-delivery`}
              className="metric metric-link"
            >
              <div className="metric-label">Canlı operasyon</div>
              <div className="metric-value">{snapshot.outForDeliveryOrdersCount}</div>
              <div>Dağıtımdaki siparişler</div>
            </Link>
          </>
        }
      />

      <section className="dashboard-grid">
        <article className="panel stack dashboard-card dashboard-card-wide">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Son 30 gün</span>
              <h2>Trend görünümü</h2>
            </div>
            <span className="caption">Sipariş ve ciro akışını günlük olarak izleyin.</span>
          </div>
          <div className="dashboard-trend-grid">
            <TrendChartCard title="Sipariş sayısı" series={snapshot.trend} mode="orders" />
            <TrendChartCard title="Ciro" series={snapshot.trend} mode="revenue" />
          </div>
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Bugün</span>
              <h2>En çok satılan ürünler</h2>
            </div>
          </div>
          {snapshot.topProducts.length > 0 ? (
            <div className="dashboard-list">
              {snapshot.topProducts.map((product, index) => (
                <Link
                  key={`${product.name}-${index}`}
                  href={`/${dealer.slug}/admin/products`}
                  className="dashboard-list-row dashboard-list-link"
                >
                  <div>
                    <strong>{product.name}</strong>
                  </div>
                  <span className="dashboard-strong">{product.quantity} adet</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Bugün için ürün hareketi henüz görünmüyor.</p>
          )}
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Bugün</span>
              <h2>Ödeme dağılımı</h2>
            </div>
          </div>
          <div className="dashboard-split-list">
            <div className="summary-card stack">
              <span className="detail-label">Yöntem</span>
              {snapshot.paymentMethodDistribution.length > 0 ? (
                snapshot.paymentMethodDistribution.map((entry) => (
                  <div key={entry.key} className="dashboard-list-row">
                    <span>{paymentMethodLabel(entry.key)}</span>
                    <strong>{entry.count}</strong>
                  </div>
                ))
              ) : (
                <p className="caption">Bugün ödeme kaydı oluşmadı.</p>
              )}
            </div>
            <div className="summary-card stack">
              <span className="detail-label">Durum</span>
              {snapshot.paymentStatusDistribution.length > 0 ? (
                snapshot.paymentStatusDistribution.map((entry) => (
                  <div key={entry.key} className="dashboard-list-row">
                    <span>{paymentStatusLabel(entry.key)}</span>
                    <span className={`status ${paymentStatusClass(entry.key)}`}>{entry.count}</span>
                  </div>
                ))
              ) : (
                <p className="caption">Bugün ödeme durumu kaydı oluşmadı.</p>
              )}
            </div>
          </div>
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Canlı operasyon</span>
              <h2>Kurye iş yükü</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
              Kuryelere git
            </Link>
          </div>
          {snapshot.courierWorkloads.length > 0 ? (
            <div className="dashboard-list">
              {snapshot.courierWorkloads.map((entry) => (
                <Link
                  key={entry.courier.id}
                  href={`/${dealer.slug}/admin/couriers/${entry.courier.id}`}
                  className="dashboard-list-row dashboard-list-row-spread dashboard-list-link"
                >
                  <div className="stack-tight">
                    <strong>{entry.courier.fullName}</strong>
                    <span className="caption">{entry.courier.phone}</span>
                  </div>
                  <div className="dashboard-inline-stats">
                    <span className="status">{entry.activeOrdersCount} aktif</span>
                    <span className="caption">Atandı {entry.assignedCount}</span>
                    <span className="caption">Dağıtımda {entry.outForDeliveryCount}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Aktif kurye görünmüyor.</p>
          )}
        </article>

        <article className="panel stack dashboard-card dashboard-card-wide">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Canlı akış</span>
              <h2>Son siparişler</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
              Siparişlere git
            </Link>
          </div>
          {snapshot.recentOrders.length > 0 ? (
            <div className="dashboard-recent-list">
              {snapshot.recentOrders.map((order) => {
                const primaryPayment = order.payments[0] ?? null;

                return (
                  <Link
                    key={order.id}
                    href={`/${dealer.slug}/admin/orders?order=${order.id}`}
                    className="dashboard-recent-row dashboard-list-link"
                  >
                    <div className="stack-tight">
                      <strong>{order.customerName}</strong>
                      <span className="caption">{order.phone}</span>
                    </div>
                    <span className="dashboard-strong">{formatCurrency(getOrderTotalCents(order))}</span>
                    <div className="dashboard-inline-stats">
                      <span className="status">{orderStatusLabel(order.status)}</span>
                      <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                        {deliveryStatusLabel(order.deliveryStatus)}
                      </span>
                      {primaryPayment ? (
                        <span className={`status ${paymentStatusClass(primaryPayment.status)}`}>
                          {paymentMethodLabel(primaryPayment.method)} • {paymentStatusLabel(primaryPayment.status)}
                        </span>
                      ) : null}
                    </div>
                    <span className="caption">{formatOrderTime(order.createdAt)}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="caption">Henüz sipariş görünmüyor.</p>
          )}
        </article>
      </section>

      <section className="panel dashboard-footnote">
        <span className="kicker">Veri kapsamı</span>
        <p className="caption">
          Bugünkü metrikler {snapshot.todayDateLabel} tarihine göre hesaplanır. Kurye iş yükü ve teslimat
          sayıları ise anlık açık sipariş durumlarını gösterir.
        </p>
      </section>
    </main>
  );
}
