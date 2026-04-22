"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/src/lib/currency";
import type { Campaign, CampaignType, Product } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialCampaigns: Campaign[];
  products: Product[];
};

type CampaignFormState = {
  name: string;
  type: CampaignType;
  targetProductId: string;
  giftProductId: string;
  requiredQuantity: string;
  payableQuantity: string;
  minCartTotal: string;
  discountAmount: string;
  isActive: boolean;
};

const CAMPAIGN_TYPE_OPTIONS: Array<{ value: CampaignType; label: string; description: string }> = [
  {
    value: "bundle-gift",
    label: "Hediye ürün kampanyası",
    description: "Örn. 1 Damacana alana 1 Soda hediye"
  },
  {
    value: "quantity",
    label: "Adet kampanyası",
    description: "Örn. 5 al 3 öde"
  },
  {
    value: "cart-discount",
    label: "Sepet indirimi",
    description: "Örn. 1000 TL üzeri 200 TL indirim"
  }
];

function createEmptyForm(products: Product[]): CampaignFormState {
  return {
    name: "",
    type: "bundle-gift",
    targetProductId: products[0]?.id ?? "",
    giftProductId: products[1]?.id ?? products[0]?.id ?? "",
    requiredQuantity: "1",
    payableQuantity: "",
    minCartTotal: "",
    discountAmount: "",
    isActive: true
  };
}

function formatPriceInput(valueCents: number | null) {
  return valueCents ? (valueCents / 100).toFixed(2).replace(".", ",") : "";
}

function formFromCampaign(campaign: Campaign, products: Product[]): CampaignFormState {
  return {
    name: campaign.name,
    type: campaign.type,
    targetProductId: campaign.targetProductId ?? products[0]?.id ?? "",
    giftProductId: campaign.giftProductId ?? products[1]?.id ?? products[0]?.id ?? "",
    requiredQuantity: campaign.requiredQuantity ? String(campaign.requiredQuantity) : "",
    payableQuantity: campaign.payableQuantity !== null ? String(campaign.payableQuantity) : "",
    minCartTotal: formatPriceInput(campaign.minCartTotalCents),
    discountAmount: formatPriceInput(campaign.discountAmountCents),
    isActive: campaign.isActive
  };
}

function campaignTypeLabel(type: CampaignType) {
  return CAMPAIGN_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? type;
}

function campaignDescription(campaign: Campaign) {
  switch (campaign.type) {
    case "bundle-gift":
      return `${campaign.requiredQuantity ?? 0} ${campaign.targetProductName ?? "ürün"} alana ${campaign.giftProductName ?? "hediye ürün"} hediye`;
    case "quantity":
      return `${campaign.requiredQuantity ?? 0} al ${campaign.payableQuantity ?? 0} öde: ${campaign.targetProductName ?? "ürün"}`;
    case "cart-discount":
      return `${formatCurrency(campaign.minCartTotalCents ?? 0)} üzeri ${formatCurrency(campaign.discountAmountCents ?? 0)} indirim`;
  }
}

function normalizeFormForType(form: CampaignFormState, products: Product[]) {
  const firstProductId = products[0]?.id ?? "";
  const secondProductId = products[1]?.id ?? firstProductId;

  switch (form.type) {
    case "bundle-gift":
      return {
        ...form,
        targetProductId: form.targetProductId || firstProductId,
        giftProductId: form.giftProductId || secondProductId,
        requiredQuantity: form.requiredQuantity || "1",
        payableQuantity: "",
        minCartTotal: "",
        discountAmount: ""
      };
    case "quantity":
      return {
        ...form,
        targetProductId: form.targetProductId || firstProductId,
        requiredQuantity: form.requiredQuantity || "5",
        payableQuantity: form.payableQuantity || "3",
        giftProductId: "",
        minCartTotal: "",
        discountAmount: ""
      };
    case "cart-discount":
      return {
        ...form,
        targetProductId: "",
        giftProductId: "",
        requiredQuantity: "",
        payableQuantity: ""
      };
  }
}

function CampaignFormFields({
  form,
  onChange,
  disabled,
  products
}: {
  form: CampaignFormState;
  onChange: (next: CampaignFormState) => void;
  disabled: boolean;
  products: Product[];
}) {
  return (
    <div className="product-form-grid">
      <label className="product-form-wide">
        Kampanya tipi
        <select
          value={form.type}
          onChange={(event) =>
            onChange({ ...form, type: event.target.value as CampaignType })
          }
          disabled={disabled}
        >
          {CAMPAIGN_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="caption">
          {CAMPAIGN_TYPE_OPTIONS.find((option) => option.value === form.type)?.description}
        </span>
      </label>

      <label className="product-form-wide">
        Kampanya adı
        <input
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Örn. 5 al 3 öde"
          disabled={disabled}
        />
      </label>

      {form.type !== "cart-discount" ? (
        <label>
          Hedef ürün
          <select
            value={form.targetProductId}
            onChange={(event) => onChange({ ...form, targetProductId: event.target.value })}
            disabled={disabled}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {form.type === "bundle-gift" ? (
        <label>
          Hediye ürün
          <select
            value={form.giftProductId}
            onChange={(event) => onChange({ ...form, giftProductId: event.target.value })}
            disabled={disabled}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {form.type !== "cart-discount" ? (
        <label>
          Gerekli adet
          <input
            value={form.requiredQuantity}
            onChange={(event) => onChange({ ...form, requiredQuantity: event.target.value })}
            inputMode="numeric"
            placeholder="1"
            disabled={disabled}
          />
        </label>
      ) : null}

      {form.type === "quantity" ? (
        <label>
          Ödenecek adet
          <input
            value={form.payableQuantity}
            onChange={(event) => onChange({ ...form, payableQuantity: event.target.value })}
            inputMode="numeric"
            placeholder="3"
            disabled={disabled}
          />
        </label>
      ) : null}

      {form.type === "cart-discount" ? (
        <>
          <label>
            Minimum sepet (TL)
            <input
              value={form.minCartTotal}
              onChange={(event) => onChange({ ...form, minCartTotal: event.target.value })}
              inputMode="decimal"
              placeholder="1000"
              disabled={disabled}
            />
          </label>
          <label>
            İndirim tutarı (TL)
            <input
              value={form.discountAmount}
              onChange={(event) => onChange({ ...form, discountAmount: event.target.value })}
              inputMode="decimal"
              placeholder="200"
              disabled={disabled}
            />
          </label>
        </>
      ) : null}

      <label className="toggle-field">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          disabled={disabled}
        />
        <span>Kampanya aktif olsun</span>
      </label>
    </div>
  );
}

export function CampaignsManager({ dealerSlug, initialCampaigns, products }: Props) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [form, setForm] = useState<CampaignFormState>(() => createEmptyForm(products));
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CampaignFormState>(() => createEmptyForm(products));
  const [message, setMessage] = useState<string | null>(null);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sortedCampaigns = useMemo(
    () =>
      [...campaigns].sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
      }),
    [campaigns]
  );

  function updateForm(next: CampaignFormState) {
    setForm(normalizeFormForType(next, products));
  }

  function updateEditingForm(next: CampaignFormState) {
    setEditingForm(normalizeFormForType(next, products));
  }

  function beginEdit(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setEditingForm(formFromCampaign(campaign, products));
    setMessage(null);
  }

  async function handleCreateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsCreating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/campaigns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(form)
      });
      const payload = (await response.json()) as { campaign?: Campaign; error?: string };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Kampanya oluşturulamadı");
      }

      const campaign = payload.campaign;
      setCampaigns((current) => [...current, campaign]);
      setForm(createEmptyForm(products));
      setMessage("Kampanya oluşturuldu.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kampanya oluşturulamadı");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleStatusChange(campaign: Campaign) {
    setMessage(null);
    setActiveCampaignId(campaign.id);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isActive: !campaign.isActive
        })
      });
      const payload = (await response.json()) as { campaign?: Campaign; error?: string };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Kampanya güncellenemedi");
      }

      const updatedCampaign = payload.campaign;
      setCampaigns((current) =>
        current.map((item) => (item.id === updatedCampaign.id ? updatedCampaign : item))
      );
      setMessage(updatedCampaign.isActive ? "Kampanya aktif edildi." : "Kampanya pasif edildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kampanya güncellenemedi");
    } finally {
      setActiveCampaignId(null);
    }
  }

  async function handleUpdateCampaign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCampaignId) {
      return;
    }

    setMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/campaigns/${editingCampaignId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editingForm)
      });
      const payload = (await response.json()) as { campaign?: Campaign; error?: string };

      if (!response.ok || !payload.campaign) {
        throw new Error(payload.error ?? "Kampanya güncellenemedi");
      }

      const updatedCampaign = payload.campaign;
      setCampaigns((current) =>
        current.map((campaign) =>
          campaign.id === updatedCampaign.id ? updatedCampaign : campaign
        )
      );
      setEditingCampaignId(null);
      setMessage("Kampanya güncellendi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kampanya güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="kicker">Yeni kampanya</span>
          <h2>Kampanya oluştur</h2>
          <p className="caption">
            V1 basit tutuldu: kupon yok, müşteri hedefleme yok, aynı siparişte tek kampanya uygulanır.
          </p>
        </div>

        <form className="stack" onSubmit={handleCreateCampaign}>
          <CampaignFormFields
            form={form}
            onChange={updateForm}
            disabled={isCreating}
            products={products}
          />

          {message ? (
            <div className={`note ${message.includes("oluşturuldu") || message.includes("edildi") ? "" : "warning"}`}>
              {message}
            </div>
          ) : null}

          <button type="submit" className="button admin-submit" disabled={isCreating || products.length === 0}>
            {isCreating ? "Kaydediliyor..." : "Kampanyayı kaydet"}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">Kampanya listesi</span>
          <h2>Mevcut kampanyalar</h2>
          <p className="caption">
            Müşteri siparişinde birden fazla kampanya uygun olsa bile sistem yalnızca en avantajlı tek kampanyayı uygular.
          </p>
        </div>

        {sortedCampaigns.length === 0 ? (
          <div className="note">Bu bayi için henüz kampanya yok.</div>
        ) : (
          <div className="product-admin-list">
            {sortedCampaigns.map((campaign) => {
              const isStatusUpdating = activeCampaignId === campaign.id;
              const isEditing = editingCampaignId === campaign.id;

              return (
                <article key={campaign.id} className="order-card stack">
                  <div className="product-admin-topline">
                    <div className="stack compact-stack">
                      <div className="tag-row">
                        <span className={`status ${campaign.isActive ? "" : "status-muted"}`}>
                          {campaign.isActive ? "Aktif" : "Pasif"}
                        </span>
                        <span className="pill">{campaignTypeLabel(campaign.type)}</span>
                      </div>
                      <div>
                        <h3>{campaign.name}</h3>
                        <p className="caption">{campaignDescription(campaign)}</p>
                      </div>
                    </div>

                    <div className="order-actions">
                      <button
                        type="button"
                        className="button-secondary admin-inline-button"
                        onClick={() =>
                          isEditing ? setEditingCampaignId(null) : beginEdit(campaign)
                        }
                        disabled={isStatusUpdating || isUpdating}
                      >
                        {isEditing ? "Vazgeç" : "Düzenle"}
                      </button>
                      <button
                        type="button"
                        className="button-secondary admin-inline-button"
                        onClick={() => handleStatusChange(campaign)}
                        disabled={isStatusUpdating || isUpdating}
                      >
                        {isStatusUpdating
                          ? "Güncelleniyor..."
                          : campaign.isActive
                            ? "Pasif yap"
                            : "Aktif yap"}
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <form className="stack" onSubmit={handleUpdateCampaign}>
                      <CampaignFormFields
                        form={editingForm}
                        onChange={updateEditingForm}
                        disabled={isUpdating}
                        products={products}
                      />

                      <button type="submit" className="button admin-submit" disabled={isUpdating}>
                        {isUpdating ? "Kaydediliyor..." : "Kampanyayı güncelle"}
                      </button>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
