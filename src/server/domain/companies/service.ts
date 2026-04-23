import { db } from "@/src/server/db";
import type { Company } from "@/src/server/domain/types";

function toCompany(company: {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  supportPhone: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  primaryColor: string | null;
  currency: string;
  orderLeadTimeMinutes: number;
}): Company {
  return {
    id: company.id,
    slug: company.slug,
    name: company.name,
    city: company.city,
    supportPhone: company.supportPhone,
    logoUrl: company.logoUrl,
    heroImageUrl: company.heroImageUrl,
    primaryColor: company.primaryColor,
    currency: company.currency,
    orderLeadTimeMinutes: company.orderLeadTimeMinutes
  };
}

export async function listCompanies() {
  const companies = await db.company.findMany({
    where: {
      isActive: true
    },
    orderBy: {
      name: "asc"
    }
  });

  return companies.map(toCompany);
}

export async function getCompanyBySlug(slug: string) {
  const company = await db.company.findFirst({
    where: {
      slug,
      isActive: true
    }
  });

  return company ? toCompany(company) : null;
}

export async function updateCompanyBranding(
  companyId: string,
  input: {
    logoUrl: string | null;
    heroImageUrl: string | null;
    primaryColor: string | null;
    orderLeadTimeMinutes: number;
  }
) {
  const company = await db.company.update({
    where: {
      id: companyId
    },
    data: {
      logoUrl: input.logoUrl,
      heroImageUrl: input.heroImageUrl,
      primaryColor: input.primaryColor,
      orderLeadTimeMinutes: input.orderLeadTimeMinutes
    }
  });

  return toCompany(company);
}
