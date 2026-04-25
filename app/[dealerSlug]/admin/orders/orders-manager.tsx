"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  buildGoogleMapsSearchUrl,
  buildMapQuery,
  formatAddressMeta,
  normalizeStructuredAddress,
  shouldShowAddressQualityWarning,
  type AddressQualityStatus,
  type StructuredAddressInput
} from "@/src/lib/address";
import { evaluateBestCampaign } from "@/src/lib/campaigns";
import { formatCurrency } from "@/src/lib/currency";
import type {
  Campaign,
  Courier,
  DeliveryStatus,
  Order,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product
} from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  dealerCity?: string | null;
  initialOrders: Order[];
  products: Product[];
  campaigns: Campaign[];
  couriers: Courier[];
  initialCourierFilter?: string;
  initialDeliveryFilter?: DeliveryStatusFilter;
  initialSourceFilter?: SourceFilter;
  initialTodayOnly?: boolean;
  initialHighlightedOrderId?: string | null;
};

type ManualOrderForm = {
  phone: string;
  fullName: string;
  addressLine: string;
  deliveryAddress: StructuredAddressInput;
  notes: string;
  paymentMethod: PaymentMethod;
};

type DeliveryDraft = {
  courierId: string;
  deliveryStatus: DeliveryStatus;
};

type DispatchPreset =
  | "unassigned"
  | "assigned"
  | "out-for-delivery"
  | "delivered"
  | "manual"
  | "qr";

type SortOption = "newest" | "oldest" | "total-desc" | "total-asc";
type OrderStatusFilter = "all" | OrderStatus;
type PaymentStatusFilter = "all" | PaymentStatus;
type SourceFilter = "all" | OrderSource;
type DeliveryStatusFilter = "all" | DeliveryStatus;
type CourierFilter = "all" | string;

type LookupPayload = {
  found: boolean;
  customer?: {
    fullName: string;
    phone: string;
    addressLine: string;
    addressQualityStatus?: AddressQualityStatus | null;
    deliveryAddress?: StructuredAddressInput | null;
    notes?: string | null;
    lastOrderDate?: string | null;
    recentOrder?: {
      id: string;
      createdAt: string;
      paymentMethod: PaymentMethod | null;
      items: Array<{
        productId: string | null;
        name: string;
        quantity: number;
      }>;
    } | null;
    frequentProducts?: Array<{
      productId: string;
      name: string;
      quantity: number;
    }>;
  };
  error?: string;
};

type AddressEditDraft = {
  addressLine: string;
  deliveryAddress: StructuredAddressInput;
};

type OperatorLookupCustomer = NonNullable<LookupPayload["customer"]>;

const EMPTY_MANUAL_FORM: ManualOrderForm = {
  phone: "",
  fullName: "",
  addressLine: "",
  deliveryAddress: {
    district: "",
    neighborhood: "",
    street: "",
    buildingNo: "",
    apartmentNo: "",
    siteName: "",
    addressNote: ""
  },
  notes: "",
  paymentMethod: "cash-on-delivery"
};

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash-on-delivery", label: "Kapıda nakit" },
  { value: "card-on-delivery", label: "Kapıda kart" },
  { value: "online", label: "Online" }
];

const DELIVERY_STATUS_OPTIONS: Array<{ value: DeliveryStatus; label: string }> = [
  { value: "unassigned", label: "Atanmadı" },
  { value: "assigned", label: "Atandı" },
  { value: "out-for-delivery", label: "Dağıtıma çıktı" },
  { value: "delivered", label: "Teslim edildi" }
];

const BULK_DELIVERY_STATUS_OPTIONS: Array<{
  value: Exclude<DeliveryStatus, "unassigned">;
  label: string;
}> = [
  { value: "assigned", label: "Atandı" },
  { value: "out-for-delivery", label: "Dağıtıma çıktı" },
  { value: "delivered", label: "Teslim edildi" }
];

const DISPATCH_PRESETS: Array<{ value: DispatchPreset; label: string }> = [
  { value: "unassigned", label: "Atanmamış" },
  { value: "assigned", label: "Atananlar" },
  { value: "out-for-delivery", label: "Dağıtımdakiler" },
  { value: "delivered", label: "Teslim edilenler" },
  { value: "manual", label: "Manuel siparişler" },
  { value: "qr", label: "QR siparişleri" }
];

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(timestamp));
}

function getIstanbulDateKey(timestamp: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(timestamp));
}

function paymentMethodLabel(method: string) {
  switch (method) {
    case "cash-on-delivery":
      return "Kapıda nakit";
    case "card-on-delivery":
      return "Kapıda kart";
    case "online":
      return "Online";
    default:
      return method;
  }
}

function paymentStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Bekliyor";
    case "paid":
      return "Ödendi";
    case "failed":
      return "Ödeme alınamadı";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}

function paymentStatusClass(status: string) {
  switch (status) {
    case "paid":
      return "payment-status-paid";
    case "failed":
      return "payment-status-failed";
    case "cancelled":
      return "payment-status-failed";
    default:
      return "payment-status-pending";
  }
}

function orderStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Yeni";
    case "confirmed":
      return "Onaylandı";
    case "preparing":
      return "Hazırlanıyor";
    case "delivering":
      return "Dağıtımda";
    case "completed":
      return "Tamamlandı";
    case "cancelled":
      return "İptal";
    default:
      return status;
  }
}

function deliveryStatusLabel(status: DeliveryStatus) {
  return DELIVERY_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

function deliveryStatusClass(status: DeliveryStatus) {
  switch (status) {
    case "delivered":
      return "delivery-status-delivered";
    case "out-for-delivery":
      return "delivery-status-out";
    case "assigned":
      return "delivery-status-assigned";
    case "unassigned":
    default:
      return "delivery-status-unassigned";
  }
}

function sourceLabel(source: OrderSource) {
  return source === "manual" ? "Manuel" : "QR";
}

function getOrderTotal(order: Order) {
  return order.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
}

function normalizeSearch(value: string) {
  return value.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

function getActionOptions(status: OrderStatus) {
  switch (status) {
    case "pending":
      return [
        { status: "preparing" as const, label: "Hazırlanıyor" },
        { status: "completed" as const, label: "Tamamlandı" },
        { status: "cancelled" as const, label: "İptal et" }
      ];
    case "preparing":
      return [
        { status: "completed" as const, label: "Tamamlandı" },
        { status: "cancelled" as const, label: "İptal et" }
      ];
    case "confirmed":
    case "delivering":
    case "completed":
    case "cancelled":
      return [];
  }
}

function getInitialDeliveryDraft(order: Order): DeliveryDraft {
  return {
    courierId: order.courier?.id ?? "",
    deliveryStatus: order.deliveryStatus
  };
}

function getInitialAddressDraft(order: Order): AddressEditDraft {
  return {
    addressLine: order.addressLineRaw ?? order.addressLine,
    deliveryAddress: {
      district: order.deliveryAddress.district ?? "",
      neighborhood: order.deliveryAddress.neighborhood ?? "",
      street: order.deliveryAddress.street ?? "",
      buildingNo: order.deliveryAddress.buildingNo ?? "",
      apartmentNo: order.deliveryAddress.apartmentNo ?? "",
      siteName: order.deliveryAddress.siteName ?? "",
      addressNote: order.deliveryAddress.addressNote ?? ""
    }
  };
}

function addressQualityLabel(status: AddressQualityStatus) {
  switch (status) {
    case "verified":
      return "Adres uygun";
    case "failed":
      return "Adres doğrulaması zayıf";
    case "partial":
    default:
      return "Kontrol edilmeli";
  }
}

function addressQualityHint(status: AddressQualityStatus) {
  switch (status) {
    case "verified":
      return "Harita araması için güçlü görünüyor.";
    case "failed":
      return "Adres açık değil. Kurye çıkmadan önce kontrol edin.";
    case "partial":
    default:
      return "Adres kullanılabilir görünüyor ama küçük bir düzeltme gerekebilir.";
  }
}

function addressQualityClass(status: AddressQualityStatus) {
  switch (status) {
    case "verified":
      return "address-quality-verified";
    case "failed":
      return "address-quality-failed";
    case "partial":
    default:
      return "address-quality-partial";
  }
}

export function OrdersManager({
  dealerSlug,
  dealerCity = null,
  initialOrders,
  products,
  campaigns,
  couriers,
  initialCourierFilter = "all",
  initialDeliveryFilter = "all",
  initialSourceFilter = "all",
  initialTodayOnly = false,
  initialHighlightedOrderId = null
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedOrderIds, setExpandedOrderIds] = useState<string[]>(
    initialHighlightedOrderId ? [initialHighlightedOrderId] : []
  );
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [manualForm, setManualForm] = useState<ManualOrderForm>(EMPTY_MANUAL_FORM);
  const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, DeliveryDraft>>({});
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [lookupCustomer, setLookupCustomer] = useState<OperatorLookupCustomer | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>(initialSourceFilter);
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>(initialDeliveryFilter);
  const [courierFilter, setCourierFilter] = useState<CourierFilter>(initialCourierFilter);
  const [todayOnly, setTodayOnly] = useState(initialTodayOnly);
  const [sortOption, setSortOption] = useState<SortOption>("newest");
  const [bulkCourierId, setBulkCourierId] = useState("");
  const [bulkDeliveryStatus, setBulkDeliveryStatus] = useState<Exclude<DeliveryStatus, "unassigned">>("assigned");
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);
  const [editingAddressOrderId, setEditingAddressOrderId] = useState<string | null>(null);
  const [addressDrafts, setAddressDrafts] = useState<Record<string, AddressEditDraft>>({});

  useEffect(() => {
    if (!initialHighlightedOrderId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      const element = document.getElementById(`order-${initialHighlightedOrderId}`);
      element?.scrollIntoView({ block: "center", behavior: "smooth" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialHighlightedOrderId]);

  const manualAddressPreview = useMemo(
    () =>
      normalizeStructuredAddress({
        addressLine: manualForm.addressLine,
        ...manualForm.deliveryAddress
      }),
    [manualForm.addressLine, manualForm.deliveryAddress]
  );

  const selectedManualItems = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          quantity: manualQuantities[product.id] ?? 0
        }))
        .filter((entry) => entry.quantity > 0),
    [manualQuantities, products]
  );

  const manualPreviewItems = useMemo(
    () =>
      selectedManualItems.map((entry) => ({
        productId: entry.product.id,
        name: entry.product.name,
        quantity: entry.quantity,
        unitPriceCents: entry.product.priceCents
      })),
    [selectedManualItems]
  );

  const manualCampaignPreview = useMemo(
    () => evaluateBestCampaign(campaigns, manualPreviewItems),
    [campaigns, manualPreviewItems]
  );
  const activeCouriers = useMemo(
    () => couriers.filter((courier) => courier.isActive),
    [couriers]
  );

  const visibleOrders = useMemo(() => {
    const query = normalizeSearch(searchTerm);
    const todayKey = getIstanbulDateKey(new Date().toISOString());

    return [...orders]
      .filter((order) => {
        const primaryPayment = order.payments[0];
        const searchable = normalizeSearch(`${order.customerName} ${order.phone}`);

        if (query && !searchable.includes(query)) {
          return false;
        }

        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }

        if (paymentStatusFilter !== "all" && primaryPayment?.status !== paymentStatusFilter) {
          return false;
        }

        if (sourceFilter !== "all" && order.source !== sourceFilter) {
          return false;
        }

        if (deliveryStatusFilter !== "all" && order.deliveryStatus !== deliveryStatusFilter) {
          return false;
        }

        if (courierFilter !== "all" && order.courier?.id !== courierFilter) {
          return false;
        }

        if (todayOnly && getIstanbulDateKey(order.createdAt) !== todayKey) {
          return false;
        }

        return true;
      })
      .sort((first, second) => {
        switch (sortOption) {
          case "oldest":
            return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
          case "total-desc":
            return getOrderTotal(second) - getOrderTotal(first);
          case "total-asc":
            return getOrderTotal(first) - getOrderTotal(second);
          case "newest":
          default:
            return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
        }
      });
  }, [
    courierFilter,
    deliveryStatusFilter,
    orders,
    paymentStatusFilter,
    searchTerm,
    sortOption,
    sourceFilter,
    statusFilter,
    todayOnly
  ]);
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderIds.includes(order.id)),
    [orders, selectedOrderIds]
  );
  const allVisibleSelected =
    visibleOrders.length > 0 && visibleOrders.every((order) => selectedOrderIds.includes(order.id));
  const activeDispatchPreset = useMemo(() => {
    if (deliveryStatusFilter !== "all" && sourceFilter === "all") {
      return deliveryStatusFilter as DispatchPreset;
    }

    if (sourceFilter !== "all" && deliveryStatusFilter === "all") {
      return sourceFilter as DispatchPreset;
    }

    return null;
  }, [deliveryStatusFilter, sourceFilter]);
  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchTerm) ||
      statusFilter !== "all" ||
      paymentStatusFilter !== "all" ||
      sourceFilter !== "all" ||
      deliveryStatusFilter !== "all" ||
      courierFilter !== "all" ||
      todayOnly ||
      sortOption !== "newest",
    [
      courierFilter,
      deliveryStatusFilter,
      paymentStatusFilter,
      searchTerm,
      sortOption,
      sourceFilter,
      statusFilter,
      todayOnly
    ]
  );

  function updateManualQuantity(productId: string, value: number) {
    setManualQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.floor(value))
    }));
  }

  function applyProductLines(
    items: Array<{
      productId: string | null;
      quantity: number;
    }>
  ) {
    const nextQuantities: Record<string, number> = {};

    for (const item of items) {
      if (!item.productId) {
        continue;
      }

      const productExists = products.some((product) => product.id === item.productId);

      if (!productExists) {
        continue;
      }

      nextQuantities[item.productId] = Math.max(0, Math.floor(item.quantity));
    }

    setManualQuantities(nextQuantities);
  }

  function repeatLastOrder() {
    if (!lookupCustomer?.recentOrder) {
      return;
    }

    applyProductLines(lookupCustomer.recentOrder.items);

    setManualForm((current) => ({
      ...current,
      phone: lookupCustomer.phone ?? current.phone,
      fullName: lookupCustomer.fullName ?? current.fullName,
      addressLine: lookupCustomer.addressLine ?? current.addressLine,
      deliveryAddress: lookupCustomer.deliveryAddress
        ? {
            district: lookupCustomer.deliveryAddress.district ?? "",
            neighborhood: lookupCustomer.deliveryAddress.neighborhood ?? "",
            street: lookupCustomer.deliveryAddress.street ?? "",
            buildingNo: lookupCustomer.deliveryAddress.buildingNo ?? "",
            apartmentNo: lookupCustomer.deliveryAddress.apartmentNo ?? "",
            siteName: lookupCustomer.deliveryAddress.siteName ?? "",
            addressNote: lookupCustomer.deliveryAddress.addressNote ?? ""
          }
        : current.deliveryAddress,
      notes: lookupCustomer.notes ?? current.notes,
      paymentMethod: lookupCustomer.recentOrder?.paymentMethod ?? current.paymentMethod
    }));

    setLookupMessage("Son sipariş ürünleri forma aktarıldı.");
  }

  function applyFrequentProductShortcut(productId: string, quantity: number) {
    const safeQuantity = Math.max(1, Math.floor(quantity));

    setManualQuantities((current) => ({
      ...current,
      [productId]: safeQuantity
    }));
  }

  function getDeliveryDraft(order: Order) {
    return deliveryDrafts[order.id] ?? getInitialDeliveryDraft(order);
  }

  function setDeliveryDraft(order: Order, patch: Partial<DeliveryDraft>) {
    setDeliveryDrafts((current) => {
      const existing = current[order.id] ?? getInitialDeliveryDraft(order);
      const next = { ...existing, ...patch };

      if (!next.courierId) {
        next.deliveryStatus = "unassigned";
      }

      return {
        ...current,
        [order.id]: next
      };
    });
  }

  function getAddressDraft(order: Order) {
    return addressDrafts[order.id] ?? getInitialAddressDraft(order);
  }

  function setAddressDraft(order: Order, patch: Partial<AddressEditDraft>) {
    setAddressDrafts((current) => {
      const existing = current[order.id] ?? getInitialAddressDraft(order);
      const next: AddressEditDraft = {
        ...existing,
        ...patch,
        deliveryAddress: {
          ...existing.deliveryAddress,
          ...(patch.deliveryAddress ?? {})
        }
      };

      return {
        ...current,
        [order.id]: next
      };
    });
  }

  function toggleOrderExpanded(orderId: string) {
    setExpandedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  }

  function toggleOrderSelected(orderId: string) {
    setSelectedOrderIds((current) =>
      current.includes(orderId)
        ? current.filter((id) => id !== orderId)
        : [...current, orderId]
    );
  }

  function selectAllVisibleOrders() {
    setSelectedOrderIds((current) => {
      const next = new Set(current);
      visibleOrders.forEach((order) => next.add(order.id));
      return [...next];
    });
  }

  function clearSelectedOrders() {
    setSelectedOrderIds([]);
  }

  function applyDispatchPreset(preset: DispatchPreset) {
    if (
      preset === "unassigned" ||
      preset === "assigned" ||
      preset === "out-for-delivery" ||
      preset === "delivered"
    ) {
      setDeliveryStatusFilter(preset);
      setSourceFilter("all");
      return;
    }

    setSourceFilter(preset);
    setDeliveryStatusFilter("all");
  }

  function resetFilters() {
    setSearchTerm("");
    setStatusFilter("all");
    setPaymentStatusFilter("all");
    setSourceFilter("all");
    setDeliveryStatusFilter("all");
    setCourierFilter("all");
    setTodayOnly(false);
    setSortOption("newest");
  }

  async function handleCustomerLookup() {
    if (!manualForm.phone.trim()) {
      setLookupMessage("Telefon numarası girin.");
      return;
    }

    setIsLookingUp(true);
    setLookupMessage(null);
    setCreateMessage(null);

    try {
      const response = await fetch(
        `/api/dealers/${dealerSlug}/customers/lookup?phone=${encodeURIComponent(manualForm.phone)}`
      );
      const payload = (await response.json()) as LookupPayload;

      if (!response.ok) {
        throw new Error(payload.error ?? "Müşteri bilgisi alınamadı");
      }

      if (!payload.found || !payload.customer) {
        setLookupCustomer(null);
        setLookupMessage("Kayıt bulunamadı. Bilgileri manuel girin.");
        return;
      }

      setManualForm((current) => ({
        ...current,
        phone: payload.customer?.phone ?? current.phone,
        fullName: payload.customer?.fullName ?? current.fullName,
        addressLine: payload.customer?.addressLine ?? current.addressLine,
        deliveryAddress: payload.customer?.deliveryAddress
          ? {
              district: payload.customer.deliveryAddress.district ?? "",
              neighborhood: payload.customer.deliveryAddress.neighborhood ?? "",
              street: payload.customer.deliveryAddress.street ?? "",
              buildingNo: payload.customer.deliveryAddress.buildingNo ?? "",
              apartmentNo: payload.customer.deliveryAddress.apartmentNo ?? "",
              siteName: payload.customer.deliveryAddress.siteName ?? "",
              addressNote: payload.customer.deliveryAddress.addressNote ?? ""
            }
          : current.deliveryAddress,
        notes: payload.customer?.notes ?? current.notes
      }));
      setLookupCustomer(payload.customer);
      setLookupMessage("Müşteri bilgileri getirildi.");
    } catch (error) {
      setLookupCustomer(null);
      const nextMessage = error instanceof Error ? error.message : "Müşteri bilgisi alınamadı";
      setLookupMessage(nextMessage);
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleCreateOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);
    setMessage(null);

    if (!manualForm.phone.trim() || !manualForm.fullName.trim() || !manualAddressPreview.addressLine) {
      setCreateMessage("Telefon, ad soyad ve teslimat adresi zorunludur.");
      return;
    }

    if (selectedManualItems.length === 0) {
      setCreateMessage("En az bir ürün seçin.");
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone: manualForm.phone,
          fullName: manualForm.fullName,
          addressLine: manualForm.addressLine,
          delivery_address: manualForm.deliveryAddress,
          notes: manualForm.notes,
          payment_method: manualForm.paymentMethod,
          source: "manual",
          items: selectedManualItems.map((entry) => ({
            productId: entry.product.id,
            quantity: entry.quantity
          }))
        })
      });
      const payload = (await response.json()) as {
        order?: Order;
        error?: string;
        paymentPageUrl?: string;
      };

      if (!response.ok || !payload.order) {
        throw new Error(payload.error ?? "Sipariş eklenemedi");
      }

      setOrders((current) => [payload.order!, ...current.filter((order) => order.id !== payload.order!.id)]);
      setManualForm(EMPTY_MANUAL_FORM);
      setManualQuantities({});
      setLookupCustomer(null);
      setLookupMessage(null);
      setCreateMessage(
        payload.paymentPageUrl ? "Sipariş eklendi. Online ödeme bekliyor." : "Sipariş eklendi."
      );
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Sipariş eklenemedi";
      setCreateMessage(nextMessage);
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusUpdate(orderId: string, nextStatus: OrderStatus) {
    setActiveOrderId(orderId);
    setMessage(null);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/orders/${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          status: nextStatus
        })
      });

      const payload = (await response.json()) as { order?: Order; error?: string };

      if (!response.ok || !payload.order) {
        throw new Error(payload.error ?? "Sipariş durumu güncellenemedi");
      }

      setOrders((current) =>
        current.map((order) => (order.id === payload.order?.id ? payload.order : order))
      );
      setMessage("Sipariş durumu güncellendi.");
    } catch (error) {
      const nextMessage =
        error instanceof Error ? error.message : "Sipariş durumu güncellenemedi";
      setMessage(nextMessage);
    } finally {
      setActiveOrderId(null);
    }
  }

  async function handleDeliverySave(order: Order) {
    const draft = getDeliveryDraft(order);

    setActiveOrderId(order.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/orders/${order.id}/delivery`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          courierId: draft.courierId || null,
          deliveryStatus: draft.courierId ? draft.deliveryStatus : "unassigned"
        })
      });

      const payload = (await response.json()) as { order?: Order; error?: string };

      if (!response.ok || !payload.order) {
        throw new Error(payload.error ?? "Teslimat bilgisi güncellenemedi");
      }

      setOrders((current) =>
        current.map((currentOrder) =>
          currentOrder.id === payload.order?.id ? payload.order : currentOrder
        )
      );
      setDeliveryDrafts((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setMessage("Kurye ataması güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Teslimat bilgisi güncellenemedi");
    } finally {
      setActiveOrderId(null);
    }
  }

  async function handleBulkCourierAssign() {
    if (!bulkCourierId || selectedOrders.length === 0) {
      setMessage("Toplu atama için kurye ve sipariş seçin.");
      return;
    }

    setIsBulkUpdating(true);
    setMessage(null);

    try {
      const updatedOrders = await Promise.all(
        selectedOrders.map(async (order) => {
          const response = await fetch(`/api/dealers/${dealerSlug}/orders/${order.id}/delivery`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              courierId: bulkCourierId,
              deliveryStatus: order.deliveryStatus === "unassigned" ? "assigned" : order.deliveryStatus
            })
          });
          const payload = (await response.json()) as { order?: Order; error?: string };

          if (!response.ok || !payload.order) {
            throw new Error(payload.error ?? "Toplu kurye ataması yapılamadı");
          }

          return payload.order;
        })
      );

      const updatedMap = new Map(updatedOrders.map((order) => [order.id, order]));
      setOrders((current) => current.map((order) => updatedMap.get(order.id) ?? order));
      setSelectedOrderIds([]);
      setBulkCourierId("");
      setMessage("Seçili siparişler kuryeye atandı.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Toplu kurye ataması yapılamadı");
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleBulkDeliveryStatusUpdate() {
    if (selectedOrders.length === 0) {
      setMessage("Toplu durum güncellemesi için sipariş seçin.");
      return;
    }

    const missingCourierOrders = selectedOrders.filter(
      (order) => !(bulkCourierId || order.courier?.id)
    );

    if (missingCourierOrders.length > 0) {
      setMessage("Kurye seçilmemiş siparişler için önce kurye atayın.");
      return;
    }

    setIsBulkUpdating(true);
    setMessage(null);

    try {
      const updatedOrders = await Promise.all(
        selectedOrders.map(async (order) => {
          const response = await fetch(`/api/dealers/${dealerSlug}/orders/${order.id}/delivery`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              courierId: bulkCourierId || order.courier?.id || null,
              deliveryStatus: bulkDeliveryStatus
            })
          });
          const payload = (await response.json()) as { order?: Order; error?: string };

          if (!response.ok || !payload.order) {
            throw new Error(payload.error ?? "Toplu teslimat durumu güncellenemedi");
          }

          return payload.order;
        })
      );

      const updatedMap = new Map(updatedOrders.map((order) => [order.id, order]));
      setOrders((current) => current.map((order) => updatedMap.get(order.id) ?? order));
      setSelectedOrderIds([]);
      setMessage("Seçili siparişlerin teslimat durumu güncellendi.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Toplu teslimat durumu güncellenemedi"
      );
    } finally {
      setIsBulkUpdating(false);
    }
  }

  async function handleAddressSave(order: Order) {
    const draft = getAddressDraft(order);

    setActiveOrderId(order.id);
    setMessage(null);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/orders/${order.id}/address`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          addressLine: draft.addressLine,
          delivery_address: draft.deliveryAddress
        })
      });

      const payload = (await response.json()) as { order?: Order; error?: string };

      if (!response.ok || !payload.order) {
        throw new Error(payload.error ?? "Adres güncellenemedi");
      }

      setOrders((current) =>
        current.map((currentOrder) =>
          currentOrder.id === payload.order?.id ? payload.order : currentOrder
        )
      );
      setAddressDrafts((current) => {
        const next = { ...current };
        delete next[order.id];
        return next;
      });
      setEditingAddressOrderId((current) => (current === order.id ? null : current));
      setMessage("Adres bilgisi güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Adres güncellenemedi");
    } finally {
      setActiveOrderId(null);
    }
  }

  return (
    <section className="panel stack">
      <div className="admin-console-shell stack">
      <div className="admin-console-head">
        <div>
          <span className="kicker">Sipariş ekranı</span>
          <h2>Sipariş listesi</h2>
          <p className="caption">Arayın, süzün ve teslimat akışını yönetin.</p>
        </div>
        <button type="button" className="button" onClick={() => setIsCreateOpen((current) => !current)}>
          {isCreateOpen ? "Yeni sipariş panelini kapat" : "Yeni sipariş ekle"}
        </button>
      </div>

      <div className="admin-console-toolbar admin-console-toolbar-wide admin-console-toolbar-sticky orders-control-bar">
        <div className="dispatch-preset-row">
          {DISPATCH_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`dispatch-preset-chip ${
                activeDispatchPreset === preset.value ? "dispatch-preset-chip-active" : ""
              }`}
              onClick={() => applyDispatchPreset(preset.value)}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            className={`dispatch-preset-chip ${todayOnly ? "dispatch-preset-chip-active" : ""}`}
            onClick={() => setTodayOnly((current) => !current)}
          >
            Bugün
          </button>
        </div>
        <label className={`filter-field ${searchTerm ? "filter-field-active" : ""}`}>
          Arama
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ad veya telefon"
          />
        </label>
        <label className={`filter-field ${statusFilter !== "all" ? "filter-field-active" : ""}`}>
          Sipariş durumu
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as OrderStatusFilter)}
          >
            <option value="all">Tümü</option>
            <option value="pending">Yeni</option>
            <option value="preparing">Hazırlanıyor</option>
            <option value="completed">Tamamlandı</option>
            <option value="cancelled">İptal</option>
          </select>
        </label>
        <label className={`filter-field ${paymentStatusFilter !== "all" ? "filter-field-active" : ""}`}>
          Ödeme durumu
          <select
            value={paymentStatusFilter}
            onChange={(event) => setPaymentStatusFilter(event.target.value as PaymentStatusFilter)}
          >
            <option value="all">Tümü</option>
            <option value="pending">Bekliyor</option>
            <option value="paid">Ödendi</option>
            <option value="failed">Ödeme alınamadı</option>
            <option value="cancelled">İptal</option>
          </select>
        </label>
        <label className={`filter-field ${sourceFilter !== "all" ? "filter-field-active" : ""}`}>
          Kaynak
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
          >
            <option value="all">Tümü</option>
            <option value="qr">QR</option>
            <option value="manual">Manuel</option>
          </select>
        </label>
        <label className={`filter-field ${deliveryStatusFilter !== "all" ? "filter-field-active" : ""}`}>
          Teslimat
          <select
            value={deliveryStatusFilter}
            onChange={(event) => setDeliveryStatusFilter(event.target.value as DeliveryStatusFilter)}
          >
            <option value="all">Tümü</option>
            {DELIVERY_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`filter-field ${courierFilter !== "all" ? "filter-field-active" : ""}`}>
          Kurye
          <select
            value={courierFilter}
            onChange={(event) => setCourierFilter(event.target.value as CourierFilter)}
          >
            <option value="all">Tümü</option>
            {couriers.map((courier) => (
              <option key={courier.id} value={courier.id}>
                {courier.fullName}
              </option>
            ))}
          </select>
        </label>
        <label className={`filter-field ${sortOption !== "newest" ? "filter-field-active" : ""}`}>
          Sıralama
          <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
            <option value="newest">En yeni</option>
            <option value="oldest">En eski</option>
            <option value="total-desc">Tutar yüksekten düşüğe</option>
            <option value="total-asc">Tutar düşükten yükseğe</option>
          </select>
        </label>
        <div className="dispatch-selection-row">
          {hasActiveFilters ? (
            <span className="active-filter-indicator">Filtreli görünüm</span>
          ) : null}
          <button
            type="button"
            className="button-secondary admin-inline-button"
            onClick={selectAllVisibleOrders}
            disabled={visibleOrders.length === 0 || allVisibleSelected}
          >
            Tümünü seç
          </button>
          <button
            type="button"
            className="button-secondary admin-inline-button"
            onClick={clearSelectedOrders}
            disabled={selectedOrderIds.length === 0}
          >
            Seçimi temizle
          </button>
          <span className="caption">{selectedOrderIds.length} sipariş seçili</span>
          <button
            type="button"
            className="button-secondary admin-inline-button"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
          >
            Filtreleri sıfırla
          </button>
        </div>
        {selectedOrderIds.length > 0 ? (
          <div className="bulk-action-bar">
            <label>
              Toplu kurye atama
              <select
                value={bulkCourierId}
                onChange={(event) => setBulkCourierId(event.target.value)}
                disabled={isBulkUpdating}
              >
                <option value="">Kurye seçin</option>
                {activeCouriers.map((courier) => (
                  <option key={courier.id} value={courier.id}>
                    {courier.fullName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button-secondary admin-inline-button"
              onClick={handleBulkCourierAssign}
              disabled={isBulkUpdating || !bulkCourierId}
            >
              {isBulkUpdating ? "İşleniyor..." : "Seçili siparişlere kurye ata"}
            </button>
            <label>
              Toplu teslimat durumu
              <select
                value={bulkDeliveryStatus}
                onChange={(event) =>
                  setBulkDeliveryStatus(
                    event.target.value as Exclude<DeliveryStatus, "unassigned">
                  )
                }
                disabled={isBulkUpdating}
              >
                {BULK_DELIVERY_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="button admin-inline-button"
              onClick={handleBulkDeliveryStatusUpdate}
              disabled={isBulkUpdating}
            >
              {isBulkUpdating ? "İşleniyor..." : "Seçili siparişlerde durumu uygula"}
            </button>
          </div>
        ) : null}
      </div>
      </div>

      {isCreateOpen ? (
        <form className="manual-order-panel stack" onSubmit={handleCreateOrder}>
          <div className="order-topline">
            <div>
              <span className="detail-label">Yeni sipariş</span>
              <h3>Manuel sipariş oluştur</h3>
            </div>
            <span className="source-badge source-badge-manual">Manuel</span>
          </div>

          <div className="manual-customer-grid">
            <label className="manual-phone-field">
              Telefon
              <div className="phone-row">
                <input
                  value={manualForm.phone}
                  onChange={(event) =>
                    {
                      setLookupCustomer(null);
                      setManualForm((current) => ({ ...current, phone: event.target.value }));
                    }
                  }
                  placeholder="05xx xxx xx xx"
                />
                <button
                  type="button"
                  className="button-secondary admin-inline-button"
                  onClick={handleCustomerLookup}
                  disabled={isLookingUp}
                >
                  {isLookingUp ? "Aranıyor..." : "Müşteriyi getir"}
                </button>
              </div>
            </label>
            <label>
              Ad soyad
              <input
                value={manualForm.fullName}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Müşteri adı"
              />
            </label>
            <div className="manual-form-wide structured-address-panel stack compact-stack">
              <div>
                <span className="detail-label">Teslimat adresi</span>
                <p className="caption">Yapısal alanları doldurun. Açık adres satırı opsiyoneldir.</p>
              </div>
              <div className="structured-address-grid">
                <label>
                  İlçe
                  <input
                    value={manualForm.deliveryAddress.district ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          district: event.target.value
                        }
                      }))
                    }
                    placeholder="Örn. Ümraniye"
                  />
                </label>
                <label>
                  Mahalle
                  <input
                    value={manualForm.deliveryAddress.neighborhood ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          neighborhood: event.target.value
                        }
                      }))
                    }
                    placeholder="Örn. Atatürk Mah."
                  />
                </label>
                <label className="manual-form-wide">
                  Cadde / Sokak
                  <input
                    value={manualForm.deliveryAddress.street ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          street: event.target.value
                        }
                      }))
                    }
                    placeholder="Örn. Çiçek Sok."
                  />
                </label>
                <label>
                  Bina no
                  <input
                    value={manualForm.deliveryAddress.buildingNo ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          buildingNo: event.target.value
                        }
                      }))
                    }
                    placeholder="12"
                  />
                </label>
                <label>
                  Daire no
                  <input
                    value={manualForm.deliveryAddress.apartmentNo ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          apartmentNo: event.target.value
                        }
                      }))
                    }
                    placeholder="4"
                  />
                </label>
                <label className="manual-form-wide">
                  Site / Apartman
                  <input
                    value={manualForm.deliveryAddress.siteName ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          siteName: event.target.value
                        }
                      }))
                    }
                    placeholder="Örn. Gülistan Sitesi"
                  />
                </label>
                <label className="manual-form-wide">
                  Adres notu
                  <input
                    value={manualForm.deliveryAddress.addressNote ?? ""}
                    onChange={(event) =>
                      setManualForm((current) => ({
                        ...current,
                        deliveryAddress: {
                          ...current.deliveryAddress,
                          addressNote: event.target.value
                        }
                      }))
                    }
                    placeholder="Kapı kodu, blok bilgisi vb."
                  />
                </label>
                <label className="manual-form-wide">
                  Açık adres satırı
                  <textarea
                    value={manualForm.addressLine}
                    onChange={(event) =>
                      setManualForm((current) => ({ ...current, addressLine: event.target.value }))
                    }
                    placeholder="İsterseniz açık adresi manuel yazın"
                  />
                </label>
              </div>
              <div className="summary-card compact-stack">
                <span className="detail-label">Adres özeti</span>
                <strong>{manualAddressPreview.addressLine || "Adres alanlarını doldurun"}</strong>
                {formatAddressMeta(manualAddressPreview) ? (
                  <span className="caption">{formatAddressMeta(manualAddressPreview)}</span>
                ) : null}
              </div>
          </div>

          {lookupCustomer ? (
            <div className="manual-form-wide summary-card stack compact-stack operator-customer-card">
              <div className="order-topline">
                <div>
                  <span className="detail-label">Kayıtlı müşteri</span>
                  <h3>{lookupCustomer.fullName}</h3>
                </div>
                <span className="pill">{lookupCustomer.phone}</span>
              </div>

              <div className="operator-customer-grid">
                <div className="detail-block">
                  <span className="detail-label">Kayıtlı adres</span>
                  <strong>{lookupCustomer.addressLine || "Adres yok"}</strong>
                </div>
                <div className="detail-block">
                  <span className="detail-label">Son sipariş</span>
                  <strong>
                    {lookupCustomer.lastOrderDate
                      ? formatOrderTime(lookupCustomer.lastOrderDate)
                      : "Sipariş yok"}
                  </strong>
                </div>
              </div>

              {lookupCustomer.recentOrder ? (
                <div className="operator-last-order stack compact-stack">
                  <div className="order-topline">
                    <div>
                      <span className="detail-label">Son sipariş</span>
                      <p className="caption">
                        {formatOrderTime(lookupCustomer.recentOrder.createdAt)}
                        {lookupCustomer.recentOrder.paymentMethod
                          ? ` • ${paymentMethodLabel(lookupCustomer.recentOrder.paymentMethod)}`
                          : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="button-secondary admin-inline-button"
                      onClick={repeatLastOrder}
                    >
                      Son siparişi tekrar et
                    </button>
                  </div>

                  <div className="operator-line-list">
                    {lookupCustomer.recentOrder.items.map((item, index) => (
                      <div key={`${item.productId ?? item.name}_${index}`} className="summary-row">
                        <span>{item.quantity} x {item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {lookupCustomer.frequentProducts && lookupCustomer.frequentProducts.length > 0 ? (
                <div className="stack compact-stack">
                  <span className="detail-label">Hızlı ekle</span>
                  <div className="operator-quick-products">
                    {lookupCustomer.frequentProducts.map((item) => (
                      <button
                        key={item.productId}
                        type="button"
                        className="button-secondary admin-inline-button"
                        onClick={() => applyFrequentProductShortcut(item.productId, item.quantity)}
                      >
                        {item.name} • {item.quantity} adet
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

            <label>
              Not
              <input
                value={manualForm.notes}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, notes: event.target.value }))
                }
                placeholder="Kapı notu, saat tercihi vb."
              />
            </label>
            <label>
              Ödeme yöntemi
              <select
                value={manualForm.paymentMethod}
                onChange={(event) =>
                  setManualForm((current) => ({
                    ...current,
                    paymentMethod: event.target.value as PaymentMethod
                  }))
                }
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {lookupMessage ? <div className="note">{lookupMessage}</div> : null}

          <div className="manual-products stack">
            <div>
              <span className="detail-label">Ürünler</span>
              <p className="caption">Siparişe eklenecek adetleri girin.</p>
            </div>
            {products.length === 0 ? (
              <div className="note warning">Aktif ürün bulunmuyor.</div>
            ) : (
              <div className="manual-product-grid">
                {products.map((product) => {
                  const quantity = manualQuantities[product.id] ?? 0;

                  return (
                    <div key={product.id} className="manual-product-card">
                      <div>
                        <strong>{product.name}</strong>
                        <span className="caption">{formatCurrency(product.priceCents)}</span>
                      </div>
                      <div className="manual-quantity-control">
                        <button
                          type="button"
                          onClick={() => updateManualQuantity(product.id, quantity - 1)}
                          aria-label={`${product.name} azalt`}
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(event) => updateManualQuantity(product.id, Number(event.target.value))}
                          aria-label={`${product.name} adet`}
                        />
                        <button
                          type="button"
                          onClick={() => updateManualQuantity(product.id, quantity + 1)}
                          aria-label={`${product.name} artır`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="manual-preview-card stack compact-stack">
            <div>
              <span className="detail-label">Canlı önizleme</span>
              <p className="caption">Sipariş oluşturulduğunda tutar tekrar kontrol edilir.</p>
            </div>

            {manualPreviewItems.length === 0 ? (
              <div className="caption">Önizleme için ürün seçin.</div>
            ) : (
              <>
                {manualPreviewItems.map((item) => (
                  <div key={item.productId} className="summary-row">
                    <span>{item.quantity} x {item.name}</span>
                    <strong>{formatCurrency(item.quantity * item.unitPriceCents)}</strong>
                  </div>
                ))}

                <div className="separator" />

                <div className="summary-row">
                  <span>Ara toplam</span>
                  <strong>{formatCurrency(manualCampaignPreview.subtotalCents)}</strong>
                </div>

                {manualCampaignPreview.appliedCampaign ? (
                  <div className="campaign-preview-block stack compact-stack">
                    <div>
                      <strong>Uygulanacak kampanya: {manualCampaignPreview.appliedCampaign.name}</strong>
                    </div>

                    {manualCampaignPreview.appliedCampaign.giftItems.map((item) => (
                      <div key={`${item.productId}_${item.name}`} className="summary-row">
                        <span>Kampanya ürünü: {item.quantity} x {item.name}</span>
                        <strong>{formatCurrency(item.quantity * item.unitPriceCents)}</strong>
                      </div>
                    ))}

                    {manualCampaignPreview.appliedCampaign.discountAmountCents > 0 ? (
                      <div className="summary-row">
                        <span>Joker indirimi</span>
                        <strong>
                          -{formatCurrency(manualCampaignPreview.appliedCampaign.discountAmountCents)}
                        </strong>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="caption">Bu seçim için kampanya yok.</div>
                )}

                <div className="summary-row total-row manual-total-row">
                  <span>Toplam</span>
                  <strong>{formatCurrency(manualCampaignPreview.finalTotalCents)}</strong>
                </div>
              </>
            )}
          </div>

          {createMessage ? (
            <div className={`note ${createMessage.includes("eklendi") ? "" : "warning"}`}>
              {createMessage}
            </div>
          ) : null}

          <button type="submit" className="button admin-submit" disabled={isCreating || products.length === 0}>
            {isCreating ? "Ekleniyor..." : "Siparişi ekle"}
          </button>
        </form>
      ) : null}

      {message ? (
        <div className={`note ${message.includes("güncellendi") || message.includes("ataması") ? "" : "warning"}`}>{message}</div>
      ) : null}

      <div className="order-list-summary">
        <strong>{visibleOrders.length}</strong>
        <span className="caption">sipariş gösteriliyor</span>
      </div>

      {orders.length === 0 ? (
        <div className="note">Bu bayi için henüz sipariş bulunmuyor.</div>
      ) : visibleOrders.length === 0 ? (
        <div className="note">Arama ve filtrelere uygun sipariş bulunamadı.</div>
      ) : (
        <div className="admin-order-list">
          {visibleOrders.map((order) => {
            const total = getOrderTotal(order);
            const primaryPayment = order.payments[0];
            const actionOptions = getActionOptions(order.status);
            const isUpdating = activeOrderId === order.id;
            const isExpanded = expandedOrderIds.includes(order.id);
            const deliveryDraft = getDeliveryDraft(order);
            const deliveryChanged =
              deliveryDraft.courierId !== (order.courier?.id ?? "") ||
              deliveryDraft.deliveryStatus !== order.deliveryStatus;
            const addressDraft = getAddressDraft(order);
            const addressPreview = normalizeStructuredAddress({
              addressLine: addressDraft.addressLine,
              ...addressDraft.deliveryAddress
            });
            const addressChanged =
              addressDraft.addressLine !== (order.addressLineRaw ?? order.addressLine) ||
              JSON.stringify(addressDraft.deliveryAddress) !==
                JSON.stringify(getInitialAddressDraft(order).deliveryAddress);
            const isEditingAddress = editingAddressOrderId === order.id;
            const mapQuery = buildMapQuery(order.deliveryAddress, {
              normalizedAddressLine: order.addressLineNormalized ?? order.addressLine,
              rawAddressLine: order.addressLineRaw ?? order.addressLine,
              city: dealerCity
            });
            const selectableCouriers = couriers.filter(
              (courier) => courier.isActive || courier.id === order.courier?.id || courier.id === deliveryDraft.courierId
            );

            return (
              <article
                key={order.id}
                id={`order-${order.id}`}
                className={`order-card order-card-compact ${selectedOrderIds.includes(order.id) ? "order-card-selected" : ""} ${
                  initialHighlightedOrderId === order.id ? "order-card-highlighted" : ""
                }`}
              >
                <div className="order-summary-compact order-summary-row">
                  <label className="order-select-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedOrderIds.includes(order.id)}
                      onChange={() => toggleOrderSelected(order.id)}
                      aria-label={`${order.customerName} siparişini seç`}
                    />
                  </label>
                  <div className="order-summary-main order-summary-main-compact">
                    <div className="stack-tight order-identity-block">
                      <strong>{order.customerName}</strong>
                      <p className="caption">{order.phone}</p>
                    </div>
                    <div className="order-summary-meta order-summary-meta-compact">
                      <div className="compact-meta-item compact-meta-item-inline">
                        <span className="detail-label">Zaman</span>
                        <strong>{formatOrderTime(order.createdAt)}</strong>
                      </div>
                      <div className="compact-meta-item compact-meta-item-inline">
                        <span className="detail-label">Tutar</span>
                        <strong>{formatCurrency(total)}</strong>
                      </div>
                    </div>
                  </div>
                  <div className="order-summary-tags order-summary-tags-compact">
                    <span className="status">{orderStatusLabel(order.status)}</span>
                    <span className={`source-badge source-badge-${order.source}`}>
                      {sourceLabel(order.source)}
                    </span>
                    <span className="pill">
                      {order.courier?.fullName ?? "Kurye yok"}
                    </span>
                    <span className={`payment-status ${primaryPayment ? paymentStatusClass(primaryPayment.status) : "payment-status-pending"}`}>
                      {primaryPayment ? paymentMethodLabel(primaryPayment.method) : "Ödeme bekliyor"}
                    </span>
                    <span className={`payment-status ${primaryPayment ? paymentStatusClass(primaryPayment.status) : "payment-status-pending"}`}>
                      {primaryPayment ? paymentStatusLabel(primaryPayment.status) : "Bekliyor"}
                    </span>
                    <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                      {deliveryStatusLabel(order.deliveryStatus)}
                    </span>
                    {shouldShowAddressQualityWarning(order.addressQualityStatus) ? (
                      <span className={`address-quality ${addressQualityClass(order.addressQualityStatus)}`}>
                        {addressQualityLabel(order.addressQualityStatus)}
                      </span>
                    ) : null}
                  </div>
                  <div className="actions order-row-actions">
                    <button
                      type="button"
                      className="button-secondary admin-inline-button"
                      onClick={() => toggleOrderExpanded(order.id)}
                    >
                      {isExpanded ? "Kapat" : "Detay"}
                    </button>
                  </div>
                </div>

                {isExpanded ? (
                <div className="order-expanded-panel stack compact-stack">
                <div className="admin-detail-grid">
                  <div className="detail-block">
                    <span className="detail-label">Müşteri</span>
                    <strong>{order.customerName}</strong>
                    <span className="caption">{order.phone}</span>
                  </div>
                  <div className="detail-block">
                    <span className="detail-label">Ödeme</span>
                    <strong>
                      {primaryPayment ? paymentMethodLabel(primaryPayment.method) : "Belirtilmedi"}
                    </strong>
                    <span className={`payment-status ${primaryPayment ? paymentStatusClass(primaryPayment.status) : "payment-status-pending"}`}>
                      {primaryPayment ? paymentStatusLabel(primaryPayment.status) : "Bekliyor"}
                    </span>
                  </div>
                  <div className="detail-block">
                    <span className="detail-label">Kurye</span>
                        <strong>{order.courier?.fullName ?? "Atanmadı"}</strong>
                        <span className={`delivery-status ${deliveryStatusClass(order.deliveryStatus)}`}>
                          {deliveryStatusLabel(order.deliveryStatus)}
                        </span>
                        {order.courier ? (
                          <Link href={`/${dealerSlug}/admin/couriers/${order.courier.id}`} className="inline-link">
                            Listeyi aç
                          </Link>
                        ) : null}
                      </div>
                      <div className="detail-block detail-block-wide">
                        <span className="detail-label">Adres</span>
                        <strong>{order.addressLine}</strong>
                        {shouldShowAddressQualityWarning(order.addressQualityStatus) ? (
                          <>
                            <span className={`address-quality ${addressQualityClass(order.addressQualityStatus)}`}>
                              {addressQualityLabel(order.addressQualityStatus)}
                            </span>
                            <span className="caption">{addressQualityHint(order.addressQualityStatus)}</span>
                          </>
                        ) : null}
                        {formatAddressMeta(order.deliveryAddress) ? (
                          <span className="caption">{formatAddressMeta(order.deliveryAddress)}</span>
                        ) : null}
                        {order.deliveryAddress.addressNote ? (
                          <span className="caption">{order.deliveryAddress.addressNote}</span>
                        ) : null}
                        {order.addressLineRaw && order.addressLineRaw !== order.addressLineNormalized ? (
                          <span className="caption">Girilen adres: {order.addressLineRaw}</span>
                        ) : null}
                        <div className="actions">
                          <a
                            href={buildGoogleMapsSearchUrl(mapQuery)}
                            target="_blank"
                            rel="noreferrer"
                            className="button-secondary admin-inline-button"
                          >
                            Haritada kontrol et
                          </a>
                          <button
                            type="button"
                            className="button-secondary admin-inline-button"
                            onClick={() =>
                              setEditingAddressOrderId((current) =>
                                current === order.id ? null : order.id
                              )
                            }
                          >
                            {isEditingAddress ? "Adres panelini kapat" : "Adresi düzelt"}
                          </button>
                        </div>
                  </div>
                </div>

                {isEditingAddress ? (
                  <div className="delivery-panel stack compact-stack">
                    <div>
                      <span className="detail-label">Adres düzeltme</span>
                      <p className="caption">Haritada daha iyi bulunması için adresi düzenleyin.</p>
                    </div>
                    <div className="structured-address-grid">
                      <label>
                        İlçe
                        <input
                          value={addressDraft.deliveryAddress.district ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                district: event.target.value
                              }
                            })
                          }
                          placeholder="Örn. Çankaya"
                        />
                      </label>
                      <label>
                        Mahalle
                        <input
                          value={addressDraft.deliveryAddress.neighborhood ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                neighborhood: event.target.value
                              }
                            })
                          }
                          placeholder="Örn. 100. Yıl"
                        />
                      </label>
                      <label className="manual-form-wide">
                        Cadde / Sokak
                        <input
                          value={addressDraft.deliveryAddress.street ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                street: event.target.value
                              }
                            })
                          }
                          placeholder="Cadde veya sokak"
                        />
                      </label>
                      <label>
                        Bina no
                        <input
                          value={addressDraft.deliveryAddress.buildingNo ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                buildingNo: event.target.value
                              }
                            })
                          }
                          placeholder="12"
                        />
                      </label>
                      <label>
                        Daire no
                        <input
                          value={addressDraft.deliveryAddress.apartmentNo ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                apartmentNo: event.target.value
                              }
                            })
                          }
                          placeholder="4"
                        />
                      </label>
                      <label className="manual-form-wide">
                        Site / Apartman
                        <input
                          value={addressDraft.deliveryAddress.siteName ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                siteName: event.target.value
                              }
                            })
                          }
                          placeholder="Site veya apartman adı"
                        />
                      </label>
                      <label className="manual-form-wide">
                        Adres notu
                        <input
                          value={addressDraft.deliveryAddress.addressNote ?? ""}
                          onChange={(event) =>
                            setAddressDraft(order, {
                              deliveryAddress: {
                                addressNote: event.target.value
                              }
                            })
                          }
                          placeholder="Kapı kodu, blok, kat vb."
                        />
                      </label>
                      <label className="manual-form-wide">
                        Açık adres satırı
                        <textarea
                          value={addressDraft.addressLine}
                          onChange={(event) =>
                            setAddressDraft(order, { addressLine: event.target.value })
                          }
                          placeholder="Gerekirse açık adresi serbest metin olarak düzeltin"
                        />
                      </label>
                    </div>
                    <div className="summary-card compact-stack">
                      <span className="detail-label">Normalleştirilmiş önizleme</span>
                      <strong>{addressPreview.addressLine || "Adres alanlarını doldurun"}</strong>
                      {formatAddressMeta(addressPreview) ? (
                        <span className="caption">{formatAddressMeta(addressPreview)}</span>
                      ) : null}
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        className="button-secondary admin-inline-button"
                        onClick={() => {
                          setEditingAddressOrderId(null);
                          setAddressDrafts((current) => {
                            const next = { ...current };
                            delete next[order.id];
                            return next;
                          });
                        }}
                        disabled={isUpdating}
                      >
                        Vazgeç
                      </button>
                      <button
                        type="button"
                        className="button admin-inline-button"
                        onClick={() => handleAddressSave(order)}
                        disabled={isUpdating || !addressChanged}
                      >
                        {isUpdating ? "Kaydediliyor..." : "Adresi kaydet"}
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="summary-card stack compact-stack">
                  <div className="detail-label">Ürün özeti</div>
                  {order.items.map((item, index) => (
                    <div key={`${order.id}_${item.productId}_${index}`} className="summary-row">
                      <span>{item.unitPriceCents < 0 ? item.name : `${item.quantity} x ${item.name}`}</span>
                      <strong>{formatCurrency(item.quantity * item.unitPriceCents)}</strong>
                    </div>
                  ))}
                </div>

                <div className="delivery-panel stack compact-stack">
                  <div>
                    <span className="detail-label">Teslimat yönetimi</span>
                    <p className="caption">Kurye atayın ve teslimat durumunu güncelleyin.</p>
                  </div>
                  <div className="delivery-form-grid">
                    <label>
                      Kurye
                      <select
                        value={deliveryDraft.courierId}
                        onChange={(event) =>
                          setDeliveryDraft(order, {
                            courierId: event.target.value,
                            deliveryStatus: event.target.value ? (order.deliveryStatus === "unassigned" ? "assigned" : deliveryDraft.deliveryStatus) : "unassigned"
                          })
                        }
                        disabled={isUpdating || selectableCouriers.length === 0}
                      >
                        <option value="">Kurye ata</option>
                        {selectableCouriers.map((courier) => (
                          <option key={courier.id} value={courier.id}>
                            {courier.fullName}{courier.isActive ? "" : " (Pasif)"}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      Teslimat durumu
                      <select
                        value={deliveryDraft.courierId ? deliveryDraft.deliveryStatus : "unassigned"}
                        onChange={(event) =>
                          setDeliveryDraft(order, {
                            deliveryStatus: event.target.value as DeliveryStatus
                          })
                        }
                        disabled={isUpdating || !deliveryDraft.courierId}
                      >
                        {DELIVERY_STATUS_OPTIONS.filter(
                          (option) => deliveryDraft.courierId || option.value === "unassigned"
                        ).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="button-secondary admin-inline-button"
                      onClick={() => handleDeliverySave(order)}
                      disabled={isUpdating || (!deliveryChanged && !deliveryDraft.courierId && order.deliveryStatus === "unassigned")}
                    >
                      {isUpdating ? "Kaydediliyor..." : "Teslimatı kaydet"}
                    </button>
                  </div>
                </div>

                {order.notes ? <div className="note">{order.notes}</div> : null}

                {actionOptions.length > 0 ? (
                  <div className="order-actions">
                    {actionOptions.map((action) => (
                      <button
                        key={`${order.id}_${action.status}`}
                        type="button"
                        className="button-secondary order-action-button"
                        onClick={() => handleStatusUpdate(order.id, action.status)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? "Güncelleniyor..." : action.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="caption">Bu sipariş için ek durum işlemi yok.</div>
                )}
                </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
