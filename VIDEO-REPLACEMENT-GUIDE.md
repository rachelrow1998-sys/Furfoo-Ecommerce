# Furfoo hero media replacement guide

The opening uses a static image:

- `public/media/brand/furfoo-logo-hero.png`

The final Hero video lives in `public/videos/`:

- `hero-banner-final.mp4`

The Hero player always forces `muted`, `defaultMuted`, and volume `0`. The separate source MP3 is not used or copied into the website.

## Recommended export

Use a PNG or WebP logo image with its important artwork centered. The supplied red background fills any unused space on narrow screens.

Use MP4 files encoded with H.264 at 1920 × 1080 (16:9), 30 fps, and without an audio track. Keep file sizes practical for the web. Each video should begin and end with a stable frame so the opacity crossfades remain clean.

## Replace media without code changes

Replace the image or clip using the filenames above. No animation code needs to change.

## Use different filenames

Open `src/components/FurfooScrollHero.jsx`. Update `HERO_CONFIG.introLogo` for a different logo filename, or the `src` value in `HERO_CONFIG.videos` for a different Hachi filename.

## Tune the animation

All settings are grouped in `HERO_CONFIG` near the top of `src/components/FurfooScrollHero.jsx`:

- Scroll distance: `desktop.scrollDistanceVh` and `mobile.scrollDistanceVh`
- Opening logo expansion: `intro` plus `introInitialScale` and `introPreviewScale` in the desktop/mobile groups
- Impact strength: `shakeX` and `shakeScale` in the desktop/mobile groups
- Desktop crop: `desktop.objectPosition`
- Mobile crop: `mobile.objectPosition`

`scrubVideoFrames` is intentionally `false`. With the default behavior, entering a stage plays its video forward and inactive videos pause. Set it to `true` only for future frame-scrubbing experiments.
