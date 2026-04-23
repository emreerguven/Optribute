import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getAdminUserForCompany } from "@/src/server/auth/admin";
import type { Company } from "@/src/server/domain/types";

export async function requireAdminPage(dealer: Company) {
  const adminUser = await getAdminUserForCompany(dealer.id);

  if (!adminUser) {
    redirect(`/${dealer.slug}/admin/login`);
  }

  return adminUser;
}

export async function requireAdminApi(companyId: string) {
  const adminUser = await getAdminUserForCompany(companyId);

  if (!adminUser) {
    return NextResponse.json({ error: "Yönetim girişi gerekli" }, { status: 401 });
  }

  return null;
}
