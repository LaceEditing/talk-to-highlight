import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { GoogleOAuthProvider } from '@react-oauth/google'
import App from './App'
import './index.css'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string

if (!clientId) {
  document.body.innerHTML = `
    <div style="font-family:sans-serif;padding:2rem;max-width:600px;margin:auto">
      <h2>Setup required</h2>
      <p>Please create a <code>.env.local</code> file in the project root with:<br>
      <code>VITE_GOOGLE_CLIENT_ID=your_oauth_client_id_here</code></p>
      <p>See <code>SETUP.md</code> for full instructions.</p>
    </div>
  `
} else {
  createRoot(document.getElementById('app')!).render(
    <StrictMode>
      <GoogleOAuthProvider clientId={clientId}>
        <App />
      </GoogleOAuthProvider>
    </StrictMode>,
  )
}
