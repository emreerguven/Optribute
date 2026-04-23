"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  dealerSlug: string;
};

type LoginStep = "phone" | "code";

export function LoginForm({ dealerSlug }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [developmentCode, setDevelopmentCode] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function requestCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setDevelopmentCode(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/admin/auth/request-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; developmentCode?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Kod gönderilemedi");
      }

      setDevelopmentCode(payload.developmentCode ?? null);
      setStep("code");
      setMessage("Doğrulama kodu gönderildi.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kod gönderilemedi");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/dealers/${dealerSlug}/admin/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ phone, code })
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error ?? "Kod doğrulanamadı");
      }

      router.push(`/${dealerSlug}/admin/orders`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Kod doğrulanamadı");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="panel login-panel stack">
      {step === "phone" ? (
        <form className="stack" onSubmit={requestCode}>
          <div>
            <h2>Telefon numaranızı girin</h2>
            <p className="caption">Yalnızca yetkili bayi telefonları giriş yapabilir.</p>
          </div>
          <label>
            Telefon numarası
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="05xx xxx xx xx"
              inputMode="tel"
              autoComplete="tel"
              disabled={isSubmitting}
            />
          </label>
          {message ? <div className="note warning">{message}</div> : null}
          <button type="submit" className="button submit-button" disabled={isSubmitting}>
            {isSubmitting ? "Gönderiliyor..." : "Kod gönder"}
          </button>
        </form>
      ) : (
        <form className="stack" onSubmit={verifyCode}>
          <div>
            <h2>Doğrulama kodu</h2>
            <p className="caption">Telefonunuza gelen 6 haneli kodu girin.</p>
          </div>
          <label>
            Kod
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              inputMode="numeric"
              autoComplete="one-time-code"
              disabled={isSubmitting}
            />
          </label>
          {developmentCode ? (
            <div className="note">Geliştirme kodu: {developmentCode}</div>
          ) : null}
          {message ? (
            <div className={`note ${message.includes("gönderildi") ? "" : "warning"}`}>
              {message}
            </div>
          ) : null}
          <div className="actions">
            <button type="submit" className="button submit-button" disabled={isSubmitting}>
              {isSubmitting ? "Doğrulanıyor..." : "Kodu doğrula"}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setStep("phone");
                setCode("");
                setMessage(null);
                setDevelopmentCode(null);
              }}
              disabled={isSubmitting}
            >
              Telefonu değiştir
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
