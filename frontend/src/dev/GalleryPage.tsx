import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
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
 */
export default function GalleryPage() {
  return (
    <Container component="main" maxWidth="lg" sx={{ py: 4 }} data-gallery={GALLERY_SENTINEL}>
      <Stack spacing={1} sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1">
          Component gallery
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Development only — every component in its meaningful states. Review this page in light and
          dark, at 390px and 1440px wide, before considering a UI change done.
        </Typography>
      </Stack>

      <Stack spacing={6}>
        {GALLERY_ENTRIES.map((galleryEntry) => (
          <Box component="section" key={galleryEntry.source}>
            <Typography variant="h5" component="h2" gutterBottom>
              {galleryEntry.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>
              src/components/{galleryEntry.source}
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Stack spacing={4}>
              {galleryEntry.states.map((state) => (
                <Box key={state.label}>
                  <Typography variant="overline" color="text.secondary" component="p">
                    {state.label}
                  </Typography>
                  <Box sx={{ mt: 1 }}>{state.node}</Box>
                </Box>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Container>
  );
}
