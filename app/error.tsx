'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#0f0f0f',
      color: '#fff',
      fontFamily: 'var(--font-inter), sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '6rem', margin: 0, color: '#DC143C', fontFamily: 'var(--font-bebas), sans-serif', lineHeight: 1 }}>500</h1>
      <h2 style={{ fontSize: '1.5rem', marginTop: '10px', marginBottom: '30px' }}>¡Uy! Algo se rompió.</h2>
      <p style={{ color: '#aaa', marginBottom: '40px', maxWidth: '400px' }}>
        Tuvimos un problema técnico. Ya estamos limpiando el desastre.
      </p>
      <div style={{ display: 'flex', gap: '15px' }}>
        <button 
          onClick={() => reset()}
          style={{
            backgroundColor: 'transparent',
            color: '#fff',
            border: '1px solid #333',
            padding: '12px 24px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Reintentar
        </button>
        <Link href="/" style={{
          backgroundColor: '#DC143C',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '8px',
          textDecoration: 'none',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Volver al inicio
        </Link>
      </div>
    </div>
  )
}
