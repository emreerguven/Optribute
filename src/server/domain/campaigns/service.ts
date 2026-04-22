import { randomUUID } from "node:crypto";
import { CampaignType as PrismaCampaignType } from "@/src/generated/prisma/index";
import { db, type DbClient } from "@/src/server/db";
import type { Campaign, CampaignType } from "@/src/server/domain/types";

function toCampaignType(type: PrismaCampaignType): CampaignType {
  switch (type) {
    case PrismaCampaignType.BUNDLE_GIFT:
      return "bundle-gift";
    case PrismaCampaignType.QUANTITY:
      return "quantity";
    case PrismaCampaignType.CART_DISCOUNT:
      return "cart-discount";
  }

  const exhaustiveType: never = type;
  throw new Error(`Unsupported campaign type: ${exhaustiveType}`);
}

function toPrismaCampaignType(type: CampaignType): PrismaCampaignType {
  switch (type) {
    case "bundle-gift":
      return PrismaCampaignType.BUNDLE_GIFT;
    case "quantity":
      return PrismaCampaignType.QUANTITY;
    case "cart-discount":
      return PrismaCampaignType.CART_DISCOUNT;
  }

  const exhaustiveType: never = type;
  throw new Error(`Unsupported campaign type: ${exhaustiveType}`);
}

function toCampaign(campaign: {
  id: string;
  companyId: string;
  name: string;
  type: PrismaCampaignType;
  isActive: boolean;
  targetProductId: string | null;
  targetProduct: { name: string; priceCents: number } | null;
  giftProductId: string | null;
  giftProduct: { name: string; priceCents: number } | null;
  requiredQuantity: number | null;
  payableQuantity: number | null;
  minCartTotalCents: number | null;
  discountAmountCents: number | null;
  createdAt: Date;
}): Campaign {
  return {
    id: campaign.id,
    companyId: campaign.companyId,
    name: campaign.name,
    type: toCampaignType(campaign.type),
    isActive: campaign.isActive,
    targetProductId: campaign.targetProductId,
    targetProductName: campaign.targetProduct?.name ?? null,
    targetProductPriceCents: campaign.targetProduct?.priceCents ?? null,
    giftProductId: campaign.giftProductId,
    giftProductName: campaign.giftProduct?.name ?? null,
    giftProductPriceCents: campaign.giftProduct?.priceCents ?? null,
    requiredQuantity: campaign.requiredQuantity,
    payableQuantity: campaign.payableQuantity,
    minCartTotalCents: campaign.minCartTotalCents,
    discountAmountCents: campaign.discountAmountCents,
    createdAt: campaign.createdAt.toISOString()
  };
}

const campaignInclude = {
  targetProduct: {
    select: {
      name: true,
      priceCents: true
    }
  },
  giftProduct: {
    select: {
      name: true,
      priceCents: true
    }
  }
};

export async function listCampaignsForCompany(companyId: string, client: DbClient = db) {
  const campaigns = await client.campaign.findMany({
    where: {
      companyId
    },
    include: campaignInclude,
    orderBy: [
      {
        createdAt: "asc"
      }
    ]
  });

  return campaigns.map(toCampaign);
}

export async function listActiveCampaignsForCompany(companyId: string, client: DbClient = db) {
  const campaigns = await client.campaign.findMany({
    where: {
      companyId,
      isActive: true
    },
    include: campaignInclude,
    orderBy: [
      {
        createdAt: "asc"
      }
    ]
  });

  return campaigns.map(toCampaign);
}

async function ensureProductsBelongToCompany(
  companyId: string,
  productIds: Array<string | null | undefined>,
  client: DbClient = db
) {
  const ids = [...new Set(productIds.filter((id): id is string => Boolean(id)))];

  if (ids.length === 0) {
    return;
  }

  const count = await client.product.count({
    where: {
      companyId,
      id: {
        in: ids
      }
    }
  });

  if (count !== ids.length) {
    throw new Error("Seçilen ürünlerden biri bu bayiye ait değil");
  }
}

function normalizeCampaignInput(input: {
  name: string;
  type: CampaignType;
  isActive: boolean;
  targetProductId?: string | null;
  giftProductId?: string | null;
  requiredQuantity?: number | null;
  payableQuantity?: number | null;
  minCartTotalCents?: number | null;
  discountAmountCents?: number | null;
}) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Kampanya adı zorunludur");
  }

  switch (input.type) {
    case "bundle-gift": {
      if (!input.targetProductId || !input.giftProductId) {
        throw new Error("Hediye ürün kampanyası için hedef ve hediye ürün seçilmelidir");
      }

      if (!input.requiredQuantity || input.requiredQuantity <= 0) {
        throw new Error("Gerekli adet pozitif olmalıdır");
      }

      return {
        name,
        type: input.type,
        isActive: input.isActive,
        targetProductId: input.targetProductId,
        giftProductId: input.giftProductId,
        requiredQuantity: input.requiredQuantity,
        payableQuantity: null,
        minCartTotalCents: null,
        discountAmountCents: null
      };
    }

    case "quantity": {
      if (!input.targetProductId) {
        throw new Error("Adet kampanyası için ürün seçilmelidir");
      }

      if (!input.requiredQuantity || input.requiredQuantity <= 0) {
        throw new Error("Gerekli adet pozitif olmalıdır");
      }

      if (
        input.payableQuantity === null ||
        input.payableQuantity === undefined ||
        input.payableQuantity < 0 ||
        input.payableQuantity >= input.requiredQuantity
      ) {
        throw new Error("Ödenecek adet, gerekli adetten küçük olmalıdır");
      }

      return {
        name,
        type: input.type,
        isActive: input.isActive,
        targetProductId: input.targetProductId,
        giftProductId: null,
        requiredQuantity: input.requiredQuantity,
        payableQuantity: input.payableQuantity,
        minCartTotalCents: null,
        discountAmountCents: null
      };
    }

    case "cart-discount": {
      if (!input.minCartTotalCents || input.minCartTotalCents <= 0) {
        throw new Error("Minimum sepet tutarı pozitif olmalıdır");
      }

      if (!input.discountAmountCents || input.discountAmountCents <= 0) {
        throw new Error("İndirim tutarı pozitif olmalıdır");
      }

      return {
        name,
        type: input.type,
        isActive: input.isActive,
        targetProductId: null,
        giftProductId: null,
        requiredQuantity: null,
        payableQuantity: null,
        minCartTotalCents: input.minCartTotalCents,
        discountAmountCents: input.discountAmountCents
      };
    }
  }
}

export async function createCampaignForCompany(
  companyId: string,
  input: {
    name: string;
    type: CampaignType;
    isActive: boolean;
    targetProductId?: string | null;
    giftProductId?: string | null;
    requiredQuantity?: number | null;
    payableQuantity?: number | null;
    minCartTotalCents?: number | null;
    discountAmountCents?: number | null;
  }
) {
  const data = normalizeCampaignInput(input);
  await ensureProductsBelongToCompany(companyId, [data.targetProductId, data.giftProductId]);

  const campaign = await db.campaign.create({
    data: {
      id: `camp_${randomUUID()}`,
      companyId,
      name: data.name,
      type: toPrismaCampaignType(data.type),
      isActive: data.isActive,
      targetProductId: data.targetProductId,
      giftProductId: data.giftProductId,
      requiredQuantity: data.requiredQuantity,
      payableQuantity: data.payableQuantity,
      minCartTotalCents: data.minCartTotalCents,
      discountAmountCents: data.discountAmountCents
    },
    include: campaignInclude
  });

  return toCampaign(campaign);
}

export async function updateCampaignStatusForCompany(
  companyId: string,
  campaignId: string,
  isActive: boolean
) {
  const existing = await db.campaign.findFirst({
    where: {
      id: campaignId,
      companyId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new Error("Kampanya bulunamadı");
  }

  const campaign = await db.campaign.update({
    where: {
      id: existing.id
    },
    data: {
      isActive
    },
    include: campaignInclude
  });

  return toCampaign(campaign);
}
