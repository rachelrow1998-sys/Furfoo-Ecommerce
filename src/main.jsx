import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { CartProvider } from './store/CartContext'
import { CatalogProvider } from './store/CatalogContext'
import { initSmoothScroll } from './utils/smoothScroll'
import 'lenis/dist/lenis.css'
import './styles/global.css'

// Started before the first render so every component effect can reach the
// instance through getSmoothScroll().
initSmoothScroll()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      {/* The catalogue wraps the bag: the bag trims itself against live stock. */}
      <CatalogProvider>
        <CartProvider><App /></CartProvider>
      </CatalogProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
