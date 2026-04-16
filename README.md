# optribute MVP scaffold

This repository is the first greenfield scaffold for **optribute**, a QR-based ordering platform for water distributors and dealers.

## Plan and assumptions

- We are starting from a clean directory with no existing backend or route optimizer.
- Backend-first is the active priority.
- The current customer and admin pages stay intentionally minimal.
- Authentication, analytics, background jobs, queues, and external services are explicitly deferred.
- Multi-company support is required from day one, and path-based routing is enough for the MVP.
- Route optimization is intentionally excluded from the MVP, but the domain boundaries should leave room for it later.

## Current backend-first scope

This phase is focused on five things:

- Prisma schema correctness
- seed data
- customer lookup by company and phone
- order creation
- dealer/company order listing

Everything else is secondary until these flows are solid.

## Recommended architecture

### Simplest full-stack approach

Use **Next.js App Router** as the single full-stack application.

Why this is the right MVP choice:

- One codebase for customer pages, company admin pages, and backend endpoints.
- Fast to ship with a small team.
- Path-based company routing works naturally with dynamic segments like `/javsu/order`.
- Route handlers let us build backend-first APIs without standing up a separate service too early.
- Prisma-backed domain services keep the database model close to the application behavior.

### Recommended stack

- Framework: Next.js with TypeScript
- Backend API: Next.js route handlers
- Data access: Prisma ORM with PostgreSQL
- Database: a single local PostgreSQL connection for MVP development
- Seeding: Prisma seed script with stable sample data

## Core data model

The MVP database focuses only on these models:

- `Company`
- `Customer`
- `Product`
- `Order`
- `OrderItem`
- `Payment`

### Notes on the model shape

- `Company` is the tenant boundary.
- `Customer` is unique per company by normalized phone.
- `Order` stores customer snapshot fields so the order remains stable over time.
- `OrderItem` stores product snapshots so product name and price remain stable after ordering.
- `Payment` is intentionally simple for now and supports a basic pending cash-on-delivery flow.

## Folder structure

```text
app/
  [dealerSlug]/
    order/
      page.tsx
      order-form.tsx
    admin/
      orders/
        page.tsx
  api/
    dealers/
      [dealerSlug]/
        customers/
          lookup/route.ts
        orders/route.ts
  globals.css
  layout.tsx
  manifest.ts
  page.tsx
prisma/
  schema.prisma
  seed.ts
src/
  generated/
    prisma/
  server/
    db.ts
    domain/
      companies/
      customers/
      orders/
      phone.ts
      products/
      types.ts
```

## Core backend flows

### Customer lookup

1. Resolve company from slug.
2. Normalize the phone number.
3. Query customer by compound key: company + normalized phone.
4. Return default address and saved notes if found.

### Order creation

1. Resolve company from slug.
2. Validate submitted fields and item quantities.
3. Upsert customer by company + normalized phone.
4. Update or create the customer's default address.
5. Validate product ownership against the company.
6. Create the order, order-item snapshots, and a minimal pending payment record in one transaction.

### Company order listing

1. Resolve company.
2. Query orders by company.
3. Include order items and payments.
4. Sort newest-first by submitted time.

## Local development

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:push
npm run db:seed
npm run dev
```

Then open:

- `/`
- `/javsu/order`
- `/javsu/admin/orders`

## Notes

The pages are still intentionally light. For now the real work is making sure the database schema and the order operations foundation are correct before expanding UI or admin capabilities.
