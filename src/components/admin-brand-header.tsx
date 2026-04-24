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
  const visualUrl = dealer.heroImageUrl ?? dealer.logoUrl;

  return (
    <section className="admin-brand-header panel stack">
      <div className="admin-brand-header-inner stack">
        <div className="admin-brand-header-topline">
          <div className="admin-brand-chip">
            {visualUrl ? (
              <img
                src={visualUrl}
                alt={`${dealer.name} görseli`}
                className="admin-brand-visual"
              />
            ) : (
              <div className="admin-brand-visual admin-brand-logo-fallback" aria-hidden="true">
                {dealer.name.slice(0, 1)}
              </div>
            )}

            <div className="admin-brand-identity">
              <div className="stack-tight">
                <strong>{dealer.name}</strong>
                <span className="caption">{dealer.city ?? "Bayi paneli"}</span>
              </div>
            </div>
          </div>

          {actions ? <div className="actions admin-brand-actions">{actions}</div> : null}
        </div>

        <div className="stack admin-brand-copy">
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
