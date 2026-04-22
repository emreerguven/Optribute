"use client";

import { useState } from "react";
import { formatCurrency } from "@/src/lib/currency";
import type { Order, OrderStatus } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialOrders: Order[];
};

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

export function OrdersManager({ dealerSlug, initialOrders }: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <section className="panel stack">
      <div>
        <span className="kicker">Gelen siparişler</span>
        <h2>Bugünün görünen sipariş listesi</h2>
        <p className="caption">
          MVP demosu için okunabilir olacak şekilde hazırlandı: kim sipariş verdi, ne aldı,
          nasıl ödeyecek, toplam tutar ve siparişin son durumu.
        </p>
      </div>

      {message ? (
        <div className={`note ${message.includes("güncellendi") ? "" : "warning"}`}>{message}</div>
      ) : null}

      {orders.length === 0 ? (
        <div className="note">Bu bayi için henüz sipariş bulunmuyor.</div>
      ) : (
        <div className="admin-order-list">
          {orders.map((order) => {
            const total = order.items.reduce(
              (sum, item) => sum + item.quantity * item.unitPriceCents,
              0
            );
            const primaryPayment = order.payments[0];
            const actionOptions = getActionOptions(order.status);
            const isUpdating = activeOrderId === order.id;

            return (
              <article key={order.id} className="order-card stack">
                <div className="order-topline">
                  <div>
                    <span className="caption">Geliş zamanı</span>
                    <h3>{formatOrderTime(order.createdAt)}</h3>
                  </div>
                  <span className="status">{orderStatusLabel(order.status)}</span>
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
