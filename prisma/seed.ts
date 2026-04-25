import {
  CampaignType,
  CollectionStatus,
  DeliveryStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PrismaClient,
  ProductCategory
} from "../src/generated/prisma/index";
import { normalizePhone } from "../src/server/domain/phone";

const prisma = new PrismaClient();

type CustomerSeed = {
  id: string;
  fullName: string;
  phone: string;
  notes?: string;
  address: {
    label: string;
    district: string;
    neighborhood: string;
    street: string;
    buildingNo: string;
    apartmentNo?: string;
    siteName?: string;
    addressNote?: string;
  };
};

type ManualContactSeed = {
  fullName: string;
  phone: string;
  notes?: string;
  address: CustomerSeed["address"];
};

type SeedProduct = {
  id: string;
  name: string;
  priceCents: number;
};

type OrderLine = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
};

type CampaignApplication = {
  name: string;
  benefitCents: number;
  giftItems: OrderLine[];
  adjustmentItems: OrderLine[];
} | null;

const DAY_MS = 24 * 60 * 60 * 1000;

const JAVSU_PRODUCTS = [
  {
    id: "prod_19l_javsu",
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
    name: "Maden Suyu",
    imageUrl: "/product-images/javsu-soda.svg",
    unitLabel: "kasa",
    category: ProductCategory.SOFT_DRINK,
    priceCents: 6500,
    isActive: true,
    sortOrder: 3
  },
  {
    id: "prod_glass_javsu",
    name: "330ml Cam Şişe Su",
    imageUrl: "/product-images/javsu-5l.svg",
    unitLabel: "6'lı koli",
    category: ProductCategory.WATER,
    priceCents: 7800,
    isActive: true,
    sortOrder: 4
  }
] as const;

const JAVSU_COURIERS = [
  {
    id: "courier_javsu_1",
    companyId: "company_javsu",
    fullName: "Ali Yıldız",
    phone: "05551112233",
    isActive: true
  },
  {
    id: "courier_javsu_2",
    companyId: "company_javsu",
    fullName: "Ece Kurt",
    phone: "05554443322",
    isActive: true
  },
  {
    id: "courier_javsu_3",
    companyId: "company_javsu",
    fullName: "Murat Şahin",
    phone: "05557776655",
    isActive: true
  },
  {
    id: "courier_javsu_4",
    companyId: "company_javsu",
    fullName: "Bora Çetin",
    phone: "05558889900",
    isActive: false
  }
] as const;

const JAVSU_CUSTOMERS: CustomerSeed[] = [
  {
    id: "cust_javsu_1",
    fullName: "Selin Acar",
    phone: "05551230001",
    notes: "Kapıcı Ahmet Bey'e bırakılabilir.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "100. Yıl",
      street: "1526. Cad.",
      buildingNo: "14",
      apartmentNo: "6",
      addressNote: "İnterkom bozuksa arayın."
    }
  },
  {
    id: "cust_javsu_2",
    fullName: "Mert Tunç",
    phone: "05551230002",
    notes: "Ofis girişi öğlene kadar açık.",
    address: {
      label: "Ofis",
      district: "Çankaya",
      neighborhood: "Bahçelievler",
      street: "7. Cad.",
      buildingNo: "58",
      apartmentNo: "2"
    }
  },
  {
    id: "cust_javsu_3",
    fullName: "Ayşe Yılmaz",
    phone: "05551230003",
    notes: "Asansör küçük, daire kapısına kadar getirin.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Balgat",
      street: "Ziyabey Cad.",
      buildingNo: "41",
      apartmentNo: "5"
    }
  },
  {
    id: "cust_javsu_4",
    fullName: "Onur Çelik",
    phone: "05551230004",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Emek",
      street: "8. Cad.",
      buildingNo: "22",
      apartmentNo: "4"
    }
  },
  {
    id: "cust_javsu_5",
    fullName: "Buse Demir",
    phone: "05551230005",
    notes: "Güvenliğe isim bırakıldı.",
    address: {
      label: "Site",
      district: "Çankaya",
      neighborhood: "Ayrancı",
      street: "Hoşdere Cad.",
      buildingNo: "91",
      apartmentNo: "9"
    }
  },
  {
    id: "cust_javsu_6",
    fullName: "Cem Arslan",
    phone: "05551230006",
    address: {
      label: "Ofis",
      district: "Çankaya",
      neighborhood: "Kızılay",
      street: "Meşrutiyet Cad.",
      buildingNo: "17",
      apartmentNo: "3"
    }
  },
  {
    id: "cust_javsu_7",
    fullName: "Derya Şen",
    phone: "05551230007",
    notes: "Bebek uyuyorsa zile uzun basmayın.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Yukarı Bahçelievler",
      street: "Aşkabat Cad.",
      buildingNo: "29",
      apartmentNo: "1"
    }
  },
  {
    id: "cust_javsu_8",
    fullName: "Kerem Güneş",
    phone: "05551230008",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "100. Yıl",
      street: "1514. Sok.",
      buildingNo: "8",
      apartmentNo: "7"
    }
  },
  {
    id: "cust_javsu_9",
    fullName: "Sibel Ertem",
    phone: "05551230009",
    notes: "Arka bloktan giriş daha kolay.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Bahçelievler",
      street: "3. Cad.",
      buildingNo: "73",
      apartmentNo: "10"
    }
  },
  {
    id: "cust_javsu_10",
    fullName: "Levent Kara",
    phone: "05551230010",
    address: {
      label: "Ofis",
      district: "Çankaya",
      neighborhood: "Balgat",
      street: "Ceyhun Atuf Kansu Cad.",
      buildingNo: "126",
      apartmentNo: "4"
    }
  },
  {
    id: "cust_javsu_11",
    fullName: "Nihan Öz",
    phone: "05551230011",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Ayrancı",
      street: "Güfte Sok.",
      buildingNo: "11",
      apartmentNo: "2"
    }
  },
  {
    id: "cust_javsu_12",
    fullName: "Burak Işık",
    phone: "05551230012",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Emek",
      street: "Bişkek Cad.",
      buildingNo: "33",
      apartmentNo: "8"
    }
  }
];

const MANUAL_CONTACTS: ManualContactSeed[] = [
  {
    fullName: "Pelin Aksoy",
    phone: "05553340001",
    notes: "Yeni müşteri, ilk teslimat.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Kızılay",
      street: "Selanik Cad.",
      buildingNo: "19",
      apartmentNo: "5"
    }
  },
  {
    fullName: "Tuna Korkmaz",
    phone: "05553340002",
    address: {
      label: "Ofis",
      district: "Çankaya",
      neighborhood: "Bahçelievler",
      street: "Aşkabat Cad.",
      buildingNo: "41",
      apartmentNo: "1"
    }
  },
  {
    fullName: "Gözde Aydın",
    phone: "05553340003",
    notes: "Akşam 18:00 sonrası teslim alınır.",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Yukarı Bahçelievler",
      street: "İzmir 2 Cad.",
      buildingNo: "27",
      apartmentNo: "6"
    }
  },
  {
    fullName: "Murat Efe",
    phone: "05553340004",
    address: {
      label: "Site",
      district: "Çankaya",
      neighborhood: "100. Yıl",
      street: "1582. Cad.",
      buildingNo: "6",
      apartmentNo: "3"
    }
  },
  {
    fullName: "Simge Dönmez",
    phone: "05553340005",
    address: {
      label: "Ev",
      district: "Çankaya",
      neighborhood: "Ayrancı",
      street: "Portakal Çiçeği Sok.",
      buildingNo: "23",
      apartmentNo: "4"
    }
  }
];

const MARMARA_PRODUCTS = [
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
] as const;

function mulberry32(seed: number) {
  return function next() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(rand: () => number, min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function maybe(rand: () => number, threshold: number) {
  return rand() < threshold;
}

function weightedPick<T>(rand: () => number, values: Array<{ value: T; weight: number }>) {
  const totalWeight = values.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rand() * totalWeight;

  for (const entry of values) {
    cursor -= entry.weight;

    if (cursor <= 0) {
      return entry.value;
    }
  }

  return values[values.length - 1]!.value;
}

function buildAddressLine(address: CustomerSeed["address"]) {
  const building = `No: ${address.buildingNo}`;
  const apartment = address.apartmentNo ? `D: ${address.apartmentNo}` : null;
  const site = address.siteName ? `${address.siteName}, ` : "";

  return `${site}${address.neighborhood} Mah. ${address.street} ${building}${apartment ? ` ${apartment}` : ""}, ${address.district} / Ankara`;
}

function buildSubmittedAt(dayOffset: number, slot: number, rand: () => number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - dayOffset);

  const hourWeights = dayOffset === 0
    ? [
        { value: 8, weight: 1 },
        { value: 9, weight: 2 },
        { value: 10, weight: 3 },
        { value: 11, weight: 3 },
        { value: 13, weight: 3 },
        { value: 15, weight: 2 },
        { value: 17, weight: 2 },
        { value: 18, weight: 1 }
      ]
    : [
        { value: 8, weight: 1 },
        { value: 9, weight: 2 },
        { value: 10, weight: 3 },
        { value: 11, weight: 3 },
        { value: 12, weight: 2 },
        { value: 14, weight: 3 },
        { value: 16, weight: 2 },
        { value: 18, weight: 1 }
      ];

  const baseHour = weightedPick(rand, hourWeights);
  const minute = (slot * 11 + randomInt(rand, 0, 44)) % 60;
  date.setHours(baseHour, minute, 0, 0);

  return date;
}

function getDailyOrderCount(dayOffset: number, rand: () => number) {
  const target = new Date();
  target.setDate(target.getDate() - dayOffset);
  const weekday = target.getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  const baseMin = isWeekend ? 2 : 3;
  const baseMax = isWeekend ? 5 : 8;
  let count = randomInt(rand, baseMin, baseMax);

  if (dayOffset <= 2) {
    count += randomInt(rand, 1, 3);
  }

  if (dayOffset % 7 === 3 || dayOffset % 9 === 0) {
    count += 2;
  }

  return Math.max(2, count);
}

function createBaseItems(rand: () => number, products: Record<string, SeedProduct>, source: "qr" | "manual") {
  const lines: OrderLine[] = [];
  const addLine = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      return;
    }

    const product = products[productId]!;
    lines.push({
      productId,
      productName: product.name,
      quantity,
      unitPriceCents: product.priceCents
    });
  };

  const profile = weightedPick(rand, [
    { value: "quick", weight: 4 },
    { value: "family", weight: 3 },
    { value: "office", weight: source === "manual" ? 4 : 2 },
    { value: "bulk", weight: 2 }
  ]);

  if (profile === "quick") {
    addLine("prod_19l_javsu", weightedPick(rand, [
      { value: 1, weight: 5 },
      { value: 2, weight: 3 },
      { value: 3, weight: 1 }
    ]));
    if (maybe(rand, 0.25)) {
      addLine("prod_soda_javsu", 1);
    }
  }

  if (profile === "family") {
    addLine("prod_19l_javsu", weightedPick(rand, [
      { value: 2, weight: 4 },
      { value: 3, weight: 3 },
      { value: 4, weight: 1 }
    ]));
    addLine("prod_5l_javsu", weightedPick(rand, [
      { value: 1, weight: 4 },
      { value: 2, weight: 2 }
    ]));
    if (maybe(rand, 0.45)) {
      addLine("prod_glass_javsu", 1);
    }
  }

  if (profile === "office") {
    addLine("prod_19l_javsu", weightedPick(rand, [
      { value: 3, weight: 3 },
      { value: 4, weight: 4 },
      { value: 5, weight: 3 },
      { value: 6, weight: 2 }
    ]));
    if (maybe(rand, 0.65)) {
      addLine("prod_soda_javsu", weightedPick(rand, [
        { value: 1, weight: 2 },
        { value: 2, weight: 3 },
        { value: 3, weight: 1 }
      ]));
    }
    if (maybe(rand, 0.35)) {
      addLine("prod_5l_javsu", 1);
    }
  }

  if (profile === "bulk") {
    addLine("prod_19l_javsu", weightedPick(rand, [
      { value: 5, weight: 3 },
      { value: 6, weight: 3 },
      { value: 8, weight: 1 }
    ]));
    if (maybe(rand, 0.5)) {
      addLine("prod_5l_javsu", 2);
    }
    if (maybe(rand, 0.35)) {
      addLine("prod_glass_javsu", 2);
    }
  }

  if (lines.length === 0) {
    addLine("prod_19l_javsu", 1);
  }

  return lines;
}

function evaluateBestSeedCampaign(lines: OrderLine[], products: Record<string, SeedProduct>): CampaignApplication {
  const subtotal = lines.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const damacanaQty = lines
    .filter((item) => item.productId === "prod_19l_javsu")
    .reduce((sum, item) => sum + item.quantity, 0);

  const soda = products.prod_soda_javsu;
  const bundleGiftQty = Math.floor(damacanaQty / 2);
  const bundleBenefit = bundleGiftQty * soda.priceCents;
  const quantityBenefit = damacanaQty >= 5 ? Math.floor(damacanaQty / 5) * 2 * products.prod_19l_javsu.priceCents : 0;
  const cartBenefit = subtotal >= 100000 ? 20000 : 0;

  const candidates: CampaignApplication[] = [
    bundleBenefit > 0
      ? {
          name: "2 Damacana ile 1 Soda dahil",
          benefitCents: bundleBenefit,
          giftItems: [
            {
              productId: soda.id,
              productName: soda.name,
              quantity: bundleGiftQty,
              unitPriceCents: soda.priceCents
            }
          ],
          adjustmentItems: [
            {
              productId: null,
              productName: "Joker indirimi",
              quantity: 1,
              unitPriceCents: -bundleBenefit
            }
          ]
        }
      : null,
    quantityBenefit > 0
      ? {
          name: "5 al 3 öde",
          benefitCents: quantityBenefit,
          giftItems: [],
          adjustmentItems: [
            {
              productId: null,
              productName: "Joker indirimi",
              quantity: 1,
              unitPriceCents: -quantityBenefit
            }
          ]
        }
      : null,
    cartBenefit > 0
      ? {
          name: "1000 TL üzeri 200 TL indirim",
          benefitCents: cartBenefit,
          giftItems: [],
          adjustmentItems: [
            {
              productId: null,
              productName: "Joker indirimi",
              quantity: 1,
              unitPriceCents: -cartBenefit
            }
          ]
        }
      : null
  ].filter(Boolean);

  return candidates.sort((left, right) => right!.benefitCents - left!.benefitCents)[0] ?? null;
}

function getOrderState(dayOffset: number, rand: () => number) {
  if (dayOffset >= 5) {
    return weightedPick(rand, [
      { value: { status: OrderStatus.COMPLETED, deliveryStatus: DeliveryStatus.DELIVERED }, weight: 16 },
      { value: { status: OrderStatus.CANCELLED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 2 }
    ]);
  }

  if (dayOffset >= 2) {
    return weightedPick(rand, [
      { value: { status: OrderStatus.COMPLETED, deliveryStatus: DeliveryStatus.DELIVERED }, weight: 10 },
      { value: { status: OrderStatus.DELIVERING, deliveryStatus: DeliveryStatus.OUT_FOR_DELIVERY }, weight: 2 },
      { value: { status: OrderStatus.PREPARING, deliveryStatus: DeliveryStatus.ASSIGNED }, weight: 3 },
      { value: { status: OrderStatus.CONFIRMED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 2 },
      { value: { status: OrderStatus.CANCELLED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 1 }
    ]);
  }

  if (dayOffset === 1) {
    return weightedPick(rand, [
      { value: { status: OrderStatus.COMPLETED, deliveryStatus: DeliveryStatus.DELIVERED }, weight: 4 },
      { value: { status: OrderStatus.DELIVERING, deliveryStatus: DeliveryStatus.OUT_FOR_DELIVERY }, weight: 4 },
      { value: { status: OrderStatus.PREPARING, deliveryStatus: DeliveryStatus.ASSIGNED }, weight: 5 },
      { value: { status: OrderStatus.CONFIRMED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 3 },
      { value: { status: OrderStatus.CANCELLED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 1 }
    ]);
  }

  return weightedPick(rand, [
    { value: { status: OrderStatus.DELIVERING, deliveryStatus: DeliveryStatus.OUT_FOR_DELIVERY }, weight: 4 },
    { value: { status: OrderStatus.PREPARING, deliveryStatus: DeliveryStatus.ASSIGNED }, weight: 4 },
    { value: { status: OrderStatus.CONFIRMED, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 4 },
    { value: { status: OrderStatus.PENDING, deliveryStatus: DeliveryStatus.UNASSIGNED }, weight: 3 },
    { value: { status: OrderStatus.COMPLETED, deliveryStatus: DeliveryStatus.DELIVERED }, weight: 2 }
  ]);
}

function getPaymentState(
  rand: () => number,
  method: PaymentMethod,
  status: OrderStatus,
  deliveryStatus: DeliveryStatus
) {
  if (method === PaymentMethod.ACCOUNT_BALANCE) {
    if (status === OrderStatus.CANCELLED) {
      return weightedPick(rand, [
        { value: PaymentStatus.FAILED, weight: 3 },
        { value: PaymentStatus.CANCELLED, weight: 2 }
      ]);
    }

    if (deliveryStatus === DeliveryStatus.DELIVERED) {
      return weightedPick(rand, [
        { value: PaymentStatus.PAID, weight: 9 },
        { value: PaymentStatus.PENDING, weight: 1 }
      ]);
    }

    return weightedPick(rand, [
      { value: PaymentStatus.PAID, weight: 2 },
      { value: PaymentStatus.PENDING, weight: 6 },
      { value: PaymentStatus.FAILED, weight: 1 }
    ]);
  }

  if (status === OrderStatus.CANCELLED) {
    return weightedPick(rand, [
      { value: PaymentStatus.CANCELLED, weight: 2 },
      { value: PaymentStatus.PENDING, weight: 1 }
    ]);
  }

  if (deliveryStatus === DeliveryStatus.DELIVERED) {
    return weightedPick(rand, [
      { value: PaymentStatus.PAID, weight: method === PaymentMethod.CARD_ON_DELIVERY ? 8 : 7 },
      { value: PaymentStatus.PENDING, weight: 2 }
    ]);
  }

  return PaymentStatus.PENDING;
}

function getCollectionState(
  rand: () => number,
  paymentStatus: PaymentStatus,
  deliveryStatus: DeliveryStatus
) {
  if (paymentStatus === PaymentStatus.PAID) {
    return CollectionStatus.PAID;
  }

  if (deliveryStatus === DeliveryStatus.DELIVERED) {
    return weightedPick(rand, [
      { value: CollectionStatus.ON_ACCOUNT, weight: 4 },
      { value: CollectionStatus.PENDING, weight: 1 }
    ]);
  }

  return CollectionStatus.PENDING;
}

async function seedCompanies() {
  await prisma.company.createMany({
    data: [
      {
        id: "company_javsu",
        slug: "javsu",
        name: "Javsu 100. Yıl Bayisi",
        city: "Ankara",
        supportPhone: "+90 312 555 01 01",
        logoUrl: "/product-images/javsu-19l.svg",
        heroImageUrl: "/product-images/javsu-19l.svg",
        depotName: "Javsu 100. Yıl Depo",
        depotAddress: "100. Yıl Mah. 1526. Cad. No: 12 Çankaya / Ankara",
        primaryColor: "#0f766e",
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
        logoUrl: "/product-images/marmara-19l.svg",
        heroImageUrl: "/product-images/marmara-19l.svg",
        depotName: "Marmara Depo",
        depotAddress: "Sanayi Mah. D100 Yanyol No: 8 İzmit / Kocaeli",
        primaryColor: "#2563eb",
        currency: "TRY",
        orderLeadTimeMinutes: 60,
        isActive: true
      }
    ]
  });
}

async function seedAdminsAndCouriers() {
  await prisma.adminUser.createMany({
    data: [
      {
        id: "admin_javsu_owner",
        companyId: "company_javsu",
        fullName: "Javsu Yetkili",
        phone: "05550000000",
        normalizedPhone: normalizePhone("05550000000"),
        isActive: true
      },
      {
        id: "admin_marmara_owner",
        companyId: "company_marmara",
        fullName: "Marmara Yetkili",
        phone: "05550000001",
        normalizedPhone: normalizePhone("05550000001"),
        isActive: true
      }
    ]
  });

  await prisma.courier.createMany({
    data: [
      ...JAVSU_COURIERS,
      {
        id: "courier_marmara_1",
        companyId: "company_marmara",
        fullName: "Can Demir",
        phone: "05556667788",
        isActive: true
      }
    ]
  });
}

async function seedProductsAndCampaigns() {
  await prisma.product.createMany({
    data: [
      ...JAVSU_PRODUCTS.map((product) => ({ ...product, companyId: "company_javsu" })),
      ...MARMARA_PRODUCTS
    ]
  });

  await prisma.campaign.createMany({
    data: [
      {
        id: "camp_javsu_bundle_soda",
        companyId: "company_javsu",
        name: "2 Damacana ile 1 Soda dahil",
        type: CampaignType.BUNDLE_GIFT,
        isActive: true,
        targetProductId: "prod_19l_javsu",
        giftProductId: "prod_soda_javsu",
        requiredQuantity: 2
      },
      {
        id: "camp_javsu_5_al_3_ode",
        companyId: "company_javsu",
        name: "5 al 3 öde",
        type: CampaignType.QUANTITY,
        isActive: true,
        targetProductId: "prod_19l_javsu",
        requiredQuantity: 5,
        payableQuantity: 3
      },
      {
        id: "camp_javsu_1000_ustu_200_indirim",
        companyId: "company_javsu",
        name: "1000 TL üzeri 200 TL indirim",
        type: CampaignType.CART_DISCOUNT,
        isActive: true,
        minCartTotalCents: 100000,
        discountAmountCents: 20000
      }
    ]
  });
}

async function seedCustomers() {
  for (const customer of JAVSU_CUSTOMERS) {
    await prisma.customer.create({
      data: {
        id: customer.id,
        companyId: "company_javsu",
        fullName: customer.fullName,
        phone: customer.phone,
        normalizedPhone: normalizePhone(customer.phone),
        notes: customer.notes ?? null,
        addresses: {
          create: [
            {
              id: `${customer.id}_address`,
              label: customer.address.label,
              line1: buildAddressLine(customer.address),
              district: customer.address.district,
              neighborhood: customer.address.neighborhood,
              street: customer.address.street,
              buildingNo: customer.address.buildingNo,
              apartmentNo: customer.address.apartmentNo ?? null,
              siteName: customer.address.siteName ?? null,
              addressNote: customer.address.addressNote ?? null,
              city: "Ankara",
              isDefault: true
            }
          ]
        }
      }
    });
  }
}

async function seedJavsuOrders() {
  const rand = mulberry32(20260424);
  const activeCourierIds = JAVSU_COURIERS.filter((courier) => courier.isActive).map((courier) => courier.id);
  const productMap = Object.fromEntries(
    JAVSU_PRODUCTS.map((product) => [
      product.id,
      { id: product.id, name: product.name, priceCents: product.priceCents }
    ])
  ) as Record<string, SeedProduct>;

  const weightedCustomers = JAVSU_CUSTOMERS.map((customer, index) => ({
    value: customer,
    weight: index < 5 ? 5 : index < 9 ? 3 : 2
  }));

  let orderSequence = 1;
  let itemSequence = 1;
  let paymentSequence = 1;

  for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
    const dailyOrderCount = getDailyOrderCount(dayOffset, rand);

    for (let slot = 0; slot < dailyOrderCount; slot += 1) {
      const source = weightedPick(rand, [
        { value: "qr" as const, weight: 7 },
        { value: "manual" as const, weight: 3 }
      ]);
      const useOneOffManualContact = source === "manual" && maybe(rand, 0.35);
      const customer = useOneOffManualContact ? null : weightedPick(rand, weightedCustomers);
      const manualContact = useOneOffManualContact
        ? weightedPick(rand, MANUAL_CONTACTS.map((contact) => ({ value: contact, weight: 1 })))
        : null;
      const fullName = customer?.fullName ?? manualContact!.fullName;
      const phone = customer?.phone ?? manualContact!.phone;
      const notes = customer?.notes ?? manualContact?.notes ?? null;
      const address = customer?.address ?? manualContact!.address;
      const submittedAt = buildSubmittedAt(dayOffset, slot, rand);
      const baseItems = createBaseItems(rand, productMap, source);
      const campaign = evaluateBestSeedCampaign(baseItems, productMap);
      const orderLines = [
        ...baseItems,
        ...(campaign?.giftItems ?? []),
        ...(campaign?.adjustmentItems ?? [])
      ];
      const totalCents = orderLines.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
      const state = getOrderState(dayOffset, rand);
      const courierId = state.deliveryStatus === DeliveryStatus.UNASSIGNED
        ? null
        : weightedPick(rand, activeCourierIds.map((value, index) => ({ value, weight: index === 0 ? 4 : index === 1 ? 3 : 2 })));
      const paymentMethod = weightedPick(rand, [
        { value: PaymentMethod.CASH_ON_DELIVERY, weight: 5 },
        { value: PaymentMethod.CARD_ON_DELIVERY, weight: 3 },
        { value: PaymentMethod.ACCOUNT_BALANCE, weight: 2 }
      ]);
      const paymentStatus = getPaymentState(rand, paymentMethod, state.status, state.deliveryStatus);
      const collectionStatus = getCollectionState(rand, paymentStatus, state.deliveryStatus);
      const reference = paymentMethod === PaymentMethod.ACCOUNT_BALANCE && paymentStatus === PaymentStatus.PAID
        ? `iyz-${submittedAt.getTime()}-${orderSequence}`
        : null;

      await prisma.order.create({
        data: {
          id: `ord_demo_javsu_${String(orderSequence).padStart(4, "0")}`,
          companyId: "company_javsu",
          customerId: customer?.id ?? null,
          courierId,
          customerName: fullName,
          phone,
          normalizedPhone: normalizePhone(phone),
          addressLine: buildAddressLine(address),
          district: address.district,
          neighborhood: address.neighborhood,
          street: address.street,
          buildingNo: address.buildingNo,
          apartmentNo: address.apartmentNo ?? null,
          siteName: address.siteName ?? null,
          addressNote: address.addressNote ?? null,
          deliveryNotes: notes,
          status: state.status,
          deliveryStatus: state.deliveryStatus,
          collectionStatus,
          source,
          submittedAt,
          createdAt: submittedAt,
          orderItems: {
            create: orderLines.map((line) => ({
              id: `ord_item_demo_${String(itemSequence++).padStart(5, "0")}`,
              productId: line.productId,
              productName: line.productName,
              quantity: line.quantity,
              unitPriceCents: line.unitPriceCents,
              createdAt: submittedAt
            }))
          },
          payments: {
            create: [
              {
                id: `pay_demo_${String(paymentSequence++).padStart(5, "0")}`,
                amountCents: totalCents,
                method: paymentMethod,
                status: paymentStatus,
                reference,
                createdAt: submittedAt
              }
            ]
          }
        }
      });

      orderSequence += 1;
    }
  }
}

async function seedMarmaraOrders() {
  const now = new Date();

  for (let index = 0; index < 6; index += 1) {
    const submittedAt = new Date(now.getTime() - (index + 2) * DAY_MS + (10 + index) * 60 * 60 * 1000);
    const quantity = index % 2 === 0 ? 2 : 1;
    const amountCents = quantity * 11900;

    await prisma.order.create({
      data: {
        id: `ord_demo_marmara_${index + 1}`,
        companyId: "company_marmara",
        customerName: `Marmara Müşteri ${index + 1}`,
        phone: `0555666000${index}`,
        normalizedPhone: normalizePhone(`0555666000${index}`),
        addressLine: `Yahya Kaptan Mah. ${index + 3}. Sok. No: ${10 + index}, İzmit / Kocaeli`,
        district: "İzmit",
        neighborhood: "Yahya Kaptan",
        street: `${index + 3}. Sok.`,
        buildingNo: `${10 + index}`,
        apartmentNo: `${index + 1}`,
        status: OrderStatus.COMPLETED,
        deliveryStatus: DeliveryStatus.DELIVERED,
        collectionStatus: index % 3 === 0 ? CollectionStatus.PAID : CollectionStatus.ON_ACCOUNT,
        source: index % 2 === 0 ? "qr" : "manual",
        courierId: "courier_marmara_1",
        submittedAt,
        createdAt: submittedAt,
        orderItems: {
          create: [
            {
              id: `ord_item_demo_marmara_${index + 1}`,
              productId: "prod_19l_marmara",
              productName: "19L Geri Dönüşlü Su",
              quantity,
              unitPriceCents: 11900,
              createdAt: submittedAt
            }
          ]
        },
        payments: {
          create: [
            {
              id: `pay_demo_marmara_${index + 1}`,
              amountCents,
              method: index % 3 === 0 ? PaymentMethod.ACCOUNT_BALANCE : PaymentMethod.CASH_ON_DELIVERY,
              status: index % 3 === 0 ? PaymentStatus.PAID : PaymentStatus.PENDING,
              createdAt: submittedAt
            }
          ]
        }
      }
    });
  }
}

async function main() {
  await prisma.adminLoginCode.deleteMany();
  await prisma.adminUser.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.courier.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.customerAddress.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.company.deleteMany();

  await seedCompanies();
  await seedAdminsAndCouriers();
  await seedProductsAndCampaigns();
  await seedCustomers();
  await seedJavsuOrders();
  await seedMarmaraOrders();
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
