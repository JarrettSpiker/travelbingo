import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
  The closed list of brands. Adding an entry here is step one of adding a brand;
  `src/brand/types.ts` carries the same list as a TypeScript union, and
  `src/brand/brand.contract.test.ts` asserts the two agree — this file runs in
  Node and cannot import the app's types, so the duplication is checked rather
  than avoided.
*/
const BRAND_IDS = ['travel', 'office'] as const
type BrandId = (typeof BRAND_IDS)[number]

const DEV_DEFAULT_BRAND: BrandId = 'travel'

/**
 * Resolve and validate the brand for this build.
 *
 * Required for `vite build`, defaulted for `vite dev`. Both halves are
 * deliberate: a fresh clone with no `.env.local` still runs `npm run dev`,
 * which is an existing invariant of this repo, while a misconfigured CI job
 * fails instead of quietly shipping travel assets to the office bucket.
 */
function resolveBrand(value: string | undefined, isServe: boolean): BrandId {
  const brand = value || (isServe ? DEV_DEFAULT_BRAND : undefined)
  if (!brand || !(BRAND_IDS as readonly string[]).includes(brand)) {
    throw new Error(
      `VITE_BRAND must be one of: ${BRAND_IDS.join(', ')}` +
        (brand ? ` (got "${brand}")` : ' (not set)'),
    )
  }
  return brand as BrandId
}

const escapeAttr = (value: string) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;')

/**
 * Inject the selected brand's `<head>`.
 *
 * `index.html` carries a neutral title and icon so the raw file is not a lie;
 * everything brand-specific is written here from `brand/<id>/meta.json`, read
 * as JSON rather than imported through `brand/<id>/index.ts` — that module
 * imports `lucide-react`, and pulling React into config load to get a document
 * title is not a trade worth making.
 *
 * Not `%VITE_*%` replacement, which is the usual answer: that would need
 * `VITE_BRAND_TITLE`, `VITE_BRAND_DESCRIPTION`, and the rest as GitHub
 * Environment variables — spreading brand data across CI configuration, which
 * is exactly the drift the brand module exists to prevent.
 *
 * Two tags are omitted rather than guessed. `og:url` and `canonical` need an
 * absolute origin, so with no `VITE_APP_ORIGIN` they are left out entirely
 * instead of pointing somewhere unresolvable. `og:image` is left out until a
 * preview image exists — a broken image is worse than none, because a social
 * card renders the failure.
 */
function brandHtml(brandDir: string, appOrigin: string | undefined): Plugin {
  const meta = JSON.parse(readFileSync(`${brandDir}/meta.json`, 'utf8'))

  const tags = [
    ['name', 'description', meta.description],
    ['property', 'og:type', 'website'],
    ['property', 'og:title', meta.title],
    ['property', 'og:description', meta.description],
    ['property', 'og:site_name', meta.name],
    ['name', 'twitter:card', 'summary'],
    ['name', 'twitter:title', meta.title],
    ['name', 'twitter:description', meta.description],
  ]
  if (appOrigin) tags.push(['property', 'og:url', appOrigin])

  const head = [
    ...tags.map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`),
    ...(appOrigin ? [`<link rel="canonical" href="${escapeAttr(appOrigin)}" />`] : []),
    // Order matters: a browser takes the last `theme-color` whose media
    // matches, so the dark one must follow the unqualified default.
    `<meta name="theme-color" content="${escapeAttr(meta.themeColorLight)}" />`,
    `<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${escapeAttr(
      meta.themeColorDark,
    )}" />`,
  ]

  return {
    name: 'brand-html',
    transformIndexHtml(html) {
      return html
        .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(meta.title)}</title>`)
        .replace(/(<link rel="icon"[^>]*href=")[^"]*(")/, `$1${meta.faviconPath}$2`)
        .replace('</head>', `  ${head.join('\n    ')}\n  </head>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const brand = resolveBrand(env.VITE_BRAND, command === 'serve')
  const brandDir = fileURLToPath(new URL(`./src/brand/${brand}`, import.meta.url))

  return {
    // Tailwind v4 is configured entirely in CSS (see src/index.css) — there is
    // deliberately no tailwind.config.js and no PostCSS pipeline.
    plugins: [react(), tailwindcss(), brandHtml(brandDir, env.VITE_APP_ORIGIN || undefined)],
    /*
      A compile-time literal, not a lookup.

      `src/brand/index.ts` compares against this to pick a brand with a ternary,
      which is what lets the unselected brand's module — copy, suggestion data,
      metadata, icon — be dropped from the bundle entirely. `define` is what
      makes the value *explicit*: without it the build would fall back to
      whatever an unset `import.meta.env.VITE_BRAND` happens to fold to in the
      current bundler, which is a silent wrong-brand deploy waiting to happen.
      `resolveBrand` above is what makes it loud instead.
    */
    define: {
      'import.meta.env.VITE_BRAND': JSON.stringify(brand),
    },
    resolve: {
      alias: {
        // Must stay in step with `paths` in tsconfig.app.json; TypeScript
        // resolves imports for typechecking, Vite resolves them for the bundle,
        // and neither reads the other's config.
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        /*
          The CSS half of the brand seam. `src/index.css` imports these names,
          so it never mentions a brand and exactly one brand's tokens and motifs
          reach a build.

          This resolves inside the Tailwind CSS graph because `@tailwindcss/vite`
          builds its `customCssResolver` from Vite's own resolver — verified by
          spike, including HMR on edit, before this was built on.
        */
        '#brand-theme': `${brandDir}/theme.css`,
        '#brand-motifs': `${brandDir}/motifs.css`,
      },
    },
    server: {
      // Cognito's redirect URI is registered as exactly
      // http://localhost:5173/auth/callback. Without strictPort, a port already
      // in use makes Vite silently serve on 5174, and sign-in then fails with a
      // redirect-mismatch error that reads like an auth bug. Fail loudly instead.
      port: 5173,
      strictPort: true,
      proxy: {
        // In production the API is same-origin: CloudFront routes /api/* to API
        // Gateway. This makes local dev match, so the app never needs a separate
        // base URL or any CORS handling.
        //
        // Set VITE_API_TARGET in frontend/.env.local to point at a deployed
        // environment. Without it there is simply no API locally, and the
        // editor, randomize, print, PNG, and ?card= sharing all still work —
        // which is the behaviour that must never regress.
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
