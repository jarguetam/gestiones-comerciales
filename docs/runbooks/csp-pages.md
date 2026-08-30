# CSP en GitHub Pages

Pages **no** setea `Content-Security-Policy` HTTP. El control es el
`<meta http-equiv="Content-Security-Policy">` de `apps/web/index.html` y
`apps/backoffice/index.html`.

## Política

- `script-src 'self'` — **sin** `unsafe-inline`. El bundle Vite es un
  `<script type="module">` externo.
- `style-src 'self' 'unsafe-inline'` — Tailwind y estilos de Leaflet/attrs.
- `connect-src` incluye `https://*.supabase.co`, `wss://*.supabase.co` y
  `https://*.sentry.io`.
- `img-src` permite `https:` y `blob:` (teselas OSM + firmas).
- Fuentes: Plus Jakarta Sans desde Google Fonts (`fonts.googleapis.com` /
  `fonts.gstatic.com`).

## CDN / Sentry

El SDK `@sentry/react` se carga desde el mismo origin (chunk del build).
Los envelopes van a `*.sentry.io`. No hay script de Sentry Loader en el HTML.

## Dev local

`pnpm dev` (Vite HMR) puede chocar con CSP estricta. El preview de CI y
Pages usan `vite build` + `vite preview`, que sí cumple `script-src 'self'`.
