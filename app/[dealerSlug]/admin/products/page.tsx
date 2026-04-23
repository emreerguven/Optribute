import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listAdminProductsForCompany } from "@/src/server/domain/products/service";
import { LogoutButton } from "../logout-button";
import { BrandingForm } from "./branding-form";
import { ProductsManager } from "./products-manager";

export const dynamic = "force-dynamic";

export default async function DealerProductsAdminPage({
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

  const products = await listAdminProductsForCompany(dealer.id);
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Bayi ürünleri</span>
            <h1>Ürünler</h1>
            <p className="lead">Ürünleri ekleyin, düzenleyin ve aktif durumunu yönetin.</p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
                Siparişleri gör
              </Link>
              <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
                Kampanyaları yönet
              </Link>
              <Link href={`/${dealer.slug}/admin/couriers`} className="button-secondary">
                Kuryeleri yönet
              </Link>
              <LogoutButton dealerSlug={dealer.slug} />
            </div>
          </div>
          <div className="stats-grid">
            <div className="metric">
              <div className="metric-value">{products.length}</div>
              <div>Toplam ürün</div>
            </div>
            <div className="metric">
              <div className="metric-value">{products.filter((product) => product.isActive).length}</div>
              <div>Aktif ürün</div>
            </div>
            <div className="metric">
              <div className="metric-value">{products.filter((product) => !product.isActive).length}</div>
              <div>Pasif ürün</div>
            </div>
          </div>
        </div>
      </section>

      <BrandingForm
        dealerSlug={dealer.slug}
        initialLogoUrl={dealer.logoUrl ?? ""}
        initialHeroImageUrl={dealer.heroImageUrl ?? ""}
        initialDepotName={dealer.depotName ?? ""}
        initialDepotAddress={dealer.depotAddress ?? ""}
        initialPrimaryColor={dealer.primaryColor ?? ""}
        initialLeadTimeMinutes={dealer.orderLeadTimeMinutes}
      />

      <ProductsManager dealerSlug={dealer.slug} initialProducts={products} />
    </main>
  );
}
