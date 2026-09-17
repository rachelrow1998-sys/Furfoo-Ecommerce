# FURFOO website

A responsive React + Vite brand site for FURFOO, with a product catalogue, product detail routes, a stock-aware cart, Hachi interactions, lazy-loaded product imagery, motion reduction support and online checkout.

Products, prices, photos and stock come from the Furfoo POS at `pos.furfoopet.com`
through the storefront API in [`server/`](server/README.md); a paid order is
posted back to the POS, which deducts the stock. See that README for the POS
account, deployment and payment setup.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

To run against the POS, point the site at a running storefront API:

```bash
VITE_STOREFRONT_API=http://localhost:4321 npm run dev
```

Unset, the site uses the catalogue written into `src/data/products.js` and the
WhatsApp handoff, so it builds and previews without any backend. The deployed
site reads the same variable from the repository variable
`VITE_STOREFRONT_API`.

## Replace brand media

All public media paths are centralised in `src/config/media.js`.

Product photos come from the POS — upload them there, not here. What lives in
`src/data/products.js` is the shop's own writing (tasting note, benefit tags,
ingredient line, card colour), matched to a POS product by SKU; fill in each
entry's `sku` once, and the POS owns everything else. The local product images
stay as the fallback for a product whose POS photo is missing.

- `public/media/brand/hachi-portrait.png` — official Hachi hero portrait
- `public/media/brand/hachi-action.png` — official Hachi interactive/action pose
- `public/media/brand/hachi-poses.png` — official Hachi expression and pose sheet
- `public/media/brand/hachi-3d.png` — generated fallback character
- `public/media/brand/hachi-real.jpg` — fallback Hachi image and review photo
- `public/media/brand/furfoo-mark.png` — supplied brand artwork
- `public/media/video/hero-loop.mp4` — hero motion layer
- `public/media/products/*` — product artwork

For production, export photographic imagery as AVIF/WebP at roughly 1600px maximum width, keep hero video under 5–7 MB, and add WebM sources alongside MP4 where practical.

## Commerce

The bag caps each line at the stock the POS reports and survives a reload, so a
payment that leaves the site and comes back does not lose it. Checkout prices
the whole cart server-side against live POS stock — the browser's prices are
never trusted — and the order is recorded in the POS, which deducts the stock,
once payment is confirmed. Payment is bank transfer confirmed by the shop, or
toyyibPay; see [`server/README.md`](server/README.md).
