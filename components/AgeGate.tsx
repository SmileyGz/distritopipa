'use client'

/**
 * Distrito Pipa — Age Gate
 * ─────────────────────────────────────────────────────────────
 * Renders a full-screen gate on first visit.
 * Consent is stored in:
 *   1. localStorage  (instant, survives refresh)
 *   2. Supabase      (anonymous analytics — no PII)
 *
 * Usage in app/layout.tsx:
 *   import AgeGate from '@/components/AgeGate'
 *   <AgeGate>{children}</AgeGate>
 *
 * Env vars needed (.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL=
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=
 * ─────────────────────────────────────────────────────────────
 */

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
)

const STORAGE_KEY = 'dp_age_verified'
const STORAGE_VERSION = 'v1' // bump to force re-check after policy changes

type VerificationState = 'pending' | 'verified' | 'denied'

interface AgeGateProps {
  children: React.ReactNode
  minimumAge?: number // default 18
}

export default function AgeGate({ children, minimumAge = 18 }: AgeGateProps) {
  const [state, setState] = useState<VerificationState>('pending')
  const [mounted, setMounted] = useState(false)
  const [shaking, setShaking] = useState(false)

  // Avoid SSR flash — only check localStorage on client
  useEffect(() => {
    setMounted(true)
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === STORAGE_VERSION) {
        setState('verified')
      }
    } catch {
      // localStorage blocked (private mode edge case) — show gate
    }
  }, [])

  const logConsent = useCallback(async (granted: boolean) => {
    try {
      await supabase.from('age_gate_logs').insert({
        granted,
        user_agent: navigator.userAgent,
        // No IP stored — Supabase captures it server-side if you enable
        // the pg_net extension, but we keep this table PII-free by design
        created_at: new Date().toISOString(),
      })
    } catch {
      // Non-blocking — analytics failure never blocks the user
    }
  }, [])

  const handleVerify = useCallback(async () => {
    try {
      localStorage.setItem(STORAGE_KEY, STORAGE_VERSION)
    } catch { /* private mode */ }
    await logConsent(true)
    setState('verified')
  }, [logConsent])

  const handleDeny = useCallback(async () => {
    await logConsent(false)
    setShaking(true)
    setTimeout(() => setShaking(false), 600)
    setState('denied')
  }, [logConsent])

  // Not mounted yet — render nothing (prevents SSR mismatch)
  if (!mounted) return null

  // Already verified — render app normally
  if (state === 'verified') return <>{children}</>

  return (
    <>
      <style>{`
        @keyframes dp-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes dp-shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-10px); }
          40%      { transform: translateX(10px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
        @keyframes dp-bolt {
          0%,100% { opacity: 0.15; }
          50%      { opacity: 0.35; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dp-card { animation: none !important; }
          .dp-bolt { animation: none !important; }
        }
      `}</style>

      {/* Full-screen overlay */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="agegate-title"
        aria-describedby="agegate-desc"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          backgroundColor: '#111111',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Decorative lightning bolts — brand signature */}
        <svg
          className="dp-bolt"
          aria-hidden="true"
          viewBox="0 0 80 160"
          style={{
            position: 'absolute',
            left: 0,
            top: '20%',
            width: 60,
            opacity: 0.2,
            animation: 'dp-bolt 3s ease-in-out infinite',
          }}
        >
          <polygon points="48,0 20,70 40,70 32,160 60,60 38,60" fill="#CC2222" />
        </svg>
        <svg
          className="dp-bolt"
          aria-hidden="true"
          viewBox="0 0 80 160"
          style={{
            position: 'absolute',
            right: 0,
            bottom: '20%',
            width: 60,
            opacity: 0.2,
            transform: 'scaleX(-1)',
            animation: 'dp-bolt 3s ease-in-out infinite 1.5s',
          }}
        >
          <polygon points="48,0 20,70 40,70 32,160 60,60 38,60" fill="#CC2222" />
        </svg>

        {/* Card */}
        <div
          className="dp-card"
          style={{
            animation: 'dp-fade-in 0.4s ease both',
            ...(shaking ? { animation: 'dp-shake 0.5s ease' } : {}),
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: 16,
            padding: '40px 32px',
            maxWidth: 380,
            width: '100%',
            textAlign: 'center',
            position: 'relative',
          }}
        >
          {/* Logo wordmark */}
          <div style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.2em',
              color: '#888',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              Distrito
            </div>
            <div style={{
              fontFamily: "'Georgia', serif",
              fontSize: 38,
              fontStyle: 'italic',
              color: '#ffffff',
              lineHeight: 1,
              letterSpacing: '-0.01em',
            }}>
              Pipa
            </div>
            <div style={{
              fontSize: 10,
              letterSpacing: '0.3em',
              color: '#555',
              textTransform: 'uppercase',
              marginTop: 4,
            }}>
              Cancún
            </div>
          </div>

          {/* Red divider */}
          <div style={{
            width: 32,
            height: 2,
            backgroundColor: '#CC2222',
            margin: '0 auto 28px',
            borderRadius: 1,
          }} />

          {state === 'denied' ? (
            /* Denied state */
            <>
              <p
                id="agegate-title"
                style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 10 }}
              >
                Acceso no disponible
              </p>
              <p
                id="agegate-desc"
                style={{ fontSize: 13, color: '#888', lineHeight: 1.6 }}
              >
                Debes tener {minimumAge} años o más para visitar esta tienda.
                Nuestros productos son exclusivamente para uso personal adulto.
              </p>
            </>
          ) : (
            /* Verification state */
            <>
              <p
                id="agegate-title"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: '#ffffff',
                  marginBottom: 8,
                  lineHeight: 1.3,
                }}
              >
                ¿Tienes {minimumAge} años o más?
              </p>
              <p
                id="agegate-desc"
                style={{
                  fontSize: 13,
                  color: '#888',
                  lineHeight: 1.6,
                  marginBottom: 32,
                }}
              >
                Todos nuestros accesorios son de uso personal y exclusivos para adultos.
              </p>

              {/* Buttons */}
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                <button
                  onClick={handleVerify}
                  style={{
                    width: '100%',
                    padding: '14px 0',
                    backgroundColor: '#CC2222',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: 'pointer',
                    letterSpacing: '0.02em',
                    transition: 'background-color 0.15s, transform 0.1s',
                  }}
                  onMouseEnter={e => {
                    ;(e.target as HTMLButtonElement).style.backgroundColor = '#e02222'
                  }}
                  onMouseLeave={e => {
                    ;(e.target as HTMLButtonElement).style.backgroundColor = '#CC2222'
                  }}
                  onMouseDown={e => {
                    ;(e.target as HTMLButtonElement).style.transform = 'scale(0.98)'
                  }}
                  onMouseUp={e => {
                    ;(e.target as HTMLButtonElement).style.transform = 'scale(1)'
                  }}
                >
                  Sí, tengo {minimumAge}+ años
                </button>

                <button
                  onClick={handleDeny}
                  style={{
                    width: '100%',
                    padding: '13px 0',
                    backgroundColor: 'transparent',
                    color: '#666',
                    border: '1px solid #2a2a2a',
                    borderRadius: 8,
                    fontSize: 14,
                    cursor: 'pointer',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={e => {
                    const t = e.target as HTMLButtonElement
                    t.style.color = '#aaa'
                    t.style.borderColor = '#444'
                  }}
                  onMouseLeave={e => {
                    const t = e.target as HTMLButtonElement
                    t.style.color = '#666'
                    t.style.borderColor = '#2a2a2a'
                  }}
                >
                  No, soy menor de edad
                </button>
              </div>

              {/* Legal footnote */}
              <p style={{
                fontSize: 10,
                color: '#444',
                marginTop: 24,
                lineHeight: 1.6,
              }}>
                Accesorios de uso personal · Producto legal · No incluye sustancias.
                Al continuar, aceptas nuestro{' '}
                <a
                  href="/aviso-de-privacidad"
                  style={{ color: '#555', textDecoration: 'underline' }}
                >
                  aviso de privacidad
                </a>.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  )
}
