import { randomUUID } from "node:crypto";
import { ProductCategory as PrismaProductCategory } from "@/src/generated/prisma/index";
import { db } from "@/src/server/db";
import type { Product, ProductCategory } from "@/src/server/domain/types";

function toProductCategory(category: PrismaProductCategory): ProductCategory {
  switch (category) {
    case PrismaProductCategory.WATER:
      return "water";
    case PrismaProductCategory.SOFT_DRINK:
      return "soft-drink";
    case PrismaProductCategory.BUNDLE:
      return "bundle";
  }

  const exhaustiveCategory: never = category;
  throw new Error(`Unsupported product category: ${exhaustiveCategory}`);
}

function toPrismaProductCategory(category: ProductCategory): PrismaProductCategory {
  switch (category) {
    case "water":
      return PrismaProductCategory.WATER;
    case "soft-drink":
      return PrismaProductCategory.SOFT_DRINK;
    case "bundle":
      return PrismaProductCategory.BUNDLE;
  }

  const exhaustiveCategory: never = category;
  throw new Error(`Unsupported product category: ${exhaustiveCategory}`);
}

function toProduct(product: {
  id: string;
  companyId: string;
  name: string;
  imageUrl: string | null;
  unitLabel: string;
  priceCents: number;
  category: PrismaProductCategory;
  isActive: boolean;
}): Product {
  return {
    id: product.id,
    companyId: product.companyId,
    name: product.name,
    imageUrl: product.imageUrl,
    unitLabel: product.unitLabel,
    priceCents: product.priceCents,
    category: toProductCategory(product.category),
    isActive: product.isActive
  };
}

export async function listProductsForCompany(companyId: string) {
  const products = await db.product.findMany({
    where: {
      companyId,
      isActive: true
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        priceCents: "asc"
      }
    ]
  });

  return products.map(toProduct);
}

export async function listAdminProductsForCompany(companyId: string) {
  const products = await db.product.findMany({
    where: {
      companyId
    },
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });

  return products.map(toProduct);
}

export async function createProductForCompany(
  companyId: string,
  input: {
    name: string;
    imageUrl: string | null;
    unitLabel: string;
    priceCents: number;
    category: ProductCategory;
    isActive: boolean;
  }
) {
  const lastProduct = await db.product.findFirst({
    where: {
      companyId
    },
    orderBy: {
      sortOrder: "desc"
    },
    select: {
      sortOrder: true
    }
  });

  const product = await db.product.create({
    data: {
      id: `prod_${randomUUID()}`,
      companyId,
      name: input.name.trim(),
      imageUrl: input.imageUrl,
      unitLabel: input.unitLabel.trim(),
      priceCents: input.priceCents,
      category: toPrismaProductCategory(input.category),
      isActive: input.isActive,
      sortOrder: (lastProduct?.sortOrder ?? 0) + 1
    }
  });

  return toProduct(product);
}

export async function updateProductForCompany(
  companyId: string,
  productId: string,
  input: {
    name: string;
    imageUrl: string | null;
    unitLabel: string;
    priceCents: number;
    category: ProductCategory;
    isActive: boolean;
  }
) {
  const existing = await db.product.findFirst({
    where: {
      id: productId,
      companyId
    },
    select: {
      id: true
    }
  });

  if (!existing) {
    throw new Error("Ürün bulunamadı");
  }

  const product = await db.product.update({
    where: {
      id: existing.id
    },
    data: {
      name: input.name.trim(),
      imageUrl: input.imageUrl,
      unitLabel: input.unitLabel.trim(),
      priceCents: input.priceCents,
      category: toPrismaProductCategory(input.category),
      isActive: input.isActive
    }
  });

  return toProduct(product);
}
