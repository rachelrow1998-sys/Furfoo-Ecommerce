# FURFOO website

A responsive React + Vite brand site for FURFOO, with a product catalogue, product detail routes, local cart state, Hachi interactions, lazy-loaded product imagery, motion reduction support and a WhatsApp checkout handoff.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`.

## Replace brand media

All public media paths are centralised in `src/config/media.js`. Product data and product image paths live in `src/data/products.js`.

- `public/media/brand/hachi-portrait.png` — official Hachi hero portrait
- `public/media/brand/hachi-action.png` — official Hachi interactive/action pose
- `public/media/brand/hachi-poses.png` — official Hachi expression and pose sheet
- `public/media/brand/hachi-3d.png` — generated fallback character
- `public/media/brand/hachi-real.jpg` — fallback Hachi image and review photo
- `public/media/brand/furfoo-mark.png` — supplied brand artwork
- `public/media/video/hero-loop.mp4` — hero motion layer
- `public/media/products/*` — product artwork

For production, export photographic imagery as AVIF/WebP at roughly 1600px maximum width, keep hero video under 5–7 MB, and add WebM sources alongside MP4 where practical.

## Shop page and catalogue

`src/data/products.js` is the single source of truth for the catalogue: four collections
(`herbal-baths`, `handmade-treats`, `botanical-care`, `wellness-sachets`) and every product,
each naming its `collection` slug. The home category strip, the treat shelf reels, the shop
filters and the product detail breadcrumb all read from it, so a change there updates the
whole site. **Prices are placeholders** — edit them in that file.

`/shop` is the buying page. Every category panel, reel title and collection card deep-links
to `/shop?category=<slug>`; an unknown slug falls back to the full catalogue. With no filter
the page lists each collection as its own titled section; with a filter it shows that
collection's intro panel and grid only. Sorting (featured, price, name) is in the toolbar.

Per-product photos live in `public/media/products/catalog/` and are cut from the official
lineup shots by `scripts/crop-catalog-photos.py` (needs `pip install pillow`). Re-run it
after replacing a lineup photo, or adjust the centre/size values in that file to re-frame a
product. Drop a dedicated photo into `public/media/products/` and point the product's `image`
at it to replace a crop.

## Commerce handoff

The cart lives in the browser: `src/store/CartContext.jsx` keeps `{ id, qty }` pairs in
`localStorage` under `furfoo-cart-v1` and re-reads prices and photos from the catalogue on
load, so a stale bag can never show an old price. Checkout hands an itemised order to
WhatsApp — replace that link in `src/components/CartDrawer.jsx` with the selected payment or
ecommerce provider when the backend is ready. The free shipping threshold that drives the
drawer's progress bar is `FREE_SHIPPING_THRESHOLD` in `src/data/products.js`.
