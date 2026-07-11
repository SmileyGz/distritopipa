import Link from 'next/link'

export default function NotFound() {
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
      <h1 style={{ fontSize: '6rem', margin: 0, color: '#DC143C', fontFamily: 'var(--font-bebas), sans-serif', lineHeight: 1 }}>404</h1>
      <h2 style={{ fontSize: '1.5rem', marginTop: '10px', marginBottom: '30px' }}>Mala hierba... ruta no encontrada.</h2>
      <p style={{ color: '#aaa', marginBottom: '40px', maxWidth: '400px' }}>
        Parece que te perdiste en el humo. La página que buscas no existe o fue movida.
      </p>
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
  )
}
