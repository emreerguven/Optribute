export type ProductCategory = "water" | "soft-drink" | "bundle";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivering"
  | "completed"
  | "cancelled";
export type PaymentStatus = "pending" | "paid" | "failed" | "cancelled";
export type CampaignType = "bundle-gift" | "quantity" | "cart-discount";
export const PAYMENT_METHODS = [
  "cash-on-delivery",
  "card-on-delivery",
  "online"
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export type Company = {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  supportPhone: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  currency: string;
  orderLeadTimeMinutes: number;
};

export type Product = {
  id: string;
  companyId: string;
  name: string;
  imageUrl: string | null;
  unitLabel: string;
  priceCents: number;
  category: ProductCategory;
  isActive: boolean;
};

export type Campaign = {
  id: string;
  companyId: string;
  name: string;
  type: CampaignType;
  isActive: boolean;
  targetProductId: string | null;
  targetProductName: string | null;
  targetProductPriceCents: number | null;
  giftProductId: string | null;
  giftProductName: string | null;
  giftProductPriceCents: number | null;
  requiredQuantity: number | null;
  payableQuantity: number | null;
  minCartTotalCents: number | null;
  discountAmountCents: number | null;
  createdAt: string;
};

export type CustomerAddress = {
  id: string;
  label: string | null;
  line1: string;
  district: string | null;
  city: string | null;
  isDefault: boolean;
};

export type Customer = {
  id: string;
  companyId: string;
  fullName: string;
  phone: string;
  addresses: CustomerAddress[];
  notes?: string | null;
};

export type Payment = {
  id: string;
  orderId: string;
  amountCents: number;
  method: PaymentMethod;
  status: PaymentStatus;
  reference?: string | null;
};

export type OrderItem = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
};

export type AppliedCampaign = {
  campaignId: string;
  name: string;
  type: CampaignType;
  discountAmountCents: number;
  giftItems: OrderItem[];
  adjustmentItems: OrderItem[];
  benefitCents: number;
};

export type Order = {
  id: string;
  companyId: string;
  customerId: string | null;
  customerName: string;
  phone: string;
  addressLine: string;
  status: OrderStatus;
  createdAt: string;
  notes?: string | null;
  items: OrderItem[];
  payments: Payment[];
};

export type OrderPaymentSnapshot = Order & {
  company: Company;
};

export type OrderDraft = {
  phone: string;
  fullName: string;
  addressLine: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};
