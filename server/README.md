# Furfoo storefront API

The bridge between the Furfoo website and the Furfoo POS.

```
 Browser (furfoopet.com, a static build — holds no secrets)
    │  GET  /api/storefront/catalog        products, prices, photos, live stock
    │  POST /api/storefront/checkout       places an order, starts the payment
    │  GET  /api/storefront/orders/:id     order status for the customer
    ▼
 Storefront API  (this folder — one Node process on Hostinger)
    │  signs in as a dedicated POS employee, keeps the session in memory
    │  GET  {POS}/api/inventory/products   catalogue + stock  (cached briefly)
    │  POST {POS}/api/online/whatsapp-orders   a paid order → stock deducted
    ▼
 Furfoo POS  (pos.furfoopet.com — the system of record)
```

The POS owns products, prices, photos and stock. This service owns nothing the
POS could own: only the website order between "placed" and "paid", plus the
delivery address the POS has no field for.

**It never touches the POS database.** The POS prevents two tills overselling
the last unit by running exactly one process against its SQLite file, and a
second writer would break that guarantee. Everything here goes through the POS
HTTP API, and the stock deduction happens inside the POS's own checkout
transaction.

## What the shop needs to set up once

### 1. A POS account for the website

In the POS, create an employee — not a person's login — for example `website`,
and give its role:

| Permission | Why |
| --- | --- |
| `view_stock` (or `access_pos`) | read `/api/inventory/products` for the catalogue and stock |
| `import_online_orders` | post a paid website order to `/api/online/whatsapp-orders` |

Nothing else. The account never needs finance, settings or employee access.
Set a long password and put it in `POS_PASSWORD` here; it is read by this
service only and never reaches a browser.

Website orders arrive in the POS as WhatsApp-channel online orders, paid, with
fulfilment `pending`, so they appear in the same place as the shop's other
online orders.

### 2. Product photos

Photos come from the POS: a photo uploaded there is served from
`/uploads/products/…`, which the POS serves publicly, and the website links to
it directly. A product imported from a marketplace keeps its CDN URL. Nothing
needs re-uploading to the website, and a photo changed in the POS changes on the
shop within a minute.

### 3. Which products appear

Every **active** product with a price appears on the shop. To publish a subset,
set `CATALOG_SKU_PREFIXES` (e.g. `FF-TRT-,FF-HB-`) or `CATALOG_SKU_BLOCKLIST`.

The website's own writing — tasting notes, benefit tags, ingredient lines, card
colours — lives in `src/data/products.js` in the site repository and is matched
to a POS product by SKU. A product with no entry there still appears, using its
POS name, category and photo.

## Running it

```bash
cp .env.example .env    # then fill in POS_PASSWORD and STOREFRONT_ADMIN_TOKEN
npm start               # Node 22.5+ (node:sqlite)
npm test                # end-to-end cover against a stand-in POS
```

The website reads `VITE_STOREFRONT_API`:

```bash
# in the site root
VITE_STOREFRONT_API=http://localhost:4321 npm run dev
```

Unset, the site falls back to the catalogue in `src/data/products.js` and the
WhatsApp handoff, so it still builds and previews on its own.

## Deploying on Hostinger

A second Node.js application beside the POS, never the same one:

- **Do not** point `ORDERS_DATABASE_PATH` at the POS database. It is this
  service's own file.
- Keep that file outside the deployed directory (e.g.
  `../furfoo-data/storefront/storefront.sqlite`), so a deployment cannot
  replace the orders.
- Run **one** process. Like the POS, this service assumes its SQLite file has a
  single writer.
- Set `ALLOWED_ORIGINS` to the real shop origin (`https://furfoopet.com`), not
  `*`. Only listed origins may call the API from a browser.
- Set `APP_ENV=production`. That makes `STOREFRONT_ADMIN_TOKEN`,
  `PUBLIC_SITE_URL` and an https POS URL mandatory instead of optional.

Then point the site at it: rebuild the site with
`VITE_STOREFRONT_API=https://api.furfoopet.com` (or whatever host it gets).

## Taking payment

### Bank transfer / WhatsApp (`PAYMENT_PROVIDER=manual`, the default)

The customer places the order, sees the transfer instructions and the order
reference, and sends the receipt. The shop confirms it:

```bash
curl -X POST https://api.furfoopet.com/api/storefront/admin/orders/WEB-260917-XXXX/mark-paid \
  -H "authorization: Bearer $STOREFRONT_ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d '{"paymentReference":"MBB-77812","note":"transfer seen"}'
```

That confirmation is what records the order in the POS and deducts the stock.

### toyyibPay (`PAYMENT_PROVIDER=toyyibpay`)

Checkout creates a bill and sends the customer to toyyibPay. When the payment
finishes, toyyibPay calls back and the service **re-reads the payment from
toyyibPay's API with the shop's secret key** before marking anything paid — a
callback alone is never trusted, because anyone can post to a public URL.

Run one sandbox bill end to end (dev.toyyibpay.com) before going live, and check
the callback reaches `PUBLIC_API_URL`.

## Day to day

```bash
# is the POS link healthy, and is anything stuck?
curl https://api.furfoopet.com/health

# orders that took money but the POS refused
curl -H "authorization: Bearer $TOKEN" \
  "https://api.furfoopet.com/api/storefront/admin/orders?status=pos_failed"

# after restocking, push one through again
curl -X POST -H "authorization: Bearer $TOKEN" \
  https://api.furfoopet.com/api/storefront/admin/orders/WEB-260917-XXXX/retry-pos
```

Order states: `awaiting_payment` → `paid` → `recorded` (in the POS, stock
deducted). `pos_failed` is paid but not recorded; `expired` is an unpaid order
that timed out.

## Two things worth knowing

**The shop can be up to a minute behind the counter.** The catalogue is cached
for `POS_CATALOG_TTL_MS`, so a sale at the till shows on the website shortly
after, not instantly. Checkout always re-reads stock from the POS, so the delay
can never sell something that is gone.

**There is no stock reservation, so an oversell is possible.** The POS moves
stock when an order is recorded, and it has no concept of holding units for
someone who may never pay. Two customers can therefore both be allowed to pay
for the last unit within the same payment window. The POS refuses the second
order — it re-checks stock inside its own transaction — that order lands in
`pos_failed`, and `/health` reports it. The shop refunds it or restocks and
retries. The alternative, holding stock for an unpaid website order, takes units
away from the customer standing at the counter.
