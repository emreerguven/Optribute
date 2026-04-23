import { redirect } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { getAdminUserForCompany } from "@/src/server/auth/admin";
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

  return (
    <main className="shell admin-shell login-shell stack" style={getDealerBrandStyle(dealer.primaryColor)}>
      <section className="hero hero-compact stack">
        <span className="kicker">Yönetim girişi</span>
        <h1>{dealer.name}</h1>
        <p className="lead">Yönetim ekranına erişmek için telefon numaranızı doğrulayın.</p>
      </section>

      <LoginForm dealerSlug={dealer.slug} />
    </main>
  );
}
