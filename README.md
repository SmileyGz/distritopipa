# Distrito Pipa — distritopipa.com

Premium smoke accessories store in Cancún, Mexico.
Built with Next.js 14, Supabase, Cloudflare Pages.

## Stack
- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Framer Motion
- **Database:** Supabase (PostgreSQL + Storage)
- **Hosting:** Cloudflare Pages
- **AI:** Anthropic Claude API (caption generation)

## Project structure
```
app/
├── (home)/page.tsx          # Home page
├── menu/page.tsx            # Product shelf/catalog
├── booking/page.tsx         # Customer order form
├── comunidad/page.tsx       # Community Q&A
├── aviso-de-privacidad/     # Privacy notice
├── admin/                   # Password-protected admin panel
│   ├── products/            # Product CRUD + image upload
│   ├── orders/              # Order queue + WhatsApp pipeline
│   ├── community/           # Post moderation + blocklist
│   ├── analytics/           # Business metrics dashboard
│   └── campaigns/           # 2-month social media builder
└── api/                     # API routes

components/
├── AgeGate.tsx              # 18+ verification gate
├── Shelf.tsx                # Product catalog (reads from Supabase)
├── ProductCard.tsx          # Individual product card
└── ProductDetail.tsx        # Bottom drawer detail view

lib/
├── supabase.ts              # Typed Supabase clients
└── whatsapp.ts              # WhatsApp message builders (3 payment modes)

sql/                         # Run these in Supabase SQL Editor in order
├── 001_age_gate_logs.sql
├── 002_core_systems.sql     # Customers, loyalty, community, blocklist
├── 003_products_supabase.sql # Products + Storage bucket + seed data
├── 004_orders.sql           # Orders + payment pipeline
└── 005_campaigns.sql        # Social media campaigns

middleware.ts                # Security headers (Cloudflare edge)
```

## Setup

### 1. Environment variables
Copy `.env.example` to `.env.local` and fill in:
- Supabase URL + anon key + service role key
- Admin secret (your password for /admin)
- WhatsApp number
- Anthropic API key (for AI caption generation)

### 2. Run SQL migrations
Go to Supabase Dashboard → SQL Editor and run each file in the `sql/` folder in order.
**Important:** In `003_products_supabase.sql`, replace `YOUR_PROJECT_REF` with your actual Supabase project reference.

### 3. Install and run locally
```bash
npm install
npm run dev
```

### 4. Deploy to Cloudflare Pages
Connect your GitHub repo to Cloudflare Pages.
Build command: `npm run build`
Output directory: `.next`

Add all environment variables in Cloudflare Pages → Settings → Environment Variables.

## Admin panel
Access at `/admin` — password is `NEXT_PUBLIC_ADMIN_SECRET` from your env vars.

## Legal
- Aviso de Privacidad must be reviewed by a Mexican lawyer before collecting customer data (LFPDPPP compliance)
- All products are personal use accessories — no sustancias included
- Age gate (18+) is required on every visit

---
*Accesorios de uso personal · Producto legal · No incluye sustancias*
*Distrito Pipa — Cancún 🌴*
