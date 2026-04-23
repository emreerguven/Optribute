import { redirect } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { getAdminUserForCompany } from "@/src/server/auth/admin";
import { getAdminAuthMode } from "@/src/server/auth/config";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  params
}: {
  params: Promise<{ dealerSlug: string }>;
}) {
  const { dealerSlug } = await params;
  const dealer = await getCompanyBySlug(dealerSlug);

  if (!dealer) {
    redirect("/");
  }

  const adminUser = await getAdminUserForCompany(dealer.id);

  if (adminUser) {
    redirect(`/${dealer.slug}/admin/orders`);
  }

  const authMode = getAdminAuthMode();

  return (
    <main className="shell admin-shell login-shell stack" style={getDealerBrandStyle(dealer.primaryColor)}>
      <section className="hero hero-compact stack">
        <span className="kicker">Yönetim girişi</span>
        <h1>{dealer.name}</h1>
        <p className="lead">
          Bu alan yalnızca yetkili kişiler içindir.
        </p>
        <p className="caption">
          Telefon numaranız doğrulandıktan sonra yönetim ekranına giriş yapabilirsiniz.
        </p>
        <p className="caption">
          {authMode === "demo"
            ? "Demo doğrulama modu açık. Gerçek SMS entegrasyonu henüz aktif değil, ancak giriş akışı kontrollü şekilde çalışır."
            : "SMS doğrulama ile giriş yapılır."}
        </p>
      </section>

      <LoginForm dealerSlug={dealer.slug} authMode={authMode} />
    </main>
  );
}
