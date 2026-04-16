import Link from "next/link";

export default function NotFound() {
  return (
    <main className="shell stack">
      <section className="hero stack">
        <span className="kicker">Not found</span>
        <h1>This dealer page does not exist.</h1>
        <p className="lead">
          Check the QR path or jump back to the sample optribute MVP entry points.
        </p>
        <div className="actions">
          <Link href="/" className="button">
            Go to home
          </Link>
          <Link href="/javsu/order" className="button-secondary">
            Open sample dealer page
          </Link>
        </div>
      </section>
    </main>
  );
}
