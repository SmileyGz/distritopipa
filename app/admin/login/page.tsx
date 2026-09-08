'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleLogin() {
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        router.push('/admin/products')
        router.refresh()
      } else {
        setError(true)
        setTimeout(() => setError(false), 2000)
      }
    } catch (err) {
      setError(true)
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-eyebrow">Distrito</div>
          <div className="login-brand">Pipa</div>
          <div className="login-tag">Admin</div>
        </div>
        <div className="login-rule" />
        <input
          className={`login-input ${error ? 'shake' : ''}`}
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          autoFocus
        />
        {error && <p className="login-error">Contraseña incorrecta</p>}
        <button className="login-btn" onClick={handleLogin}>
          Entrar →
        </button>
      </div>

      <style>{`
        .login-screen {
          min-height: 100vh;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .login-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 16px;
          padding: 40px 32px;
          max-width: 320px;
          width: 100%;
          text-align: center;
          font-family: -apple-system, sans-serif;
        }
        .login-logo { margin-bottom: 24px; }
        .login-eyebrow { font-size: 11px; letter-spacing: .2em; color: #888; text-transform: uppercase; }
        .login-brand { font-family: Georgia, serif; font-style: italic; font-size: 36px; color: #fff; }
        .login-tag { font-size: 10px; letter-spacing: .2em; color: #CC2222; text-transform: uppercase; margin-top: 2px; }
        .login-rule { width: 32px; height: 2px; background: #CC2222; margin: 0 auto 24px; border-radius: 1px; }
        .login-input {
          width: 100%; padding: 12px; background: #111; border: 1px solid #2a2a2a;
          border-radius: 8px; color: #fff; font-size: 14px; margin-bottom: 8px;
          text-align: center; letter-spacing: .2em;
        }
        .login-input:focus { outline: none; border-color: #CC2222; }
        .login-input.shake { animation: shake .4s ease; border-color: #f87171; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-8px)} 75%{transform:translateX(8px)} }
        .login-error { font-size: 12px; color: #f87171; margin-bottom: 12px; }
        .login-btn {
          width: 100%; padding: 12px; background: #CC2222; color: #fff;
          border: none; border-radius: 8px; font-size: 14px; font-weight: 600;
          cursor: pointer; margin-top: 4px;
        }
        .login-btn:hover { background: #e02222; }
      `}</style>
    </div>
  )
}
