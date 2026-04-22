import {
  CampaignType,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductCategory,
  OrderStatus
} from "../src/generated/prisma/index";
import { normalizePhone } from "../src/server/domain/phone";

const prisma = new PrismaClient();

async function main() {
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.company.deleteMany();

  await prisma.company.createMany({
    data: [
      {
        id: "company_javsu",
        slug: "javsu",
        name: "Javsu Su Bayi",
        city: "Istanbul",
        supportPhone: "+90 212 555 01 01",
        currency: "TRY",
        orderLeadTimeMinutes: 45,
        isActive: true
      },
      {
        id: "company_marmara",
        slug: "marmarasu",
        name: "Marmara Su Bayi",
        city: "Kocaeli",
        supportPhone: "+90 262 555 02 02",
        currency: "TRY",
        orderLeadTimeMinutes: 60,
        isActive: true
      }
    ]
  });

  await prisma.product.createMany({
    data: [
      {
        id: "prod_19l_javsu",
        companyId: "company_javsu",
        name: "19L Damacana Su",
        imageUrl: "/product-images/javsu-19l.svg",
        unitLabel: "adet",
        category: ProductCategory.WATER,
        priceCents: 12500,
        isActive: true,
        sortOrder: 1
      },
      {
        id: "prod_5l_javsu",
        companyId: "company_javsu",
        name: "5L Su Paketi",
        imageUrl: "/product-images/javsu-5l.svg",
        unitLabel: "4'lü paket",
        category: ProductCategory.BUNDLE,
        priceCents: 9000,
        isActive: true,
        sortOrder: 2
      },
      {
        id: "prod_soda_javsu",
        companyId: "company_javsu",
        name: "Maden Suyu",
        imageUrl: "/product-images/javsu-soda.svg",
        unitLabel: "kasa",
        category: ProductCategory.SOFT_DRINK,
        priceCents: 6500,
        isActive: true,
        sortOrder: 3
      },
      {
        id: "prod_19l_marmara",
        companyId: "company_marmara",
        name: "19L Geri Dönüşlü Su",
        imageUrl: "/product-images/marmara-19l.svg",
        unitLabel: "adet",
        category: ProductCategory.WATER,
        priceCents: 11900,
        isActive: true,
        sortOrder: 1
      },
      {
        id: "prod_10l_marmara",
        companyId: "company_marmara",
        name: "10L Pet Şişe Su",
        imageUrl: "/product-images/marmara-10l.svg",
        unitLabel: "tekli",
        category: ProductCategory.WATER,
        priceCents: 6200,
        isActive: true,
        sortOrder: 2
      }
    ]
  });

  await prisma.campaign.createMany({
    data: [
      {
        id: "camp_javsu_bundle_soda",
        companyId: "company_javsu",
        name: "1 Damacana alana 1 Soda hediye",
        type: CampaignType.BUNDLE_GIFT,
        isActive: true,
        targetProductId: "prod_19l_javsu",
        giftProductId: "prod_soda_javsu",
        requiredQuantity: 1
      },
      {
        id: "camp_javsu_5_al_3_ode",
        companyId: "company_javsu",
        name: "5 al 3 öde",
        type: CampaignType.QUANTITY,
        isActive: false,
        targetProductId: "prod_19l_javsu",
        requiredQuantity: 5,
        payableQuantity: 3
      },
      {
        id: "camp_javsu_1000_ustu_200_indirim",
        companyId: "company_javsu",
        name: "1000 TL üzeri 200 TL indirim",
        type: CampaignType.CART_DISCOUNT,
        isActive: false,
        minCartTotalCents: 100000,
        discountAmountCents: 20000
      }
    ]
  });

  await prisma.customer.create({
    data: {
      id: "cust_javsu_ayse",
      companyId: "company_javsu",
      fullName: "Ayse Demir",
      phone: "05551234567",
      normalizedPhone: normalizePhone("05551234567"),
      notes: "Cevap yoksa apartman girişine bırakın.",
      addresses: {
        create: [
          {
            id: "addr_javsu_ayse_home",
            label: "Ev",
            line1: "Ataturk Mah. Cicek Sok. No:12 D:4",
            district: "Umraniye",
            city: "Istanbul",
            isDefault: true
          }
        ]
      }
    }
  });

  await prisma.customer.create({
    data: {
      id: "cust_javsu_mert",
      companyId: "company_javsu",
      fullName: "Mert Kaya",
      phone: "05339887766",
      normalizedPhone: normalizePhone("05339887766"),
      addresses: {
        create: [
          {
            id: "addr_javsu_mert_office",
            label: "Ofis",
            line1: "Nisbetiye Cad. No:48 Kat:3",
            district: "Besiktas",
            city: "Istanbul",
            isDefault: true
          }
        ]
      }
    }
  });

  await prisma.order.create({
    data: {
      id: "ord_1001",
      companyId: "company_javsu",
      customerId: "cust_javsu_ayse",
      customerName: "Ayse Demir",
      phone: "05551234567",
      normalizedPhone: normalizePhone("05551234567"),
      addressLine: "Ataturk Mah. Cicek Sok. No:12 D:4, Umraniye / Istanbul",
      deliveryNotes: "Ring once.",
      status: OrderStatus.PENDING,
      source: "qr",
      submittedAt: new Date("2026-04-13T10:15:00.000Z"),
      createdAt: new Date("2026-04-13T10:15:00.000Z"),
      orderItems: {
        create: [
          {
            id: "ord_item_1001_1",
            productId: "prod_19l_javsu",
            productName: "19L Damacana Su",
            quantity: 2,
            unitPriceCents: 12500
          }
        ]
      },
      payments: {
        create: [
          {
            id: "pay_1001",
            amountCents: 25000,
            method: PaymentMethod.CASH_ON_DELIVERY,
            status: PaymentStatus.PENDING,
            reference: null
          }
        ]
      }
    }
  });

  await prisma.order.create({
    data: {
      id: "ord_1002",
      companyId: "company_javsu",
      customerId: "cust_javsu_mert",
      customerName: "Mert Kaya",
      phone: "05339887766",
      normalizedPhone: normalizePhone("05339887766"),
      addressLine: "Nisbetiye Cad. No:48 Kat:3, Besiktas / Istanbul",
      status: OrderStatus.CONFIRMED,
      source: "qr",
      submittedAt: new Date("2026-04-13T09:25:00.000Z"),
      createdAt: new Date("2026-04-13T09:25:00.000Z"),
      orderItems: {
        create: [
          {
            id: "ord_item_1002_1",
            productId: "prod_19l_javsu",
            productName: "19L Damacana Su",
            quantity: 1,
            unitPriceCents: 12500
          },
          {
            id: "ord_item_1002_2",
            productId: "prod_soda_javsu",
            productName: "Maden Suyu",
            quantity: 1,
            unitPriceCents: 6500
          }
        ]
      },
      payments: {
        create: [
          {
            id: "pay_1002",
            amountCents: 19000,
            method: PaymentMethod.CASH_ON_DELIVERY,
            status: PaymentStatus.PENDING,
            reference: null
          }
        ]
      }
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
