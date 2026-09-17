import { Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Navbar from './components/Navbar'
import CartDrawer from './components/CartDrawer'
import Home from './pages/Home'
import Shop from './pages/Shop'
import ProductDetail from './pages/ProductDetail'
import Checkout from './pages/Checkout'
import OrderStatus from './pages/OrderStatus'
import MembersLogin from './pages/MembersLogin'
import HachiWorld from './components/hachi/HachiWorld'
import { playSiteSound, stopSiteSound, subscribeSiteSound } from './utils/siteSound'
import { scrollToTarget } from './utils/smoothScroll'

function ScrollManager() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (!hash) {
      scrollToTarget(0, { immediate: true })
      return undefined
    }

    const timer = window.setTimeout(() => {
      const target = document.querySelector(hash)
      if (target) scrollToTarget(target)
    }, 50)
    return () => window.clearTimeout(timer)
  }, [pathname, hash])
  return null
}

export default function App() {
  useEffect(() => {
    const desktopPointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const squeak = new Audio('/sounds/duck-squeak.mp3')
    const clickCooldown = 120
    let lastSqueakAt = -clickCooldown

    squeak.volume = 0.7
    squeak.preload = 'auto'

    const playSqueak = (event) => {
      if (!desktopPointer.matches || event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest?.('[data-hachi-root]')) return

      const now = performance.now()
      if (now - lastSqueakAt < clickCooldown) return
      lastSqueakAt = now

      playSiteSound(squeak)
    }

    window.addEventListener('pointerdown', playSqueak, { capture: true })
    const unsubscribeSound = subscribeSiteSound(enabled => { if (!enabled) stopSiteSound(squeak) })

    return () => {
      window.removeEventListener('pointerdown', playSqueak, { capture: true })
      unsubscribeSound()
      stopSiteSound(squeak)
    }
  }, [])

  return <><ScrollManager/><Navbar/><CartDrawer/><Routes><Route path="/" element={<Home/>}/><Route path="/shop" element={<Shop/>}/><Route path="/products/:id" element={<ProductDetail/>}/><Route path="/checkout" element={<Checkout/>}/><Route path="/order/:id" element={<OrderStatus/>}/><Route path="/members" element={<MembersLogin/>}/></Routes><HachiWorld/></>
}
