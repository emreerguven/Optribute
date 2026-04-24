import Link from "next/link";
import { notFound } from "next/navigation";
import { getDealerBrandStyle } from "@/src/lib/branding";
import { requireAdminPage } from "@/src/server/auth/guards";
import { getCompanyBySlug } from "@/src/server/domain/companies/service";
import { listCouriersForCompany } from "@/src/server/domain/couriers/service";
import { AdminBrandHeader } from "@/src/components/admin-brand-header";
import { LogoutButton } from "../logout-button";
import { CouriersManager } from "./couriers-manager";

export const dynamic = "force-dynamic";

export default async function DealerCouriersAdminPage({
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

  const couriers = await listCouriersForCompany(dealer.id);
  const brandStyle = getDealerBrandStyle(dealer.primaryColor);

  return (
    <main className="shell admin-shell stack" style={brandStyle}>
      <AdminBrandHeader
        dealer={dealer}
        kicker="Kurye yönetimi"
        title="Kuryeler"
        description="Kuryeleri ekleyin, aktifliğini yönetin ve sipariş atamalarına hazırlayın."
        actions={
          <>
            <Link href={`/${dealer.slug}/admin/dashboard`} className="button-secondary">
              Yönetim paneli
            </Link>
            <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
              Siparişleri gör
            </Link>
            <Link href={`/${dealer.slug}/admin/products`} className="button-secondary">
              Ürünleri yönet
            </Link>
            <Link href={`/${dealer.slug}/admin/campaigns`} className="button-secondary">
              Kampanyaları yönet
            </Link>
            <LogoutButton dealerSlug={dealer.slug} />
          </>
        }
        summary={
          <>
            <div className="metric">
              <div className="metric-value">{couriers.length}</div>
              <div>Toplam kurye</div>
            </div>
            <div className="metric">
              <div className="metric-value">{couriers.filter((courier) => courier.isActive).length}</div>
              <div>Aktif kurye</div>
            </div>
          </>
        }
      />

      <CouriersManager dealerSlug={dealer.slug} initialCouriers={couriers} />
    </main>
  );
}
