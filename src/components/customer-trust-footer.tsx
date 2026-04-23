import Link from "next/link";

export function CustomerTrustFooter({
  supportPhone,
  companyLabel = "optribute"
}: {
  supportPhone?: string | null;
  companyLabel?: string;
}) {
  return (
    <section className="panel trust-footer-panel stack compact-stack">
      <p className="caption">
        Sipariş ve teslimat bilgileri yalnızca hizmetin yürütülmesi için kullanılır.
        <Link href="/aydinlatma-metni" className="inline-link legal-link">
          Aydınlatma Metni
        </Link>
      </p>
      <div className="tag-row">
        <span className="pill">Güvenli sipariş akışı</span>
        {supportPhone ? <span className="pill">İletişim: {supportPhone}</span> : null}
        <span className="caption trust-footer-caption">{companyLabel}</span>
      </div>
    </section>
  );
}
