import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'

import { ErrorBoundary } from './ErrorBoundary.jsx'

// The user must replace this with their actual Google Client ID
const GOOGLE_CLIENT_ID = "757539697967-e199pg2lct0us4j403ebmtqm3spaepva.apps.googleusercontent.com";

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </GoogleOAuthProvider>
  </StrictMode>,
)
