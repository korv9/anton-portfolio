import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles.css'
import './pages.css'
import './products/products.css'
import './design-system.css'
import './tokens.css'

// Cloudflare Web Analytics: cookieless page views, on only when the build sets the site token
// (VITE_CF_BEACON_TOKEN, a Workers Builds variable; see docs/deploy.md).
const beaconToken = import.meta.env.VITE_CF_BEACON_TOKEN
if (beaconToken) {
  const beacon = document.createElement('script')
  beacon.defer = true
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js'
  beacon.dataset.cfBeacon = JSON.stringify({ token: beaconToken })
  document.head.append(beacon)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
