import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider } from '@mui/material/styles'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/700.css'
import '@fontsource/playfair-display/400.css'
import '@fontsource/playfair-display/700.css'
import '@fontsource/anton/400.css'
import '@fontsource/pacifico/400.css'
import '@fontsource/fredoka/400.css'
import '@fontsource/fredoka/700.css'
import { BrowserRouter } from 'react-router'
import { theme } from './theme'
import { AuthProvider } from './auth/AuthProvider.tsx'
import { AppRoutes } from './routes.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme} defaultMode="system">
      <CssBaseline />
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
    </ThemeProvider>
  </StrictMode>,
)
