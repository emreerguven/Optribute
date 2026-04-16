import Link from "next/link";
import { notFound } from "next/navigation";
import { formatCurrency } from "@/src/lib/currency";
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

export default async function OrderSuccessPage({
  params,
  searchParams
}: {
  params: Promise<{ dealerSlug: string }> | { dealerSlug: string };
  searchParams:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const { dealerSlug } = await Promise.resolve(params);
  const query = await Promise.resolve(searchParams);
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    notFound();
  }

  const orderId = readValue(query.orderId);
  const customerName = readValue(query.customerName, "Müşteri");
  const total = Number(readValue(query.total, "0"));
  const paymentMethod = readValue(query.paymentMethod, "cash-on-delivery");
  const itemCount = Number(readValue(query.itemCount, "0"));

  return (
    <main className="shell success-shell stack">
      <section className="hero hero-compact stack">
        <div className="success-badge">Sipariş alındı</div>
        <div className="stack compact-copy">
          <div>
            <h1>Teşekkürler, {customerName}.</h1>
            <p className="lead">
              {dealer.name} siparişinizi aldı. Bayi ekibi siparişi şimdi ekranında görüp
              teslimata hazırlayabilir.
            </p>
          </div>
          <div className="tag-row">
            <span className="status">Referans: {orderId || "Bekleniyor"}</span>
            <span className="pill">Tahmini teslimat: {dealer.orderLeadTimeMinutes} dk</span>
          </div>
        </div>
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">Sipariş özeti</span>
          <h2>Her şey hazır</h2>
        </div>

        <div className="summary-card stack">
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

        <div className="note">
          Bayinin ek bilgiye ihtiyacı olursa, siparişte kullandığınız telefon numarasından
          sizinle iletişime geçecektir.
        </div>

        <div className="actions">
          <Link href={`/${dealer.slug}/order`} className="button">
            Yeni sipariş ver
          </Link>
        </div>
      </section>
    </main>
  );
}
