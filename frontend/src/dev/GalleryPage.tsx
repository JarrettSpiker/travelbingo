import { GALLERY_ENTRIES } from "./gallery/registry";

/**
 * Sentinel proving this module was tree-shaken out of production builds.
 * `npm run build` output is grepped for it — see DESIGN.md and the change's
 * verification tasks. Do not reword it without updating that check.
 */
export const GALLERY_SENTINEL = "__TRAVELBINGO_DEV_GALLERY__";

/**
 * The component gallery: every component, in its meaningful states, on one page.
 *
 * Reachable at /ui in development only. `routes.tsx` guards the route with
 * `import.meta.env.DEV` and loads this module through a dynamic import, so Vite
 * replaces the guard with `false` at build time and Rollup drops the chunk.
 *
 * Its purpose is to make a single screenshot cover the whole UI surface, so a
 * visual change can be reviewed rather than assumed. See frontend/DESIGN.md.
 *
 * Deliberately NOT wrapped in `AppShell`: the gallery is a contact sheet, and
 * the shell is one of the things on it.
 */
export default function GalleryPage() {
  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6"
      data-gallery={GALLERY_SENTINEL}
    >
      <div className="mb-8 grid gap-1">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Component gallery</h1>
        <p className="text-sm text-muted-foreground">
          Development only — every component in its meaningful states. Review this page in light and
          dark, at 390px and 1440px wide, before considering a UI change done.
        </p>
      </div>

      <div className="grid gap-12">
        {GALLERY_ENTRIES.map((galleryEntry) => (
          // `min-w-0`: a grid item defaults to `min-width: auto`, so it refuses
          // to shrink below its content. The card preview panel has a fixed
          // width, which was enough to push the whole gallery wider than a
          // 390px viewport and give the page a horizontal scrollbar.
          <section key={galleryEntry.source} className="min-w-0 overflow-x-auto">
            <h2 className="font-display text-xl font-semibold">{galleryEntry.title}</h2>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{galleryEntry.source}</p>
            <hr className="my-4 border-border" />

            <div className="grid gap-8">
              {galleryEntry.states.map((state) => (
                <div key={state.label}>
                  <p className="text-xs tracking-widest text-muted-foreground uppercase">
                    {state.label}
                  </p>
                  <div className="mt-2">{state.node}</div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
