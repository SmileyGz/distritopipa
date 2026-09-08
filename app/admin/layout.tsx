// app/admin/layout.tsx
// ─────────────────────────────────────────────────────────────
// Admin area layout — sidebar nav + main content.
// Protected by Next.js Middleware.
// ─────────────────────────────────────────────────────────────

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const NAV = [
  { href: '/admin/products',  label: 'Productos',   icon: '📦' },
  { href: '/admin/orders',    label: 'Pedidos',     icon: '🛒' },
  { href: '/admin/clients',   label: 'Clientes',    icon: '👑' },
  { href: '/admin/community', label: 'Comunidad',   icon: '💬' },
  { href: '/admin/analytics', label: 'Analytics',   icon: '📊' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [sideOpen, setSideOpen] = useState(false)

  // Don't wrap the login page in the admin shell
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  async function handleLogout() {
    await fetch('/api/admin/logout', { method: 'POST' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="admin-shell">
      {/* Mobile overlay */}
      {sideOpen && (
        <div className="side-overlay" onClick={() => setSideOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${sideOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sb-eyebrow">Distrito</div>
          <div className="sb-brand">Pipa</div>
          <div className="sb-tag">Admin Panel</div>
        </div>

        <div className="sb-rule" />

        <nav className="sidebar-nav">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              onClick={() => setSideOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link href="/catalogo" className="nav-item" target="_blank">
            <span className="nav-icon">🏪</span>
            <span>Ver tienda</span>
          </Link>
          <button className="nav-item logout" onClick={handleLogout}>
            <span className="nav-icon">↩</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="admin-main">
        {/* Mobile topbar */}
        <div className="topbar">
          <button className="menu-btn" onClick={() => setSideOpen(!sideOpen)}>☰</button>
          <span className="topbar-title">
            {NAV.find(n => n.href === pathname)?.label || 'Admin'}
          </span>
        </div>

        {children}
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }

        .admin-shell {
          display: flex;
          min-height: 100vh;
          background: #111;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #fff;
        }

        /* ── Sidebar ── */
        .sidebar {
          width: 220px;
          flex-shrink: 0;
          background: #0d0d0d;
          border-right: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          position: fixed;
          top: 0; left: 0; bottom: 0;
          z-index: 100;
          transform: translateX(-100%);
          transition: transform 0.25s ease;
        }

        @media (min-width: 768px) {
          .sidebar { transform: translateX(0); position: sticky; top: 0; height: 100vh; }
          .topbar  { display: none; }
          .admin-main { margin-left: 220px; }
          .side-overlay { display: none; }
        }

        .sidebar.open { transform: translateX(0); }

        .side-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.5);
          z-index: 99;
        }

        .sidebar-logo {
          padding: 28px 20px 20px;
          text-align: center;
        }

        .sb-eyebrow { font-size: 10px; letter-spacing: .2em; color: #888; text-transform: uppercase; }
        .sb-brand   { font-family: Georgia, serif; font-style: italic; font-size: 28px; color: #fff; line-height: 1; }
        .sb-tag     { font-size: 9px; letter-spacing: .15em; color: #CC2222; text-transform: uppercase; margin-top: 3px; }

        .sb-rule {
          width: 32px; height: 1px;
          background: #CC2222;
          margin: 0 auto 16px;
        }

        .sidebar-nav {
          flex: 1;
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 14px;
          color: #888;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.15s;
          background: transparent;
          border: none;
          width: 100%;
          text-align: left;
        }

        .nav-item:hover  { background: #1a1a1a; color: #fff; }
        .nav-item.active { background: rgba(204, 34, 34, 0.15); color: #fff; }
        .nav-item.active .nav-icon { filter: none; }
        .nav-item.logout:hover { color: #f87171; }

        .nav-icon { font-size: 16px; flex-shrink: 0; }

        .sidebar-footer {
          padding: 12px;
          border-top: 1px solid #1a1a1a;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* ── Main ── */
        .admin-main {
          flex: 1;
          min-width: 0;
          background: #111;
        }

        /* ── Mobile topbar ── */
        .topbar {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          background: #0d0d0d;
          border-bottom: 1px solid #1a1a1a;
          position: sticky;
          top: 0;
          z-index: 98;
        }

        .menu-btn {
          background: transparent;
          border: none;
          color: #fff;
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
        }

        .topbar-title {
          font-size: 15px;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
