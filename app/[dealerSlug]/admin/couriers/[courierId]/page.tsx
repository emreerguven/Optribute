import Link from "next/link";
import { notFound } from "next/navigation";
import { buildMapQuery, formatAddressMeta } from "@/src/lib/address";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { formatCurrency } from "@/src/lib/currency";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { getCourierForCompany } from "@/src/server/domain/couriers/service";
import { listOrdersForCourier } from "@/src/server/domain/orders/service";
import type { DeliveryStatus, Order } from "@/src/server/domain/types";
import { LogoutButton } from "../../logout-button";

export const dynamic = "force-dynamic";

const STATUS_SECTIONS: Array<{ status: DeliveryStatus; title: string; empty: string }> = [
  {
    status: "assigned",
    title: "Atanan siparişler",
    empty: "Atanan sipariş yok."
  },
  {
    status: "out-for-delivery",
    title: "Dağıtımdaki siparişler",
    empty: "Dağıtıma çıkmış sipariş yok."
  },
  {
    status: "delivered",
    title: "Teslim edilen siparişler",
    empty: "Teslim edilmiş sipariş yok."
  }
];

function getOrderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
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

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function buildSearchUrl(query: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function buildDirectionsUrl(queries: string[]) {
  if (queries.length < 2) {
    return null;
  }

  const origin = queries[0]!;
  const destination = queries[queries.length - 1]!;
  const rest = queries.slice(1);
  const waypoints = rest.slice(0, -1);
  const params = new URLSearchParams({
    api: "1",
    origin,
    destination,
    travelmode: "driving"
  });

  if (waypoints.length > 0) {
    params.set("waypoints", waypoints.join("|"));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function buildDirectionsUrlWithDepot(depotQuery: string | null, stopQueries: string[]) {
  if (depotQuery) {
    if (stopQueries.length === 0) {
      return null;
    }

    const destination = stopQueries[stopQueries.length - 1]!;
    const waypoints = stopQueries.slice(0, -1);
    const params = new URLSearchParams({
      api: "1",
      origin: depotQuery,
      destination,
      travelmode: "driving"
    });

    if (waypoints.length > 0) {
      params.set("waypoints", waypoints.join("|"));
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  return buildDirectionsUrl(stopQueries);
}

export default async function CourierWorklistPage({
  params
}: {
  params: Promise<{ dealerSlug: string; courierId: string }>;
}) {
  const { dealerSlug, courierId } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  await requireAdminPage(dealer);

  const [courier, orders] = await Promise.all([
    getCourierForCompany(dealer.id, courierId),
    listOrdersForCourier(dealer.id, courierId)
  ]);

  if (!courier) {
    notFound();
  }

  const brandStyle = getDealerBrandStyle(dealer.primaryColor);
  const activeOrders = orders.filter(
    (order) => order.deliveryStatus === "assigned" || order.deliveryStatus === "out-for-delivery"
  );
  const groupedStopsMap = new Map<
    string,
    {
      key: string;
      label: string;
      areaLabel: string;
      mapQuery: string;
      orders: Order[];
      totalCents: number;
    }
  >();

  for (const order of activeOrders) {
    const key = [
      order.deliveryAddress.district,
      order.deliveryAddress.neighborhood,
      order.deliveryAddress.street,
      order.deliveryAddress.buildingNo,
      order.deliveryAddress.apartmentNo,
      order.deliveryAddress.siteName,
      order.addressLine
    ]
      .filter(Boolean)
      .join("|")
      .toLocaleLowerCase("tr-TR");
    const mapQuery = buildMapQuery(order.deliveryAddress, order.addressLine, dealer.city);
    const existing = groupedStopsMap.get(key);

    if (existing) {
      existing.orders.push(order);
      existing.totalCents += getOrderTotal(order);
      continue;
    }

    groupedStopsMap.set(key, {
      key,
      label: order.addressLine,
      areaLabel: formatAddressMeta(order.deliveryAddress),
      mapQuery,
      orders: [order],
      totalCents: getOrderTotal(order)
    });
  }

  const groupedStops = [...groupedStopsMap.values()].sort((left, right) =>
    `${left.areaLabel} ${left.label}`.localeCompare(`${right.areaLabel} ${right.label}`, "tr")
  );
  const depotQuery = dealer.depotAddress?.trim() || null;
  const directionsUrl = buildDirectionsUrlWithDepot(
    depotQuery,
    groupedStops.map((stop) => stop.mapQuery)
  );

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Teslimat listesi</span>
            <h1>{courier.fullName}</h1>
            <p className="lead">Kurye üzerindeki siparişleri izleyin ve rota için hazır durak listesini kullanın.</p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
                Kuryelere dön
              </Link>
              <Link href={`/${dealer.slug}/admin/orders?courier=${courier.id}`} className="button-secondary">
                Siparişleri gör
              </Link>
              <LogoutButton dealerSlug={dealer.slug} />
            </div>
          </div>
          <div className="stats-grid">
            <div className="metric">
              <div className="metric-value">{activeOrders.length}</div>
              <div>Aktif teslimat</div>
            </div>
            <div className="metric">
              <div className="metric-value">{groupedStops.length}</div>
              <div>Durak sayısı</div>
            </div>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div className="admin-console-head">
          <div>
            <span className="kicker">Rota için hazırla</span>
            <h2>Durak listesi</h2>
            <p className="caption">Sıralama optimize edilmez; aktif siparişler teslimat duraklarına göre gruplanır.</p>
          </div>
          {directionsUrl ? (
            <a href={directionsUrl} target="_blank" rel="noreferrer" className="button-secondary">
              Google Maps'te sırayla aç
            </a>
          ) : null}
        </div>

        {depotQuery ? (
          <div className="summary-card compact-stack">
            <span className="detail-label">Başlangıç noktası</span>
            <strong>{dealer.depotName?.trim() || "Depo"}</strong>
            <span>{depotQuery}</span>
          </div>
        ) : null}

        {groupedStops.length === 0 ? (
          <div className="note">Bu kurye için rota hazırlanacak aktif sipariş yok.</div>
        ) : (
          <div className="route-stop-list">
            {groupedStops.map((stop, index) => (
              <article key={stop.key} className="order-card stack compact-stack route-stop-card">
                <div className="order-topline">
                  <div>
                    <span className="detail-label">Durak {index + 1}</span>
                    <h3>{stop.label}</h3>
                    <p className="caption">{stop.areaLabel || "Adres özeti yok"}</p>
                  </div>
                  <a href={buildSearchUrl(stop.mapQuery)} target="_blank" rel="noreferrer" className="button-secondary admin-inline-button">
                    Haritada ara
                  </a>
                </div>
                <div className="summary-row">
                  <span>Sipariş adedi</span>
                  <strong>{stop.orders.length}</strong>
                </div>
                <div className="summary-row">
                  <span>Toplam tutar</span>
                  <strong>{formatCurrency(stop.totalCents)}</strong>
                </div>
                <div className="stack compact-stack">
                  {stop.orders.map((order) => (
                    <div key={order.id} className="route-stop-order-row">
                      <div>
                        <strong>{order.customerName}</strong>
                        <p className="caption">{order.phone}</p>
                      </div>
                      <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                        {deliveryStatusLabel(order.deliveryStatus)}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {STATUS_SECTIONS.map((section) => {
        const sectionOrders = orders.filter((order) => order.deliveryStatus === section.status);

        return (
          <section key={section.status} className="panel stack">
            <div>
              <span className="kicker">Kurye listesi</span>
              <h2>{section.title}</h2>
            </div>

            {sectionOrders.length === 0 ? (
              <div className="note">{section.empty}</div>
            ) : (
              <div className="admin-order-list">
                {sectionOrders.map((order) => {
                  const total = getOrderTotal(order);
                  const primaryPayment = order.payments[0];

                  return (
                    <article key={order.id} className="order-card stack compact-stack">
                      <div className="order-topline">
                        <div>
                          <span className="caption">Sipariş zamanı</span>
                          <h3>{formatOrderTime(order.createdAt)}</h3>
                        </div>
                        <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                          {deliveryStatusLabel(order.deliveryStatus)}
                        </span>
                      </div>

                      <div className="admin-detail-grid">
                        <div className="detail-block">
                          <span className="detail-label">Müşteri</span>
                          <strong>{order.customerName}</strong>
                          <span className="caption">{order.phone}</span>
                        </div>
                        <div className="detail-block detail-block-wide">
                          <span className="detail-label">Teslimat adresi</span>
                          <strong>{order.addressLine}</strong>
                          {order.deliveryAddress.addressNote ? (
                            <span className="caption">{order.deliveryAddress.addressNote}</span>
                          ) : null}
                        </div>
                        <div className="detail-block">
                          <span className="detail-label">Tutar</span>
                          <strong>{formatCurrency(total)}</strong>
                          <span className="caption">
                            {primaryPayment ? paymentStatusLabel(primaryPayment.status) : "Ödeme bekliyor"}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}

function paymentStatusLabel(status: Order["payments"][number]["status"]) {
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
