"use client";

import { useMemo, useState } from "react";
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
  initialOrders: Order[];
  products: Product[];
  campaigns: Campaign[];
  couriers: Courier[];
};

type ManualOrderForm = {
  phone: string;
  fullName: string;
  addressLine: string;
  notes: string;
  paymentMethod: PaymentMethod;
};

type DeliveryDraft = {
  courierId: string;
  deliveryStatus: DeliveryStatus;
};

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
    notes?: string | null;
  };
  error?: string;
};

const EMPTY_MANUAL_FORM: ManualOrderForm = {
  phone: "",
  fullName: "",
  addressLine: "",
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

function formatOrderTime(timestamp: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short"
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

export function OrdersManager({
  dealerSlug,
  initialOrders,
  products,
  campaigns,
  couriers
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [manualForm, setManualForm] = useState<ManualOrderForm>(EMPTY_MANUAL_FORM);
  const [manualQuantities, setManualQuantities] = useState<Record<string, number>>({});
  const [deliveryDrafts, setDeliveryDrafts] = useState<Record<string, DeliveryDraft>>({});
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [deliveryStatusFilter, setDeliveryStatusFilter] = useState<DeliveryStatusFilter>("all");
  const [courierFilter, setCourierFilter] = useState<CourierFilter>("all");
  const [sortOption, setSortOption] = useState<SortOption>("newest");

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

  const visibleOrders = useMemo(() => {
    const query = normalizeSearch(searchTerm);

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
    statusFilter
  ]);

  function updateManualQuantity(productId: string, value: number) {
    setManualQuantities((current) => ({
      ...current,
      [productId]: Math.max(0, Math.floor(value))
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
        setLookupMessage("Kayıt bulunamadı. Bilgileri manuel girin.");
        return;
      }

      setManualForm((current) => ({
        ...current,
        phone: payload.customer?.phone ?? current.phone,
        fullName: payload.customer?.fullName ?? current.fullName,
        addressLine: payload.customer?.addressLine ?? current.addressLine,
        notes: payload.customer?.notes ?? current.notes
      }));
      setLookupMessage("Müşteri bilgileri getirildi.");
    } catch (error) {
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

    if (!manualForm.phone.trim() || !manualForm.fullName.trim() || !manualForm.addressLine.trim()) {
      setCreateMessage("Telefon, ad soyad ve adres zorunludur.");
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

  return (
    <section className="panel stack">
      <div className="admin-console-head">
        <div>
          <span className="kicker">Sipariş ekranı</span>
          <h2>Sipariş listesi</h2>
          <p className="caption">Siparişleri arayın, süzün, kurye atayın ve yeni sipariş ekleyin.</p>
        </div>
        <button type="button" className="button" onClick={() => setIsCreateOpen((current) => !current)}>
          {isCreateOpen ? "Formu kapat" : "Yeni sipariş ekle"}
        </button>
      </div>

      <div className="admin-console-toolbar admin-console-toolbar-wide">
        <label>
          Arama
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Ad veya telefon"
          />
        </label>
        <label>
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
        <label>
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
        <label>
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
        <label>
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
        <label>
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
        <label>
          Sıralama
          <select value={sortOption} onChange={(event) => setSortOption(event.target.value as SortOption)}>
            <option value="newest">En yeni</option>
            <option value="oldest">En eski</option>
            <option value="total-desc">Tutar yüksekten düşüğe</option>
            <option value="total-asc">Tutar düşükten yükseğe</option>
          </select>
        </label>
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
                    setManualForm((current) => ({ ...current, phone: event.target.value }))
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
            <label className="manual-form-wide">
              Adres
              <textarea
                value={manualForm.addressLine}
                onChange={(event) =>
                  setManualForm((current) => ({ ...current, addressLine: event.target.value }))
                }
                placeholder="Teslimat adresi"
              />
            </label>
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
            const deliveryDraft = getDeliveryDraft(order);
            const deliveryChanged =
              deliveryDraft.courierId !== (order.courier?.id ?? "") ||
              deliveryDraft.deliveryStatus !== order.deliveryStatus;
            const selectableCouriers = couriers.filter(
              (courier) => courier.isActive || courier.id === order.courier?.id || courier.id === deliveryDraft.courierId
            );

            return (
              <article key={order.id} className="order-card stack">
                <div className="order-topline">
                  <div>
                    <span className="caption">Geliş zamanı</span>
                    <h3>{formatOrderTime(order.createdAt)}</h3>
                  </div>
                  <div className="order-badge-row">
                    <span className="status">{orderStatusLabel(order.status)}</span>
                    <span className={`source-badge source-badge-${order.source}`}>
                      {sourceLabel(order.source)}
                    </span>
                  </div>
                </div>

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
                  </div>
                  <div className="detail-block detail-block-wide">
                    <span className="detail-label">Adres</span>
                    <strong>{order.addressLine}</strong>
                  </div>
                </div>

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

                <div className="summary-row total-row">
                  <span>Toplam</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
