import type { AppliedCampaign, Campaign, OrderItem } from "@/src/server/domain/types";

export type CampaignEvaluationItem = OrderItem;

export type CampaignEvaluationResult = {
  subtotalCents: number;
  finalTotalCents: number;
  appliedCampaign: AppliedCampaign | null;
};

function compareByCreatedAt(left: Campaign, right: Campaign) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function getItemQuantity(items: CampaignEvaluationItem[], productId: string | null) {
  if (!productId) {
    return 0;
  }

  return items
    .filter((item) => item.productId === productId)
    .reduce((sum, item) => sum + item.quantity, 0);
}

function getItemPrice(items: CampaignEvaluationItem[], productId: string | null) {
  return items.find((item) => item.productId === productId)?.unitPriceCents ?? null;
}

function evaluateCampaign(
  campaign: Campaign,
  items: CampaignEvaluationItem[],
  subtotalCents: number
): AppliedCampaign | null {
  if (!campaign.isActive) {
    return null;
  }

  switch (campaign.type) {
    case "bundle-gift": {
      const requiredQuantity = campaign.requiredQuantity ?? 0;
      const targetQuantity = getItemQuantity(items, campaign.targetProductId);

      if (
        !campaign.targetProductId ||
        !campaign.giftProductId ||
        !campaign.giftProductName ||
        !campaign.giftProductPriceCents ||
        requiredQuantity <= 0 ||
        targetQuantity < requiredQuantity
      ) {
        return null;
      }

      const giftQuantity = Math.floor(targetQuantity / requiredQuantity);

      if (giftQuantity <= 0) {
        return null;
      }

      return {
        campaignId: campaign.id,
        name: campaign.name,
        type: campaign.type,
        discountAmountCents: 0,
        giftItems: [
          {
            productId: campaign.giftProductId,
            name: `${campaign.giftProductName} (Hediye)`,
            quantity: giftQuantity,
            unitPriceCents: 0
          }
        ],
        adjustmentItems: [],
        benefitCents: campaign.giftProductPriceCents * giftQuantity
      };
    }

    case "quantity": {
      const requiredQuantity = campaign.requiredQuantity ?? 0;
      const payableQuantity = campaign.payableQuantity ?? 0;
      const targetQuantity = getItemQuantity(items, campaign.targetProductId);
      const targetPriceCents = getItemPrice(items, campaign.targetProductId);

      if (
        !campaign.targetProductId ||
        requiredQuantity <= 0 ||
        payableQuantity < 0 ||
        payableQuantity >= requiredQuantity ||
        targetQuantity < requiredQuantity ||
        targetPriceCents === null
      ) {
        return null;
      }

      const campaignSetCount = Math.floor(targetQuantity / requiredQuantity);
      const freeQuantity = (requiredQuantity - payableQuantity) * campaignSetCount;
      const discountAmountCents = freeQuantity * targetPriceCents;

      if (discountAmountCents <= 0) {
        return null;
      }

      return {
        campaignId: campaign.id,
        name: campaign.name,
        type: campaign.type,
        discountAmountCents,
        giftItems: [],
        adjustmentItems: [
          {
            productId: "",
            name: `Kampanya indirimi: ${campaign.name}`,
            quantity: 1,
            unitPriceCents: -discountAmountCents
          }
        ],
        benefitCents: discountAmountCents
      };
    }

    case "cart-discount": {
      const minCartTotalCents = campaign.minCartTotalCents ?? 0;
      const discountAmountCents = campaign.discountAmountCents ?? 0;

      if (minCartTotalCents <= 0 || discountAmountCents <= 0 || subtotalCents < minCartTotalCents) {
        return null;
      }

      const cappedDiscountCents = Math.min(discountAmountCents, subtotalCents);

      return {
        campaignId: campaign.id,
        name: campaign.name,
        type: campaign.type,
        discountAmountCents: cappedDiscountCents,
        giftItems: [],
        adjustmentItems: [
          {
            productId: "",
            name: `Kampanya indirimi: ${campaign.name}`,
            quantity: 1,
            unitPriceCents: -cappedDiscountCents
          }
        ],
        benefitCents: cappedDiscountCents
      };
    }
  }
}

export function evaluateBestCampaign(
  campaigns: Campaign[],
  items: CampaignEvaluationItem[]
): CampaignEvaluationResult {
  const subtotalCents = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceCents,
    0
  );
  const applications = [...campaigns]
    .sort(compareByCreatedAt)
    .map((campaign) => ({ campaign, application: evaluateCampaign(campaign, items, subtotalCents) }))
    .filter((entry): entry is { campaign: Campaign; application: AppliedCampaign } =>
      entry.application !== null
    );

  const best = applications.reduce<{ campaign: Campaign; application: AppliedCampaign } | null>(
    (currentBest, entry) => {
      if (!currentBest) {
        return entry;
      }

      if (entry.application.benefitCents > currentBest.application.benefitCents) {
        return entry;
      }

      return currentBest;
    },
    null
  );

  const appliedCampaign = best?.application ?? null;
  const discountAmountCents = appliedCampaign?.discountAmountCents ?? 0;

  return {
    subtotalCents,
    finalTotalCents: Math.max(0, subtotalCents - discountAmountCents),
    appliedCampaign
  };
}
