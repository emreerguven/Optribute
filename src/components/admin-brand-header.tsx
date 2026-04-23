import type { ReactNode } from "react";
import type { Company } from "@/src/server/domain/types";

type Props = {
  dealer: Company;
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
  summary?: ReactNode;
};

export function AdminBrandHeader({ dealer, kicker, title, description, actions, summary }: Props) {
  return (
    <section className="admin-brand-header panel stack">
      {dealer.heroImageUrl ? (
        <div
          className="admin-brand-header-media"
          style={{
            backgroundImage: `linear-gradient(135deg, rgba(255,255,255,0.94), rgba(255,255,255,0.84)), url(${dealer.heroImageUrl})`
          }}
        />
      ) : null}

      <div className="admin-brand-header-inner stack">
        <div className="admin-brand-header-topline">
          <div className="admin-brand-chip">
            {dealer.logoUrl ? (
              <img src={dealer.logoUrl} alt={`${dealer.name} logosu`} className="admin-brand-logo" />
            ) : (
              <div className="admin-brand-logo admin-brand-logo-fallback" aria-hidden="true">
                {dealer.name.slice(0, 1)}
              </div>
            )}
            <div className="stack-tight">
              <strong>{dealer.name}</strong>
              <span className="caption">{dealer.city ?? "Bayi paneli"}</span>
            </div>
          </div>

          {actions ? <div className="actions admin-brand-actions">{actions}</div> : null}
        </div>

        <div className="hero-grid admin-brand-grid">
          <div>
            <span className="kicker">{kicker}</span>
            <h1>{title}</h1>
            <p className="lead">{description}</p>
          </div>
          {summary ? <div className="stats-grid">{summary}</div> : null}
        </div>
      </div>
    </section>
  );
}
