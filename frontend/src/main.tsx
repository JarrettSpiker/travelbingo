import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// First, so the token layer and Tailwind's preflight are in place before
// anything else. App.css (imported by App.tsx) is unlayered and therefore keeps
// winning over Tailwind's layered rules regardless — see src/index.css.
import './index.css'
// Card-content choices offered to the user, and keeping the two sets apart is
// the point. The *chrome* font is a brand asset and is imported by the selected
// brand's `theme.css` instead — a brand that wants no chrome font downloads
// none simply by not importing one.
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/anton/400.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/700.css'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { applyColorMode, readStoredColorMode } from './lib/colorMode'
import { TooltipProvider } from './components/ui/tooltip'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { NotificationsProvider } from './notifications/NotificationsProvider.tsx'
import { AppRoutes } from './routes.tsx'

/*
  Apply the stored colour mode before the tree mounts.

  This cannot be an inline script in index.html, which is the usual way to beat
  first paint: the production CSP is `script-src 'self'` with no 'unsafe-inline'
  and no hash, so an inline script is blocked — and blocked only in production,
  since CloudFront applies the CSP and dev never sees it.

  Running here is enough because the page's base colour is painted by CSS on
  <html> (see base.css), not by anything in this tree. Nothing outside React
  reads a token, so nothing can flash.
*/
applyColorMode(readStoredColorMode())

/*
  A data router with one catch-all route, whose element is the whole app.

  Routing itself is still declarative and still lives in routes.tsx: the <Routes>
  in there are descendant routes of this one. The data router is here for the
  router-level APIs the declarative <BrowserRouter> does not provide — namely
  useBlocker, which the unsaved-changes guard uses to intercept every navigation
  away from a dirty editor at one point instead of per link. See
  src/hooks/useUnsavedChangesGuard.ts.

  The providers sit inside the route element rather than above the router, which
  is where they used to be. That is safe because this route matches every path:
  the element never changes across a navigation, so React keeps the providers —
  and the session state in them — mounted. It is a static element rather than a
  component so this file still exports nothing but its side effects.

  Radix tooltips need one provider above every trigger, true for both the app and
  the /ui gallery, which renders components outside the shell. AuthProvider
  renders its children immediately at status "loading", so it never gates first
  paint, and a visitor with no stored session makes no network call at all.
*/
const router = createBrowserRouter([
  {
    path: '*',
    element: (
      <TooltipProvider delayDuration={300}>
        <AuthProvider>
          {/* Inside AuthProvider because it reads the auth state (one fetch of
              the bell count when a session appears); inside AppRoutes so every
              page — and the header's bell — share the one count. Like
              AuthProvider, it renders children immediately and gates nothing. */}
          <NotificationsProvider>
            <AppRoutes />
          </NotificationsProvider>
        </AuthProvider>
      </TooltipProvider>
    ),
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
