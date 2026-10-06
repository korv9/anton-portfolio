import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles.css'
import './pages.css'
import './products/products.css'
import './design-system.css'
import './tokens.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
