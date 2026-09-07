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

## Commerce handoff

The cart is intentionally local and resets on refresh. Replace the WhatsApp checkout link in `src/components/CartDrawer.jsx` with the selected payment or ecommerce provider when the backend is ready.
