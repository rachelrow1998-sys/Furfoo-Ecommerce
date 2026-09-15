# Brand fonts

FURFOO uses two licensed typefaces, so they are self-hosted here rather than
loaded from a CDN. Drop the licensed web files into this folder using the names
below and `src/styles/fonts.css` picks them up — no code change needed. Vite
copies everything under `public/` into `dist/` as-is, so the files need to be
committed (or injected by the deploy pipeline) for the built site to serve them;
check your licence terms before committing them to a public repository.

| Role | Family | Expected files (first match wins) |
| --- | --- | --- |
| Display / headings | PinkSunset | `PinkSunset.woff2` (or `.woff` / `.otf` / `.ttf`) |
| Body 400 | Gotham Book | `Gotham-Book.woff2` (or `.woff` / `.otf` / `.ttf`) |
| Body 500 | Gotham Medium | `Gotham-Medium.woff2` … |
| Body 700 | Gotham Bold | `Gotham-Bold.woff2` … |
| Body 900 | Gotham Black | `Gotham-Black.woff2` … |

`.woff2` is strongly preferred — it is roughly half the size of `.otf`. Convert
desktop `.otf`/`.ttf` files with `fonttools`:

```sh
pip install fonttools brotli
fonttools ttLib.woff2 compress Gotham-Book.otf
```

Only the weights you actually ship are required; any missing weight simply falls
back to the nearest available one. Until the files exist the site renders with
the system fallbacks declared in `--font-display` / `--font-body`.
