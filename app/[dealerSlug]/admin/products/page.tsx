import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listAdminProductsForCompany } from "@/src/server/domain/products/service";
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

  const products = await listAdminProductsForCompany(dealer.id);

  return (
    <main className="shell admin-shell stack">
      <section className="hero hero-compact stack">
        <div className="hero-grid">
          <div>
            <span className="kicker">Bayi ürünleri</span>
            <h1>{dealer.name} ürün yönetimi</h1>
            <p className="lead">
              Ürünlerinizi bu ekrandan görüntüleyebilir, düzenleyebilir, yeni ürün
              ekleyebilir ve aktif/pasif durumunu değiştirebilirsiniz.
            </p>
            <div className="actions">
              <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
                Siparişleri gör
              </Link>
              <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
                Kampanyaları yönet
              </Link>
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

      <ProductsManager dealerSlug={dealer.slug} initialProducts={products} />
    </main>
  );
}
