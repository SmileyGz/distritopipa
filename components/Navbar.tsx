'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useStore } from '@/lib/store'

export default function Navbar() {
  const [navScrolled, setNavScrolled] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  // getCartCount needs to be called inside component, but we select the count for reactivity
  const cartCount = useStore((state) => state.getCartCount())

  useEffect(() => {
    setMounted(true)
    const onScroll = () => setNavScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <nav className={`dp-nav ${navScrolled ? 'scrolled' : ''}`}>
        <Link href="/" className="nav-logo" style={{ textDecoration: 'none' }}>
          <span className="nav-eyebrow">DISTRITO</span>
          <span className="nav-brand">Pipa</span>
          <span className="nav-city">Cancún</span>
        </Link>
        <div className="nav-links">
          <Link href="/blog" className="nav-link">Blog</Link>
          <Link href="/comunidad" className="nav-link">Comunidad</Link>
          <Link href="/catalogo" className="nav-cta">Catálogo</Link>
        </div>
      </nav>
      
      {/* FLOATING CART (FAB) */}
      <Link href="/checkout" className="floating-cart" style={{ textDecoration: 'none' }}>
        <span style={{ fontSize: '28px' }}>🛒</span>
        {mounted && cartCount > 0 && (
          <span className="cart-badge">
            {cartCount}
          </span>
        )}
      </Link>
    </>
  )
}
