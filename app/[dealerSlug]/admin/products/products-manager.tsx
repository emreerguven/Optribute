"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/src/lib/currency";
import type { Product, ProductCategory } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialProducts: Product[];
};

type ProductFormState = {
  name: string;
  price: string;
  unitLabel: string;
  category: ProductCategory;
  imageUrl: string;
  isActive: boolean;
};

const CATEGORY_OPTIONS: Array<{ value: ProductCategory; label: string }> = [
  { value: "water", label: "Su" },
  { value: "soft-drink", label: "İçecek" },
  { value: "bundle", label: "Paket" }
];

function createEmptyForm(): ProductFormState {
  return {
    name: "",
    price: "",
    unitLabel: "",
    category: "water",
    imageUrl: "",
    isActive: true
  };
}

function formFromProduct(product: Product): ProductFormState {
  return {
    name: product.name,
    price: (product.priceCents / 100).toFixed(2).replace(".", ","),
    unitLabel: product.unitLabel,
    category: product.category,
    imageUrl: product.imageUrl ?? "",
    isActive: product.isActive
  };
}

function categoryLabel(category: ProductCategory) {
  return CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

function ProductFormFields({
  form,
  onChange,
  disabled,
  submitLabel
}: {
  form: ProductFormState;
  onChange: (next: ProductFormState) => void;
  disabled: boolean;
  submitLabel: string;
}) {
  return (
    <div className="product-form-grid">
      <label>
        Ürün adı
        <input
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="Örn. 19L Damacana Su"
          disabled={disabled}
        />
      </label>

      <label>
        Fiyat (TL)
        <input
          value={form.price}
          onChange={(event) => onChange({ ...form, price: event.target.value })}
          placeholder="125"
          inputMode="decimal"
          disabled={disabled}
        />
      </label>

      <label>
        Birim etiketi
        <input
          value={form.unitLabel}
          onChange={(event) => onChange({ ...form, unitLabel: event.target.value })}
          placeholder="adet / kasa / paket"
          disabled={disabled}
        />
      </label>

      <label>
        Kategori
        <select
          value={form.category}
          onChange={(event) =>
            onChange({ ...form, category: event.target.value as ProductCategory })
          }
          disabled={disabled}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="product-form-wide">
        Görsel bağlantısı
        <input
          value={form.imageUrl}
          onChange={(event) => onChange({ ...form, imageUrl: event.target.value })}
          placeholder="/product-images/urun.svg"
          disabled={disabled}
        />
      </label>

      <label className="toggle-field">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(event) => onChange({ ...form, isActive: event.target.checked })}
          disabled={disabled}
        />
        <span>{submitLabel === "Yeni ürünü kaydet" ? "Ürün aktif olsun" : "Ürün aktif"}</span>
      </label>
    </div>
  );
}

export function ProductsManager({ dealerSlug, initialProducts }: Props) {
  const [products, setProducts] = useState(initialProducts);
  const [newProductForm, setNewProductForm] = useState<ProductFormState>(createEmptyForm());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<ProductFormState>(createEmptyForm());
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sortedProducts = useMemo(
    () =>
      [...products].sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        return left.name.localeCompare(right.name, "tr");
      }),
    [products]
  );

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);
    setIsCreating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/products`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newProductForm)
      });

      const payload = (await response.json()) as { product?: Product; error?: string };

      if (!response.ok || !payload.product) {
        throw new Error(payload.error ?? "Ürün oluşturulamadı");
      }

      setProducts((current) => [...current, payload.product]);
      setNewProductForm(createEmptyForm());
      setCreateMessage("Yeni ürün kaydedildi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ürün oluşturulamadı";
      setCreateMessage(message);
    } finally {
      setIsCreating(false);
    }
  }

  function beginEdit(product: Product) {
    setEditingProductId(product.id);
    setEditingForm(formFromProduct(product));
    setUpdateMessage(null);
  }

  async function handleUpdateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingProductId) {
      return;
    }

    setUpdateMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(
        `/api/dealers/${dealerSlug}/products/${editingProductId}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(editingForm)
        }
      );

      const payload = (await response.json()) as { product?: Product; error?: string };

      if (!response.ok || !payload.product) {
        throw new Error(payload.error ?? "Ürün güncellenemedi");
      }

      setProducts((current) =>
        current.map((product) => (product.id === payload.product?.id ? payload.product : product))
      );
      setEditingProductId(null);
      setUpdateMessage("Ürün güncellendi.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ürün güncellenemedi";
      setUpdateMessage(message);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div>
          <span className="kicker">Yeni ürün ekle</span>
          <h2>Ürün oluştur</h2>
          <p className="caption">
            Temel ürün bilgilerini girin. Silme yerine ürünü pasif yapabilirsiniz.
          </p>
        </div>

        <form className="stack" onSubmit={handleCreateProduct}>
          <ProductFormFields
            form={newProductForm}
            onChange={setNewProductForm}
            disabled={isCreating}
            submitLabel="Yeni ürünü kaydet"
          />

          {createMessage ? (
            <div className={`note ${createMessage.includes("kaydedildi") ? "" : "warning"}`}>
              {createMessage}
            </div>
          ) : null}

          <button type="submit" className="button admin-submit" disabled={isCreating}>
            {isCreating ? "Kaydediliyor..." : "Yeni ürünü kaydet"}
          </button>
        </form>
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">Ürün listesi</span>
          <h2>Mevcut ürünler</h2>
          <p className="caption">
            Ürün fiyatı veya adı değişse bile geçmiş siparişlerdeki kayıtlı tutarlar etkilenmez.
          </p>
        </div>

        {updateMessage ? (
          <div className={`note ${updateMessage.includes("güncellendi") ? "" : "warning"}`}>
            {updateMessage}
          </div>
        ) : null}

        <div className="product-admin-list">
          {sortedProducts.map((product) => {
            const isEditing = editingProductId === product.id;

            return (
              <article key={product.id} className="order-card stack">
                <div className="product-admin-topline">
                  <div className="product-admin-main">
                    <div className="product-image-frame product-image-frame-admin">
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

                    <div className="stack compact-stack">
                      <div className="tag-row">
                        <span className={`status ${product.isActive ? "" : "status-muted"}`}>
                          {product.isActive ? "Aktif" : "Pasif"}
                        </span>
                        <span className="pill">{categoryLabel(product.category)}</span>
                      </div>
                      <div>
                        <h3>{product.name}</h3>
                        <p className="caption">
                          {formatCurrency(product.priceCents)} / {product.unitLabel}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="button-secondary admin-inline-button"
                    onClick={() =>
                      isEditing ? setEditingProductId(null) : beginEdit(product)
                    }
                    disabled={isUpdating}
                  >
                    {isEditing ? "Vazgeç" : "Düzenle"}
                  </button>
                </div>

                {isEditing ? (
                  <form className="stack" onSubmit={handleUpdateProduct}>
                    <ProductFormFields
                      form={editingForm}
                      onChange={setEditingForm}
                      disabled={isUpdating}
                      submitLabel="Ürünü güncelle"
                    />

                    <button type="submit" className="button admin-submit" disabled={isUpdating}>
                      {isUpdating ? "Kaydediliyor..." : "Ürünü güncelle"}
                    </button>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
