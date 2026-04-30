import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminBrandHeader } from "@/src/components/admin-brand-header";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { formatCurrency } from "@/src/lib/currency";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listCouriersForCompany } from "@/src/server/domain/couriers/service";
import { getOperationalOrders } from "@/src/server/domain/orders/retention";
import { listOrdersForCompany } from "@/src/server/domain/orders/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";
import type { CollectionStatus, DeliveryStatus, Order } from "@/src/server/domain/types";
import { LogoutButton } from "../logout-button";

export const dynamic = "force-dynamic";

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getTodayKey(date: Date, timeZone = "Europe/Istanbul") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function getOrderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

function orderStatusLabel(status: Order["status"]) {
  switch (status) {
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
    case "pending":
    default:
      return "Yeni";
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

function collectionStatusLabel(status: CollectionStatus) {
  switch (status) {
    case "paid":
      return "Ödendi";
    case "on-account":
      return "Veresiye";
    case "pending":
    default:
      return "Bekliyor";
  }
}

function collectionStatusClass(status: CollectionStatus) {
  switch (status) {
    case "paid":
      return "collection-status-paid";
    case "on-account":
      return "collection-status-on-account";
    case "pending":
    default:
      return "collection-status-pending";
  }
}

function workloadLabel(activeOrdersCount: number) {
  if (activeOrdersCount === 0) {
    return "Boş";
  }

  if (activeOrdersCount <= 3) {
    return "Normal";
  }

  return "Yoğun";
}

export default async function CommandCenterPage({
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

  const [orders, couriers, products] = await Promise.all([
    listOrdersForCompany(dealer.id),
    listCouriersForCompany(dealer.id),
    listProductsForCompany(dealer.id)
  ]);

  const brandStyle = getDealerBrandStyle(dealer.primaryColor);
  const todayKey = getTodayKey(new Date());
  const todayOrders = orders.filter((order) => getTodayKey(new Date(order.createdAt)) === todayKey);
  const activeTodayOrders = getOperationalOrders(todayOrders).slice(0, 8);
  const currentActiveOrders = getOperationalOrders(orders);
  const activeCouriers = couriers.filter((courier) => courier.isActive);
  const activeCourierCount = activeCouriers.length;
  const openBalanceCents = orders.reduce((sum, order) => {
    if (order.status === "cancelled" || order.collectionStatus === "paid") {
      return sum;
    }

    return sum + (order.payments[0]?.amountCents ?? getOrderTotal(order));
  }, 0);

  const collectionSummary = [
    {
      key: "paid" as const,
      label: "Ödendi",
      count: todayOrders.filter((order) => order.collectionStatus === "paid").length,
      amountCents: todayOrders
        .filter((order) => order.collectionStatus === "paid")
        .reduce((sum, order) => sum + getOrderTotal(order), 0)
    },
    {
      key: "pending" as const,
      label: "Bekliyor",
      count: todayOrders.filter((order) => order.collectionStatus === "pending").length,
      amountCents: todayOrders
        .filter((order) => order.collectionStatus === "pending")
        .reduce((sum, order) => sum + getOrderTotal(order), 0)
    },
    {
      key: "on-account" as const,
      label: "Veresiye",
      count: todayOrders.filter((order) => order.collectionStatus === "on-account").length,
      amountCents: todayOrders
        .filter((order) => order.collectionStatus === "on-account")
        .reduce((sum, order) => sum + getOrderTotal(order), 0)
    }
  ];

  const courierSnapshot = activeCouriers
    .map((courier) => {
      const activeOrdersCount = currentActiveOrders.filter((order) => order.courier?.id === courier.id).length;

      return {
        courier,
        activeOrdersCount,
        label: workloadLabel(activeOrdersCount)
      };
    })
    .sort(
      (left, right) =>
        right.activeOrdersCount - left.activeOrdersCount ||
        left.courier.fullName.localeCompare(right.courier.fullName, "tr")
    );

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <AdminBrandHeader
        dealer={dealer}
        kicker="Günlük operasyon"
        title="Operasyon Merkezi"
        description="Bugünkü sipariş, kurye ve tahsilat akışını tek ekrandan takip edin."
        actions={
          <>
            <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
              Siparişler
            </Link>
            <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
              Ürünler
            </Link>
            <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
              Kuryeler
            </Link>
            <Link href={`/${dealer.slug}/admin/dashboard`} className="button-secondary">
              Dashboard
            </Link>
            <LogoutButton dealerSlug={dealer.slug} />
          </>
        }
        summary={
          <>
            <div className="metric">
              <div className="metric-value">{activeTodayOrders.length}</div>
              <div>Bugünkü aktif sipariş</div>
            </div>
            <div className="metric">
              <div className="metric-value">{activeCourierCount}</div>
              <div>Aktif kurye</div>
            </div>
            <div className="metric">
              <div className="metric-value">{collectionSummary.find((item) => item.key === "on-account")?.count ?? 0}</div>
              <div>Veresiye sipariş</div>
            </div>
            <div className="metric">
              <div className="metric-value">{formatCurrency(openBalanceCents)}</div>
              <div>Açık bakiye</div>
            </div>
          </>
        }
      />

      <section className="dashboard-grid">
        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Hızlı giriş</span>
              <h2>Telefonla hızlı sipariş</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/orders?compose=1`} className="button">
              Telefon siparişi başlat
            </Link>
          </div>
          <p className="caption">
            Telefon numarasıyla müşteri bulup son siparişi hızlıca tekrar edebilirsiniz.
          </p>
        </article>

        <article className="panel stack dashboard-card dashboard-card-wide">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Bugün</span>
              <h2>Bugünkü aktif siparişler</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/orders?today=1`} className="button-secondary">
              Tüm siparişleri gör
            </Link>
          </div>
          {activeTodayOrders.length > 0 ? (
            <div className="dashboard-list">
              {activeTodayOrders.map((order) => (
                <Link
                  key={order.id}
                  href={`/${dealer.slug}/admin/orders?order=${order.id}&today=1`}
                  className="dashboard-list-row dashboard-list-row-spread dashboard-list-link"
                >
                  <div className="stack-tight">
                    <strong>{order.customerName || order.phone}</strong>
                    <span className="caption">
                      {order.deliveryAddress.neighborhood
                        ? `${order.deliveryAddress.neighborhood} • ${order.addressLine}`
                        : order.addressLine}
                    </span>
                  </div>
                  <div className="dashboard-inline-stats">
                    <span className="caption">{formatOrderTime(order.createdAt)}</span>
                    <span className="status">{orderStatusLabel(order.status)}</span>
                    <span className={`collection-status ${collectionStatusClass(order.collectionStatus)}`}>
                      {collectionStatusLabel(order.collectionStatus)}
                    </span>
                    <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                      {deliveryStatusLabel(order.deliveryStatus)}
                    </span>
                    <span className="caption">{order.courier?.fullName ?? "Kurye atanmadı"}</span>
                    <span className="dashboard-strong">{formatCurrency(getOrderTotal(order))}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Bugün aktif sipariş yok</p>
          )}
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Canlı akış</span>
              <h2>Kurye durumu</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
              Kuryeleri yönet
            </Link>
          </div>
          {courierSnapshot.length > 0 ? (
            <div className="dashboard-list">
              {courierSnapshot.map((entry) => (
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
                    <span className="caption">{entry.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Aktif kurye bulunamadı</p>
          )}
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Bugün</span>
              <h2>Tahsilat özeti</h2>
            </div>
          </div>
          {todayOrders.length > 0 ? (
            <div className="dashboard-list">
              {collectionSummary.map((entry) => (
                <Link
                  key={entry.key}
                  href={`/${dealer.slug}/admin/orders?today=1&collection=${entry.key}`}
                  className="dashboard-list-row dashboard-list-row-spread dashboard-list-link"
                >
                  <span>{entry.label}</span>
                  <div className="dashboard-inline-stats">
                    <span className={`collection-status ${collectionStatusClass(entry.key)}`}>{entry.count}</span>
                    <span className="dashboard-strong">{formatCurrency(entry.amountCents)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Bugün tahsilat kaydı yok</p>
          )}
        </article>

        <article className="panel stack dashboard-card">
          <div className="dashboard-card-head">
            <div>
              <span className="kicker">Ürün görünümü</span>
              <h2>Aktif ürünler</h2>
            </div>
            <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
              Ürünleri yönet
            </Link>
          </div>
          {products.length > 0 ? (
            <div className="dashboard-list">
              {products.slice(0, 6).map((product) => (
                <Link
                  key={product.id}
                  href={`/${dealer.slug}/admin/products`}
                  className="dashboard-list-row dashboard-list-row-spread dashboard-list-link"
                >
                  <div className="stack-tight">
                    <strong>{product.name}</strong>
                    <span className="caption">Aktif ürün</span>
                  </div>
                  <span className="dashboard-strong">{formatCurrency(product.priceCents)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="caption">Aktif ürün bulunamadı</p>
          )}
        </article>
      </section>
    </main>
  );
}
