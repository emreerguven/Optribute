"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Courier } from "@/src/server/domain/types";

type Props = {
  dealerSlug: string;
  initialCouriers: Courier[];
};

type CourierFormState = {
  fullName: string;
  phone: string;
  isActive: boolean;
};

function createEmptyForm(): CourierFormState {
  return {
    fullName: "",
    phone: "",
    isActive: true
  };
}

function formFromCourier(courier: Courier): CourierFormState {
  return {
    fullName: courier.fullName,
    phone: courier.phone,
    isActive: courier.isActive
  };
}

export function CouriersManager({ dealerSlug, initialCouriers }: Props) {
  const [couriers, setCouriers] = useState(initialCouriers);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCourierForm, setNewCourierForm] = useState<CourierFormState>(createEmptyForm());
  const [editingCourierId, setEditingCourierId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CourierFormState>(createEmptyForm());
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const sortedCouriers = useMemo(
    () =>
      [...couriers].sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1;
        }

        return left.fullName.localeCompare(right.fullName, "tr");
      }),
    [couriers]
  );

  async function handleCreateCourier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateMessage(null);
    setIsCreating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/couriers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(newCourierForm)
      });

      const payload = (await response.json()) as { courier?: Courier; error?: string };

      if (!response.ok || !payload.courier) {
        throw new Error(payload.error ?? "Kurye oluşturulamadı");
      }

      setCouriers((current) => [...current, payload.courier!]);
      setNewCourierForm(createEmptyForm());
      setCreateMessage("Yeni kurye kaydedildi.");
    } catch (error) {
      setCreateMessage(error instanceof Error ? error.message : "Kurye oluşturulamadı");
    } finally {
      setIsCreating(false);
    }
  }

  function beginEdit(courier: Courier) {
    setEditingCourierId(courier.id);
    setEditingForm(formFromCourier(courier));
    setUpdateMessage(null);
  }

  async function handleUpdateCourier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingCourierId) {
      return;
    }

    setUpdateMessage(null);
    setIsUpdating(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/couriers/${editingCourierId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(editingForm)
      });

      const payload = (await response.json()) as { courier?: Courier; error?: string };

      if (!response.ok || !payload.courier) {
        throw new Error(payload.error ?? "Kurye güncellenemedi");
      }

      setCouriers((current) =>
        current.map((courier) => (courier.id === payload.courier?.id ? payload.courier : courier))
      );
      setEditingCourierId(null);
      setUpdateMessage("Kurye güncellendi.");
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : "Kurye güncellenemedi");
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="admin-section-header">
          <div>
            <span className="kicker">Yeni kurye</span>
            <h2>Kurye oluştur</h2>
            <p className="caption">Kurye adı ve telefonunu ekleyin. Silme yerine pasif yapabilirsiniz.</p>
          </div>
          <button
            type="button"
            className="button-secondary admin-inline-button"
            onClick={() => setIsCreateOpen((current) => !current)}
          >
            {isCreateOpen ? "Paneli kapat" : "Yeni kurye ekle"}
          </button>
        </div>

        {isCreateOpen ? (
        <form className="stack" onSubmit={handleCreateCourier}>
          <div className="product-form-grid">
            <label>
              Ad soyad
              <input
                value={newCourierForm.fullName}
                onChange={(event) =>
                  setNewCourierForm((current) => ({ ...current, fullName: event.target.value }))
                }
                placeholder="Örn. Ali Yıldız"
                disabled={isCreating}
              />
            </label>

            <label>
              Telefon
              <input
                value={newCourierForm.phone}
                onChange={(event) =>
                  setNewCourierForm((current) => ({ ...current, phone: event.target.value }))
                }
                placeholder="05xx xxx xx xx"
                disabled={isCreating}
              />
            </label>

            <label className="toggle-field">
              <input
                type="checkbox"
                checked={newCourierForm.isActive}
                onChange={(event) =>
                  setNewCourierForm((current) => ({ ...current, isActive: event.target.checked }))
                }
                disabled={isCreating}
              />
              <span>Kurye aktif olsun</span>
            </label>
          </div>

          {createMessage ? (
            <div className={`note ${createMessage.includes("kaydedildi") ? "" : "warning"}`}>
              {createMessage}
            </div>
          ) : null}

          <button type="submit" className="button admin-submit" disabled={isCreating}>
            {isCreating ? "Kaydediliyor..." : "Yeni kuryeyi kaydet"}
          </button>
        </form>
        ) : null}
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">Kurye listesi</span>
          <h2>Kuryeler</h2>
          <p className="caption">Sipariş ataması için kullanılacak kuryeleri yönetin.</p>
        </div>

        {updateMessage ? (
          <div className={`note ${updateMessage.includes("güncellendi") ? "" : "warning"}`}>
            {updateMessage}
          </div>
        ) : null}

        {sortedCouriers.length === 0 ? (
          <div className="note">Henüz kurye bulunmuyor.</div>
        ) : (
          <div className="product-admin-list">
            {sortedCouriers.map((courier) => {
              const isEditing = editingCourierId === courier.id;

              return (
                <article key={courier.id} className="order-card stack compact-stack">
                  <div className="product-admin-topline">
                    <div>
                      <span className="detail-label">Kurye</span>
                      <h3>{courier.fullName}</h3>
                      <p className="caption">{courier.phone}</p>
                    </div>
                    <span className={courier.isActive ? "status" : "status status-muted"}>
                      {courier.isActive ? "Aktif" : "Pasif"}
                    </span>
                  </div>

                  {isEditing ? (
                    <form className="stack" onSubmit={handleUpdateCourier}>
                      <div className="product-form-grid">
                        <label>
                          Ad soyad
                          <input
                            value={editingForm.fullName}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, fullName: event.target.value }))
                            }
                            disabled={isUpdating}
                          />
                        </label>

                        <label>
                          Telefon
                          <input
                            value={editingForm.phone}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, phone: event.target.value }))
                            }
                            disabled={isUpdating}
                          />
                        </label>

                        <label className="toggle-field">
                          <input
                            type="checkbox"
                            checked={editingForm.isActive}
                            onChange={(event) =>
                              setEditingForm((current) => ({ ...current, isActive: event.target.checked }))
                            }
                            disabled={isUpdating}
                          />
                          <span>Kurye aktif</span>
                        </label>
                      </div>

                      <div className="actions">
                        <Link
                          href={`/${dealerSlug}/admin/couriers/${courier.id}`}
                          className="button-secondary admin-inline-button"
                        >
                          Teslimat listesi
                        </Link>
                        <button type="submit" className="button admin-inline-button" disabled={isUpdating}>
                          {isUpdating ? "Güncelleniyor..." : "Kaydet"}
                        </button>
                        <button
                          type="button"
                          className="button-secondary admin-inline-button"
                          onClick={() => setEditingCourierId(null)}
                          disabled={isUpdating}
                        >
                          Vazgeç
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="actions">
                      <Link
                        href={`/${dealerSlug}/admin/couriers/${courier.id}`}
                        className="button-secondary admin-inline-button"
                      >
                        Teslimat listesi
                      </Link>
                      <button type="button" className="button-secondary admin-inline-button" onClick={() => beginEdit(courier)}>
                        Düzenle
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
