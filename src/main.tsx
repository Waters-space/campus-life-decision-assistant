import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import AdminApp from './admin'
import './styles.css'
import './card-fan-overrides.css'
import './ui-fixes-u02-u04.css'

const root = createRoot(document.getElementById('root')!)
root.render(<StrictMode>{window.location.pathname === '/admin' ? <AdminApp /> : <App />}</StrictMode>)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js') })
}
