import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Comunidad · Distrito Pipa',
  description: 'Preguntas frecuentes y comunidad Distrito Pipa Cancún',
}

export default function ComunidadPage() {
  return (
    <main style={{maxWidth:600,margin:'0 auto',padding:'40px 20px',background:'#111',minHeight:'100vh',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      <div style={{marginBottom:32}}>
        <p style={{fontSize:11,letterSpacing:'.15em',color:'#888',textTransform:'uppercase',marginBottom:6}}>Distrito Pipa</p>
        <h1 style={{fontSize:26,fontWeight:600,marginBottom:8}}>Comunidad</h1>
        <p style={{color:'#888',fontSize:14,lineHeight:1.6}}>Preguntas frecuentes y conversaciones sobre nuestros accesorios.</p>
      </div>
      <div style={{background:'#1a1a1a',border:'0.5px solid #2a2a2a',borderRadius:10,padding:'20px',textAlign:'center',color:'#888',fontSize:14}}>
        Comunidad próximamente — por ahora escríbenos por WhatsApp o inbox.
      </div>
    </main>
  )
}
