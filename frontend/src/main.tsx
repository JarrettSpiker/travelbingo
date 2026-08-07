import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// First, so the token layer and Tailwind's preflight are in place before
// anything else. App.css (imported by App.tsx) is unlayered and therefore keeps
// winning over Tailwind's layered rules regardless — see src/index.css.
import './index.css'
// App chrome only — the families below are card-content choices offered to the
// user, and keeping the two sets apart is the point. One variable file.
import '@fontsource-variable/outfit'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/anton/400.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/700.css'
import { BrowserRouter } from 'react-router'
import { applyColorMode, readStoredColorMode } from './lib/colorMode'
import { TooltipProvider } from './components/ui/tooltip'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { AppRoutes } from './routes.tsx'

/*
  Apply the stored colour mode before the tree mounts.

  This cannot be an inline script in index.html, which is the usual way to beat
  first paint: the production CSP is `script-src 'self'` with no 'unsafe-inline'
  and no hash, so an inline script is blocked — and blocked only in production,
  since CloudFront applies the CSP and dev never sees it.

  Running here is enough because the page's base colour is painted by CSS on
  <html> (see index.css), not by anything in this tree. Nothing outside React
  reads a token, so nothing can flash.
*/
applyColorMode(readStoredColorMode())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/*
      Radix tooltips need one provider above every trigger. This is the only
      place that is true for both the app and the /ui gallery, which renders
      components outside the shell.
    */}
    <TooltipProvider delayDuration={300}>
      <BrowserRouter>
        {/*
          AuthProvider renders its children immediately at status "loading", so
          it never gates first paint, and a visitor with no stored session makes
          no network call at all.
        */}
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </StrictMode>,
)
