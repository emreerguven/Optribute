import Link from "next/link";
import { formatCurrency } from "@/src/lib/currency";
import { listCompanies } from "@/src/server/domain/companies/service";
import { listProductsForCompany } from "@/src/server/domain/products/service";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const companies = await listCompanies();
  const dealerCards = await Promise.all(
    companies.map(async (dealer: (typeof companies)[number]) => {
      const products = await listProductsForCompany(dealer.id);

      return {
        ...dealer,
        productCount: products.length,
        starterPrice: products[0]?.priceCents ?? 0
      };
    })
  );
  return (
    <main className="shell stack">
      <section className="hero stack">
        <span className="kicker">Backend-first MVP</span>
        <div className="hero-grid">
          <div>
            <h1>optribute powers QR ordering for water dealers.</h1>
            <p className="lead">
              This first MVP focuses on the shortest path from QR scan to order intake:
              dealer-specific ordering pages, customer phone lookup, and a simple admin
              order queue. No route optimization is included yet.
            </p>
            <div className="actions">
              <Link href="/javsu/order" className="button">
                Open sample order flow
              </Link>
              <Link href="/javsu/admin/orders" className="button-secondary">
                Open sample admin queue
              </Link>
            </div>
          </div>
          <div className="stack">
            <div className="card">
              <h3>Simplest architecture</h3>
              <p className="caption">
                Use one Next.js codebase for UI and APIs, keep business logic under
                <code> src/server/domain </code>, with Prisma and PostgreSQL as the active
                backend foundation.
              </p>
            </div>
            <div className="check-grid">
              <div className="metric">
                <div className="metric-value">1</div>
                <div>Codebase for customer pages and dealer admin</div>
              </div>
              <div className="metric">
                <div className="metric-value">2</div>
                <div>Path-based multi-dealer routing from day one</div>
              </div>
              <div className="metric">
                <div className="metric-value">3</div>
                <div>Orders domain isolated from future dispatch routing</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="two-column">
        <article className="panel stack">
          <div>
            <span className="kicker">Recommended stack</span>
            <h2>Minimal and realistic</h2>
          </div>
          <div className="info-grid">
            <div className="card">
              <h3>Frontend + backend</h3>
              <p className="caption">
                Next.js App Router with route handlers. It gives us mobile-first pages,
                server rendering, simple API endpoints, and a PWA-friendly file layout in
                one repo.
              </p>
            </div>
            <div className="card">
              <h3>Database</h3>
              <p className="caption">
                Prisma schema targeting PostgreSQL for production. Dealer, customer,
                product, and order models are enough for the first release.
              </p>
            </div>
            <div className="card">
              <h3>Authentication</h3>
              <p className="caption">
                Start with dealer admin authentication next, but keep it thin. For this
                scaffold the admin route is intentionally open until auth is added.
              </p>
            </div>
            <div className="card">
              <h3>PWA readiness</h3>
              <p className="caption">
                App directory, manifest, mobile-first screens, and clean API boundaries set
                us up for installability later without changing the domain model.
              </p>
            </div>
          </div>
        </article>

        <article className="panel stack">
          <div>
            <span className="kicker">Folder shape</span>
            <h2>Small surface area</h2>
          </div>
          <div className="card stack">
            <code>app/[dealerSlug]/order</code>
            <code>app/[dealerSlug]/admin/orders</code>
            <code>app/api/dealers/[dealerSlug]/customers/lookup</code>
            <code>app/api/dealers/[dealerSlug]/orders</code>
            <code>src/server/domain/*</code>
            <code>prisma/schema.prisma</code>
          </div>
          <p className="caption">
            That structure keeps UI routes thin and puts dealer, customer, product, and
            order logic in reusable server modules. Future dispatch and routing logic can
            be added as a separate domain instead of leaking into order capture.
          </p>
        </article>
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">Dealer examples</span>
          <h2>Multi-dealer from day one</h2>
        </div>
        <div className="product-grid">
          {dealerCards.map((dealer: (typeof dealerCards)[number]) => {
            return (
              <div key={dealer.id} className="product-card stack">
                <div className="inline-meta">
                  <span className="status">/{dealer.slug}</span>
                  <span className="pill">{dealer.city}</span>
                </div>
                <div>
                  <h3>{dealer.name}</h3>
                  <p className="caption">
                    {dealer.productCount} active products. Starting from{" "}
                    {formatCurrency(dealer.starterPrice)}.
                  </p>
                </div>
                <div className="actions">
                  <Link href={`/${dealer.slug}/order`} className="button-secondary">
                    Customer order page
                  </Link>
                  <Link href={`/${dealer.slug}/admin/orders`} className="button-secondary">
                    Dealer admin page
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel stack">
        <div>
          <span className="kicker">First implementation steps</span>
          <h2>Ship the foundation first</h2>
        </div>
        <div className="stats-grid">
          <div className="card">
            <h3>1. Lock the Prisma schema</h3>
            <p className="caption">
              Keep the dealer, customer, product, and order models stable before adding
              more operational features.
            </p>
          </div>
          <div className="card">
            <h3>2. Seed realistic data</h3>
            <p className="caption">
              Make sure every environment can start with a working dealer catalog, known
              customers, and sample orders.
            </p>
          </div>
          <div className="card">
            <h3>3. Harden order operations</h3>
            <p className="caption">
              Focus on customer lookup, order creation, and dealer order listing before
              growing the admin surface.
            </p>
          </div>
          <div className="card">
            <h3>4. Add dispatch later</h3>
            <p className="caption">
              Introduce delivery runs, stop ordering, and driver assignment as a new domain
              after order volume is flowing.
            </p>
          </div>
        </div>
      </section>

      <p className="footer-text">
        The README and Prisma schema in this scaffold capture the same architecture in more
        detail.
      </p>
    </main>
  );
}
