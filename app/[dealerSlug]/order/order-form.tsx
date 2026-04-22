"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { evaluateBestCampaign } from "@/src/lib/campaigns";
import { formatCurrency } from "@/src/lib/currency";
import type { Campaign, PaymentMethod, Product } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  dealerName: string;
  products: Product[];
  campaigns: Campaign[];
};

type LookupPayload = {
  found: boolean;
  customer?: {
    fullName: string;
    phone: string;
    addressLine: string;
    notes?: string;
  };
};

type LookupState = "idle" | "found" | "not-found" | "error";

const PAYMENT_OPTIONS: Array<{ value: PaymentMethod; label: string; description: string }> = [
  {
    value: "cash-on-delivery",
    label: "Kapıda nakit",
    description: "Ödeme teslimatta nakit alınır"
  },
  {
    value: "card-on-delivery",
    label: "Kapıda kart",
    description: "Ödeme teslimatta POS ile alınır"
  },
  {
    value: "online",
    label: "Online",
    description: "Demo için online ödeme olarak gösterilir"
  }
];

function categoryLabel(category: Product["category"]) {
  switch (category) {
    case "water":
      return "Su";
    case "soft-drink":
      return "İçecek";
    case "bundle":
      return "Paket";
  }
}

function campaignTypeLabel(campaign: Campaign) {
  switch (campaign.type) {
    case "bundle-gift":
      return "Hediye ürün";
    case "quantity":
      return "Adet avantajı";
    case "cart-discount":
      return "Sepet indirimi";
  }
}

function campaignDescription(campaign: Campaign) {
  switch (campaign.type) {
    case "bundle-gift":
      return `${campaign.requiredQuantity ?? 0} ${campaign.targetProductName ?? "ürün"} alana ${campaign.giftProductName ?? "hediye ürün"} hediye`;
    case "quantity":
      return `${campaign.requiredQuantity ?? 0} al ${campaign.payableQuantity ?? 0} öde: ${campaign.targetProductName ?? "seçili ürün"}`;
    case "cart-discount":
      return `${formatCurrency(campaign.minCartTotalCents ?? 0)} üzeri sepetlerde ${formatCurrency(campaign.discountAmountCents ?? 0)} indirim`;
  }
}

export function OrderForm({ dealerSlug, dealerName, products, campaigns }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash-on-delivery");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const customerStepOpen = lookupState !== "idle";
  const selectedItems = useMemo(
    () =>
      products
        .map((product) => ({
          product,
          quantity: quantities[product.id] ?? 0
        }))
        .filter((entry) => entry.quantity > 0),
    [products, quantities]
  );

  const campaignResult = useMemo(
    () =>
      evaluateBestCampaign(
        campaigns,
        selectedItems.map((entry) => ({
          productId: entry.product.id,
          name: entry.product.name,
          quantity: entry.quantity,
          unitPriceCents: entry.product.priceCents
        }))
      ),
    [campaigns, selectedItems]
  );
  const totalCents = campaignResult.finalTotalCents;
  const appliedCampaign = campaignResult.appliedCampaign;

  function handlePhoneChange(value: string) {
    setPhone(value);
    setLookupState("idle");
    setLookupMessage(null);
    setSubmitMessage(null);
    setFullName("");
    setAddressLine("");
    setNotes("");
  }

  function adjustQuantity(productId: string, delta: number) {
    setQuantities((current) => {
      const nextValue = Math.max(0, (current[productId] ?? 0) + delta);
      return {
        ...current,
        [productId]: nextValue
      };
    });
  }

  async function handleLookup() {
    if (!phone.trim()) {
      setLookupMessage("Devam etmek için önce telefon numaranızı girin.");
      return;
    }

    setIsLookingUp(true);
    setLookupMessage(null);
    setSubmitMessage(null);

    try {
      const response = await fetch(
        `/api/dealers/${dealerSlug}/customers/lookup?phone=${encodeURIComponent(phone)}`
      );
      const payload = (await response.json()) as LookupPayload & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Müşteri sorgusu yapılamadı");
      }

      if (!payload.found || !payload.customer) {
        setLookupState("not-found");
        setFullName("");
        setAddressLine("");
        setNotes("");
        setLookupMessage("Kayıtlı müşteri bulunamadı. Ad ve adres bilgilerinizi girerek devam edin.");
        return;
      }

      setLookupState("found");
      setFullName(payload.customer.fullName);
      setPhone(payload.customer.phone);
      setAddressLine(payload.customer.addressLine);
      setNotes(payload.customer.notes ?? "");
      setLookupMessage("Kayıtlı müşteri bilgileri bulundu. Kontrol edip siparişi tamamlayabilirsiniz.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Müşteri sorgusu yapılamadı";
      setLookupState("error");
      setLookupMessage(`${message}. İsterseniz bilgileri manuel girerek devam edebilirsiniz.`);
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitMessage(null);

    if (selectedItems.length === 0) {
      setSubmitMessage("Önce en az bir ürün seçin.");
      return;
    }

    if (!phone.trim()) {
      setSubmitMessage("Telefon numaranızı girin ve devam edin.");
      return;
    }

    if (!customerStepOpen) {
      setSubmitMessage("Telefon numaranızı kontrol ederek müşteri adımını tamamlayın.");
      return;
    }

    if (!fullName.trim() || !addressLine.trim()) {
      setSubmitMessage("Ad soyad ve teslimat adresi zorunludur.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          phone,
          fullName,
          addressLine,
          payment_method: paymentMethod,
          notes,
          items: selectedItems.map((entry) => ({
            productId: entry.product.id,
            quantity: entry.quantity
          }))
        })
      });

      const payload = (await response.json()) as {
        orderId?: string;
        totalCents?: number;
        error?: string;
      };

      if (!response.ok || !payload.orderId) {
        throw new Error(payload.error ?? "Sipariş oluşturulamadı");
      }

      const params = new URLSearchParams({
        orderId: payload.orderId,
        customerName: fullName.trim(),
        total: String(payload.totalCents ?? totalCents),
        paymentMethod,
        itemCount: String(selectedItems.reduce((sum, entry) => sum + entry.quantity, 0))
      });

      router.push(`/${dealerSlug}/order/success?${params.toString()}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sipariş oluşturulamadı";
      setSubmitMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="order-flow stack" onSubmit={handleSubmit}>
      <section className="panel step-panel stack">
        <div className="section-heading">
          <span className="step-pill">1</span>
          <div>
            <h2>Ürünlerinizi seçin</h2>
            <p className="caption">Miktarı artırıp azaltarak siparişinizi hazırlayın.</p>
          </div>
        </div>

        {campaigns.length > 0 ? (
          <div className="campaigns-section stack">
            <div>
              <h3>Kampanyalar</h3>
              <p className="caption">Uygun kampanya siparişinize otomatik uygulanır.</p>
            </div>
            <div className="campaign-card-list">
              {campaigns.map((campaign) => {
                const isApplied = appliedCampaign?.campaignId === campaign.id;

                return (
                  <article
                    key={campaign.id}
                    className={`campaign-card ${isApplied ? "campaign-card-applied" : ""}`}
                  >
                    <div className="campaign-card-header">
                      <span className="campaign-card-type">{campaignTypeLabel(campaign)}</span>
                      {isApplied ? <span className="campaign-applied-label">Uygulanıyor</span> : null}
                    </div>
                    <div>
                      <h4>{campaign.name}</h4>
                      <p className="caption">{campaignDescription(campaign)}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="catalog-list">
          {products.map((product) => {
            const quantity = quantities[product.id] ?? 0;

            return (
              <article key={product.id} className="catalog-item">
                <div className="catalog-main">
                  <div className="product-image-frame">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="product-image"
                        loading="lazy"
                      />
                    ) : (
                      <div className="product-image-fallback">{product.name.slice(0, 1)}</div>
                    )}
                  </div>

                  <div className="catalog-copy">
                    <div className="tag-row">
                      <span className="status">{categoryLabel(product.category)}</span>
                      <span className="pill">{product.unitLabel}</span>
                    </div>
                    <div>
                      <h3>{product.name}</h3>
                      <p className="caption">{formatCurrency(product.priceCents)} / ürün</p>
                    </div>
                  </div>
                </div>

                <div className="quantity-stepper">
                  <button
                    type="button"
                    className="stepper-button"
                    onClick={() => adjustQuantity(product.id, -1)}
                    disabled={quantity === 0 || isSubmitting}
                    aria-label={`${product.name} azalt`}
                  >
                    -
                  </button>
                  <span className="stepper-value">{quantity}</span>
                  <button
                    type="button"
                    className="stepper-button"
                    onClick={() => adjustQuantity(product.id, 1)}
                    disabled={isSubmitting}
                    aria-label={`${product.name} artır`}
                  >
                    +
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <div className="summary-card stack compact-stack">
          {selectedItems.length === 0 ? (
            <div className="note warning">Henüz ürün seçilmedi.</div>
          ) : (
            <>
              {selectedItems.map((entry) => (
                <div key={entry.product.id} className="summary-row">
                  <span>
                    {entry.quantity} x {entry.product.name}
                  </span>
                  <strong>{formatCurrency(entry.product.priceCents * entry.quantity)}</strong>
                </div>
              ))}
              {appliedCampaign ? (
                <>
                  <div className="separator" />
                  <div className="campaign-summary stack compact-stack">
                    <strong>Kampanya uygulandı: {appliedCampaign.name}</strong>
                    {appliedCampaign.discountAmountCents > 0 ? (
                      <div className="summary-row">
                        <span>İndirim</span>
                        <strong>-{formatCurrency(appliedCampaign.discountAmountCents)}</strong>
                      </div>
                    ) : null}
                    {appliedCampaign.giftItems.map((item) => (
                      <div key={`${item.productId}_${item.name}`} className="summary-row">
                        <span>Hediye ürün</span>
                        <strong>
                          {item.quantity} x {item.name.replace(" (Hediye)", "")}
                        </strong>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
              <div className="separator" />
              <div className="summary-row total-row">
                <span>Toplam</span>
                <strong>{formatCurrency(totalCents)}</strong>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="panel step-panel stack">
        <div className="section-heading">
          <span className="step-pill">2</span>
          <div>
            <h2>Telefon numaranızı girin</h2>
            <p className="caption">Kayıtlı müşteriyseniz ad ve adresiniz otomatik dolsun.</p>
          </div>
        </div>

        <div className="phone-row">
          <label className="phone-field">
            Telefon numarası
            <input
              value={phone}
              onChange={(event) => handlePhoneChange(event.target.value)}
              placeholder="05xx xxx xx xx"
              inputMode="tel"
              autoComplete="tel"
              disabled={isLookingUp || isSubmitting}
            />
          </label>
          <button
            type="button"
            className="button"
            onClick={handleLookup}
            disabled={isLookingUp || isSubmitting}
          >
            {isLookingUp ? "Kontrol ediliyor..." : "Bilgilerimi getir"}
          </button>
        </div>

        {lookupMessage ? (
          <div className={`note ${lookupState === "error" ? "warning" : ""}`}>{lookupMessage}</div>
        ) : null}
      </section>

      {customerStepOpen ? (
        <>
          <section className="panel step-panel stack">
            <div className="section-heading">
              <span className="step-pill">3</span>
              <div>
                <h2>{lookupState === "found" ? "Bilgilerinizi kontrol edin" : "Teslimat bilgilerinizi girin"}</h2>
                <p className="caption">Siparişin hızlı tamamlanması için formu kısa tuttuk.</p>
              </div>
            </div>

            <div className="form-grid">
              <label>
                Ad soyad
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Ad soyad"
                  autoComplete="name"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Teslimat adresi
                <textarea
                  value={addressLine}
                  onChange={(event) => setAddressLine(event.target.value)}
                  placeholder="Mahalle, sokak, bina, kat, daire"
                  autoComplete="street-address"
                  disabled={isSubmitting}
                />
              </label>

              <label>
                Sipariş notu
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Kapı şifresi, konum tarifi, teslim notu"
                  disabled={isSubmitting}
                />
              </label>
            </div>
          </section>

          <section className="panel step-panel stack">
            <div className="section-heading">
              <span className="step-pill">4</span>
              <div>
                <h2>Ödeme yöntemini seçin</h2>
                <p className="caption">Seçiminiz bayi sipariş ekranında da görünsün.</p>
              </div>
            </div>

            <div className="payment-options">
              {PAYMENT_OPTIONS.map((option) => (
                <label key={option.value} className="payment-option">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={option.value}
                    checked={paymentMethod === option.value}
                    onChange={() => setPaymentMethod(option.value)}
                    disabled={isSubmitting}
                  />
                  <div>
                    <strong>{option.label}</strong>
                    <p className="caption">{option.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section className="panel submit-panel stack">
            <div className="section-heading">
              <span className="step-pill">5</span>
              <div>
                <h2>Siparişi gönderin</h2>
                <p className="caption">Siparişiniz tek ekranda hızlıca tamamlanır.</p>
              </div>
            </div>

            <div className="summary-card stack">
              <div className="summary-row">
                <span className="caption">Seçilen ürün</span>
                <strong>{selectedItems.length} kalem</strong>
              </div>
              <div className="summary-row">
                <span className="caption">Ödeme</span>
                <strong>{PAYMENT_OPTIONS.find((option) => option.value === paymentMethod)?.label}</strong>
              </div>
              {appliedCampaign ? (
                <div className="summary-row">
                  <span className="caption">Kampanya</span>
                  <strong>{appliedCampaign.name}</strong>
                </div>
              ) : null}
              <div className="summary-row total-row">
                <span>Toplam</span>
                <strong>{formatCurrency(totalCents)}</strong>
              </div>
            </div>

            {submitMessage ? <div className="note warning">{submitMessage}</div> : null}

            <button
              type="submit"
              className="button submit-button"
              disabled={isSubmitting || selectedItems.length === 0}
            >
              {isSubmitting ? "Sipariş gönderiliyor..." : `${dealerName} için siparişi gönder`}
            </button>
          </section>
        </>
      ) : null}
    </form>
  );
}
