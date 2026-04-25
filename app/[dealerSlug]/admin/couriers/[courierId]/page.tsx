import Link from "next/link";
import { notFound } from "next/navigation";
import {
  buildGoogleMapsDirectionsUrl,
  buildGoogleMapsSearchUrl,
  buildMapQuery,
  buildWhatsAppRouteShareUrl,
  formatAddressMeta,
  shouldShowAddressQualityWarning,
  type AddressQualityStatus
} from "@/src/lib/address";
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

function orderStatusLabel(status: Order["status"]) {
  switch (status) {
    case "preparing":
      return "Hazırlanıyor";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    case "confirmed":
      return "Onaylandı";
    case "delivering":
      return "Dağıtımda";
    case "pending":
    default:
      return "Yeni";
  }
}

function paymentMethodLabel(method: Order["payments"][number]["method"]) {
  switch (method) {
    case "cash-on-delivery":
      return "Kapıda nakit";
    case "card-on-delivery":
      return "Kapıda kart";
    case "online":
      return "Online";
    default:
      return method;
  }
}

function paymentStatusClass(status: Order["payments"][number]["status"]) {
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

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function addressQualityLabel(status: AddressQualityStatus) {
  switch (status) {
    case "verified":
      return "Adres uygun";
    case "failed":
      return "Adres doğrulaması zayıf";
    case "partial":
    default:
      return "Kontrol edilmeli";
  }
}

function addressQualityClass(status: AddressQualityStatus) {
  switch (status) {
    case "verified":
      return "address-quality-verified";
    case "failed":
      return "address-quality-failed";
    case "partial":
    default:
      return "address-quality-partial";
  }
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
      order.addressLineNormalized ?? order.addressLine
    ]
      .filter(Boolean)
      .join("|")
      .toLocaleLowerCase("tr-TR");
    const mapQuery = buildMapQuery(order.deliveryAddress, {
      normalizedAddressLine: order.addressLineNormalized ?? order.addressLine,
      rawAddressLine: order.addressLineRaw ?? order.addressLine,
      city: dealer.city
    });
    const existing = groupedStopsMap.get(key);

    if (existing) {
      existing.orders.push(order);
      existing.totalCents += getOrderTotal(order);
      continue;
    }

    groupedStopsMap.set(key, {
      key,
      label: order.addressLineNormalized ?? order.addressLine,
      areaLabel: formatAddressMeta(order.deliveryAddress),
      mapQuery,
      orders: [order],
      totalCents: getOrderTotal(order)
    });
  }

  const groupedStops = [...groupedStopsMap.values()].sort((left, right) =>
    `${left.areaLabel} ${left.label}`.localeCompare(`${right.areaLabel} ${right.label}`, "tr")
  );
  const directionsUrl = buildGoogleMapsDirectionsUrl(groupedStops.map((stop) => stop.mapQuery));
  const whatsappUrl = buildWhatsAppRouteShareUrl(courier.phone, directionsUrl);

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Teslimat listesi</span>
            <h1>{courier.fullName}</h1>
            <p className="lead">Durakları hızlıca gözden geçirin ve aktif teslimatları yönetin.</p>
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
          <div className="stats-grid courier-worklist-stats">
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
        <div className="admin-console-head courier-route-head">
          <div>
            <span className="kicker">Rota için hazırla</span>
            <h2>Durak listesi</h2>
            <p className="caption">Duraklar teslimat için gruplanır. Google Maps mevcut konumdan rota başlatır.</p>
          </div>
          <div className="actions">
            {directionsUrl ? (
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="button-secondary">
                Google Maps'te aç
              </a>
            ) : null}
            {whatsappUrl ? (
              <a href={whatsappUrl} target="_blank" rel="noreferrer" className="button">
                WhatsApp ile gönder
              </a>
            ) : (
              <button type="button" className="button" disabled>
                WhatsApp ile gönder
              </button>
            )}
          </div>
        </div>

        {!whatsappUrl ? (
          <div className="note warning">
            {courier.phone?.trim()
              ? "WhatsApp linki için rota oluşturulamadı."
              : "Kurye telefon numarası olmadığı için WhatsApp linki oluşturulamıyor."}
          </div>
        ) : null}

        {groupedStops.length === 0 ? (
          <div className="note">Bu kurye için rota hazırlanacak aktif sipariş yok.</div>
        ) : (
          <div className="route-stop-list">
            {groupedStops.map((stop, index) => (
              <details
                key={stop.key}
                className="order-card compact-stack route-stop-card route-stop-details"
                open={index === 0}
              >
                <summary className="route-stop-summary">
                  <div className="route-stop-summary-main">
                    <div className="route-stop-index">
                      <span className="detail-label">Durak {index + 1}</span>
                    </div>
                    <div className="route-stop-copy">
                      <strong>{stop.label}</strong>
                      <span className="caption">{stop.areaLabel || "Adres özeti yok"}</span>
                    </div>
                  </div>
                  <div className="route-stop-summary-meta">
                    <div className="compact-meta-item compact-meta-item-inline">
                      <span className="detail-label">Sipariş</span>
                      <strong>{stop.orders.length}</strong>
                    </div>
                    <div className="compact-meta-item compact-meta-item-inline">
                      <span className="detail-label">Tutar</span>
                      <strong>{formatCurrency(stop.totalCents)}</strong>
                    </div>
                  </div>
                  <span className="route-stop-summary-toggle">
                    {index === 0 ? "Açık" : "Detay"}
                  </span>
                </summary>

                <div className="route-stop-body stack compact-stack">
                  <div className="route-stop-actions">
                    <a
                      href={buildGoogleMapsSearchUrl(stop.mapQuery)}
                      target="_blank"
                      rel="noreferrer"
                      className="button-secondary admin-inline-button"
                    >
                      Haritada ara
                    </a>
                  </div>

                  <div className="route-stop-orders">
                    {stop.orders.map((order) => {
                      const total = getOrderTotal(order);
                      const primaryPayment = order.payments[0];

                      return (
                        <div key={order.id} className="route-stop-order-row route-stop-order-row-compact">
                          <div className="route-stop-order-main">
                            <strong>{order.customerName}</strong>
                            <span className="caption">{order.phone}</span>
                          </div>
                          <div className="route-stop-order-meta">
                            <span className="caption">{formatOrderTime(order.createdAt)}</span>
                            <strong>{formatCurrency(total)}</strong>
                          </div>
                          <div className="route-stop-order-tags">
                            {primaryPayment ? (
                              <>
                                <span className={`payment-status ${paymentStatusClass(primaryPayment.status)}`}>
                                  {paymentMethodLabel(primaryPayment.method)}
                                </span>
                                <span className={`payment-status ${paymentStatusClass(primaryPayment.status)}`}>
                                  {paymentStatusLabel(primaryPayment.status)}
                                </span>
                              </>
                            ) : null}
                            <span className={`status`}>{orderStatusLabel(order.status)}</span>
                            <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                              {deliveryStatusLabel(order.deliveryStatus)}
                            </span>
                            {shouldShowAddressQualityWarning(order.addressQualityStatus) ? (
                              <span className={`address-quality ${addressQualityClass(order.addressQualityStatus)}`}>
                                {addressQualityLabel(order.addressQualityStatus)}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </details>
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
                          <strong>{order.addressLineNormalized ?? order.addressLine}</strong>
                          {shouldShowAddressQualityWarning(order.addressQualityStatus) ? (
                            <span className={`address-quality ${addressQualityClass(order.addressQualityStatus)}`}>
                              {addressQualityLabel(order.addressQualityStatus)}
                            </span>
                          ) : null}
                          {order.deliveryAddress.addressNote ? (
                            <span className="caption">{order.deliveryAddress.addressNote}</span>
                          ) : null}
                          {order.addressLineRaw && order.addressLineRaw !== order.addressLineNormalized ? (
                            <span className="caption">Girilen adres: {order.addressLineRaw}</span>
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
