import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { formatCurrency } from "@/src/lib/currency";
import { CustomerTrustFooter } from "@/src/components/customer-trust-footer";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";

export const dynamic = "force-dynamic";

function readValue(
  value: string | string[] | undefined,
  fallback = ""
) {
  return Array.isArray(value) ? value[0] ?? fallback : value ?? fallback;
}

function paymentLabel(paymentMethod: string) {
  switch (paymentMethod) {
    case "cash-on-delivery":
      return "Kapıda nakit";
    case "card-on-delivery":
      return "Kapıda kart";
    case "online":
      return "Online";
    default:
      return "Ödeme bekleniyor";
  }
}

function paymentStatusCopy(paymentStatus: string) {
  switch (paymentStatus) {
    case "paid":
      return {
        badge: "Ödeme alındı",
        title: "Ödeme alındı",
        message: "Siparişiniz alınmıştır."
      };
    case "failed":
      return {
        badge: "Ödeme başarısız",
        title: "Ödeme başarısız",
        message: "Siparişiniz oluşturuldu, ödeme alınamadı."
      };
    case "pending":
      return {
        badge: "Ödeme kontrol ediliyor",
        title: "Ödeme kontrol ediliyor",
        message: "Siparişiniz alındı, ödeme sonucu bekleniyor."
      };
    default:
      return {
        badge: "Sipariş alındı",
        title: "Her şey hazır",
        message: "Bayinin ek bilgiye ihtiyacı olursa, siparişte kullandığınız telefon numarasından sizinle iletişime geçecektir."
      };
  }
}

function formatOrderReference(orderId: string) {
  const normalized = orderId.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

  if (!normalized) {
    return "";
  }

  return `#${normalized.slice(-5).padStart(5, "0")}`;
}

export default async function OrderSuccessPage({
  params,
  searchParams
}: {
  params: Promise<{ dealerSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { dealerSlug } = await params;
  const query = await searchParams;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const orderId = readValue(query.orderId);
  const customerName = readValue(query.customerName, "Müşteri");
  const total = Number(readValue(query.total, "0"));
  const paymentMethod = readValue(query.paymentMethod, "cash-on-delivery");
  const paymentStatus = readValue(query.paymentStatus);
  const itemCount = Number(readValue(query.itemCount, "0"));
  const statusCopy = paymentStatusCopy(paymentStatus);
  const orderReference = orderId ? formatOrderReference(orderId) : "";
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);

  return (
    <main className="shell success-shell stack" style={brandStyle}>
      <section className="hero hero-compact success-hero stack">
        <div className="success-badge">{statusCopy.badge}</div>
        <div className="stack compact-copy">
          <div className="dealer-brand-row">
            {dealer.logoUrl ? (
              <img src={dealer.logoUrl} alt={`${dealer.name} logosu`} className="dealer-logo" />
            ) : null}
            <div>
              <h1>{paymentStatus ? statusCopy.title : `Teşekkürler, ${customerName}.`}</h1>
              <p className="lead">
                {paymentStatus
                  ? statusCopy.message
                  : `${dealer.name} siparişinizi aldı. Bayi ekibi siparişi şimdi ekranında görüp teslimata hazırlayabilir.`}
              </p>
            </div>
          </div>
          <div className="tag-row">
            {orderReference ? <span className="status">Sipariş no: {orderReference}</span> : null}
            <span className="delivery-pill">Tahmini teslimat: {dealer.orderLeadTimeMinutes} dk</span>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <h2>Sipariş özeti</h2>
        </div>

        <div className="summary-card success-summary-card stack">
          <div className="summary-row">
            <span className="caption">Bayi</span>
            <strong>{dealer.name}</strong>
          </div>
          <div className="summary-row">
            <span className="caption">Ürün sayısı</span>
            <strong>{itemCount} adet</strong>
          </div>
          <div className="summary-row">
            <span className="caption">Ödeme</span>
            <strong>{paymentLabel(paymentMethod)}</strong>
          </div>
          <div className="summary-row total-row">
            <span>Toplam</span>
            <strong>{formatCurrency(Number.isFinite(total) ? total : 0)}</strong>
          </div>
        </div>

        <div className="actions">
          <Link href={`/${dealer.slug}/order`} className="button">
            Yeni sipariş ver
          </Link>
        </div>
      </section>

      <CustomerTrustFooter supportPhone={dealer.supportPhone} companyLabel={dealer.name} />
    </main>
  );
}
