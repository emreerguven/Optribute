import Link from "next/link";

export const dynamic = "force-dynamic";

const sections = [
  {
    title: "Hangi bilgileri alıyoruz",
    body:
      "Sipariş sırasında ad, telefon numarası, teslimat adresi, sipariş notu ve ödeme yöntemine ilişkin temel bilgileri alabiliriz. Yönetim tarafında bu bilgiler siparişin hazırlanması ve teslimatı için görüntülenir."
  },
  {
    title: "Bu bilgileri neden kullanıyoruz",
    body:
      "Bilgileriniz siparişin alınması, teslimatın planlanması, gerektiğinde sizinle iletişime geçilmesi ve hizmet kalitesinin korunması için kullanılır."
  },
  {
    title: "Kimlerle paylaşılabilir",
    body:
      "Bilgiler, siparişi teslim edecek bayi ekibi ve gerekli operasyon süreçleriyle sınırlı olarak paylaşılabilir. Yasal yükümlülükler doğarsa ilgili kurumlarla paylaşım gerekebilir."
  },
  {
    title: "Ne kadar süre saklanabilir",
    body:
      "Sipariş kayıtları operasyonun takibi, müşteri desteği ve yasal yükümlülükler için belirli bir süre saklanabilir. Tam saklama süreleri bayi ve mevzuat ihtiyaçlarına göre netleştirilecektir."
  },
  {
    title: "Haklarınız",
    body:
      "Kendi verileriniz hakkında bilgi talep etme, düzeltilmesini isteme ve mevzuatın tanıdığı diğer hakları kullanma imkanınız bulunabilir."
  },
  {
    title: "İletişim",
    body:
      "Sorularınız için sipariş verdiğiniz bayiyle veya ileride burada yer alacak resmi iletişim kanallarıyla iletişime geçebilirsiniz."
  }
];

export default function PrivacyNoticePage() {
  return (
    <main className="shell order-shell stack legal-page-shell">
      <section className="hero hero-compact stack legal-hero">
        <span className="kicker">Aydınlatma Metni</span>
        <h1>Aydınlatma Metni</h1>
        <p className="lead">
          Bu sayfa, sipariş sırasında paylaşılan bilgilerin hangi amaçlarla kullanılabileceğini sade bir dille açıklar.
        </p>
        <p className="caption">
          Bu metin MVP aşaması için hazırlanmış ürün içi açıklama taslağıdır. Nihai hukuki metin, gerçek şirket ve iletişim bilgileriyle birlikte güncellenmelidir.
        </p>
      </section>

      <section className="panel stack legal-sections">
        {sections.map((section) => (
          <article key={section.title} className="legal-section stack compact-stack">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </section>

      <section className="panel stack compact-stack legal-footer-panel">
        <p className="caption">
          Bu sayfadaki şirket unvanı, iletişim kişisi, resmi adres ve saklama süreleri daha sonra gerçek bayi / platform bilgileriyle güncellenmelidir.
        </p>
        <div className="actions">
          <Link href="/" className="button-secondary">
            Ana sayfaya dön
          </Link>
        </div>
      </section>
    </main>
  );
}
