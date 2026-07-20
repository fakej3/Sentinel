# Sentinel Web — Deployment Guide

## Overview

The web app runs entirely in the browser. There is no backend server — the
full analysis engine executes client-side. Any static host that can serve
an `index.html` will work.

## Prerequisites

```
Node.js >= 18
npm >= 9
```

## Build

```bash
cd web
npm install
npm run build   # runs tsc + vite build
```

Output is written to `web/dist/`.

## Vercel (recommended)

### Option A — Deploy the `web/` subdirectory

1. Push the repository to GitHub.
2. In the Vercel dashboard, click **Add New → Project** and import the repo.
3. Under **Root Directory**, set it to `web`.
4. Vercel detects Vite automatically. The default settings work:
   - Build command: `npm run build`
   - Output directory: `dist`
5. Click **Deploy**.

The `vercel.json` at `web/vercel.json` rewrites all paths to `index.html`,
which is standard practice even though the app does not use URL-based routing.

### Option B — Deploy from the repo root

Add a `vercel.json` at the repo root:

```json
{
  "buildCommand": "cd web && npm install && npm run build",
  "outputDirectory": "web/dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Environment variables

No environment variables are required. The Gemini API key is supplied by the
user at runtime via the Settings page and stored in their browser's
`localStorage`.

### Social share image (optional)

Add a 1200×630 PNG at `web/public/og-image.png` and add this tag to
`index.html` inside `<head>`:

```html
<meta property="og:image" content="https://your-domain.com/og-image.png" />
<meta property="og:url" content="https://your-domain.com" />
```

## Other static hosts

The build output is a plain static site. Any host that serves static files
works (Netlify, Cloudflare Pages, GitHub Pages, S3 + CloudFront, etc.).
Configure the host to serve `index.html` for all 404/fallback routes.

### Netlify

Add `web/public/_redirects`:

```
/* /index.html 200
```

### Cloudflare Pages

Set the build output directory to `dist` and the root directory to `web`.
Cloudflare Pages serves SPAs by default; no rewrite rule is needed.

### GitHub Pages

GitHub Pages does not support catch-all rewrites natively. If URL-based
routing is not used (which is the case for this app — navigation state is
stored in `localStorage`), deploying the `dist/` folder directly works.
Use the `gh-pages` npm package or a GitHub Actions workflow to push
`dist/` to the `gh-pages` branch.

## Local preview

```bash
cd web
npm run build
npm run preview   # serves dist/ on http://localhost:4173
```
