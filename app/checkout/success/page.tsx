'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams()
  const payment_id = searchParams.get('payment_id')
  const status = searchParams.get('status')
  
  const clearCart = useStore(state => state.clearCart)
  const [mounted, setMounted] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)

  useEffect(() => {
    setMounted(true)
    clearCart()
    
    try {
      const stored = localStorage.getItem('dp_pending_order')
      if (stored) {
        setOrderData(JSON.parse(stored))
        localStorage.removeItem('dp_pending_order')
      }
    } catch (e) {}
  }, [clearCart])

  const handleWhatsApp = () => {
    if (!orderData) {
      // Fallback if local storage was cleared before redirect
      const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529987393474'}?text=${encodeURIComponent('Hola Distrito Pipa, he completado mi pago de anticipo (ID: ' + payment_id + '). Te envío mi ubicación.')}`
      window.open(whatsappUrl, '_blank')
      return
    }
    
    const balanceDue = orderData.finalTotal - 50 // They paid $50 anticipo
    
    let msg = `Hola Distrito Pipa, he completado mi pedido por Envío a Domicilio:\n\n`
    orderData.items.forEach((item: any) => {
      msg += `📦 ${item.quantity}x ${item.product.name_es.split('|')[0].trim()} ($${item.quantity * item.product.price_mxn})\n`
    })
    msg += `\nCliente: ${orderData.customerName} (${orderData.customerPhone})`
    msg += `\nDirección: ${orderData.address}`
    msg += `\nZona: ${orderData.zone === 'zone1' ? '1 a 6 km' : '6 a 10 km'}`
    msg += `\nHorario: ${orderData.timeOfDay === 'day' ? 'Día' : 'Noche'}`
    msg += `\n\n✅ *Anticipo de $50 MXN pagado por MercadoPago* (ID: ${payment_id || 'N/A'})`
    msg += `\n💸 *Resto a pagar en efectivo al recibir: $${balanceDue.toLocaleString('es-MX')} MXN*\n\n`
    msg += `Te comparto mi ubicación exacta para el envío.`
    
    const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529987393474'}?text=${encodeURIComponent(msg)}`
    window.open(whatsappUrl, '_blank')
  }

  if (!mounted) return null

  return (
    <main className="success-page">
      <div className="success-card fade-in">
        <div className="success-icon">✅</div>
        <h2>¡Anticipo Confirmado!</h2>
        <p className="success-text">
          Tu pago de <strong>$50 MXN</strong> ha sido procesado por MercadoPago con éxito.
        </p>
        
        <div className="next-steps">
          <h3>Siguiente paso obligatorio:</h3>
          <p>Para que podamos despachar tu pedido, envíanos tu ubicación exacta (Pin) por WhatsApp.</p>
        </div>

        <div className="action-buttons">
          <button onClick={handleWhatsApp} className="btn-whatsapp">
            <span className="w-icon">💬</span>
            Enviar Confirmación por WhatsApp
          </button>
        </div>
      </div>

      <style>{`
        .success-page {
          min-height: 100vh;
          background: #111;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          color: #fff;
        }
        .success-card {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 40px;
          max-width: 500px;
          width: 100%;
          text-align: center;
        }
        .success-icon {
          font-size: 64px;
          margin-bottom: 16px;
        }
        .success-card h2 {
          font-family: var(--font-bebas), sans-serif;
          font-size: 36px;
          letter-spacing: 0.05em;
          margin: 0 0 12px 0;
          color: #27ae60;
        }
        .success-text {
          font-size: 16px;
          color: #aaa;
          margin-bottom: 32px;
        }
        .next-steps {
          background: #222;
          padding: 24px;
          border-radius: 8px;
          border-left: 4px solid #DC143C;
          margin-bottom: 32px;
          text-align: left;
        }
        .next-steps h3 {
          margin: 0 0 8px 0;
          font-size: 16px;
          color: #fff;
        }
        .next-steps p {
          margin: 0;
          font-size: 14px;
          color: #888;
          line-height: 1.5;
        }
        .btn-whatsapp {
          background: #25D366;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 16px 24px;
          font-family: var(--font-inter), sans-serif;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: background 0.2s;
        }
        .btn-whatsapp:hover {
          background: #1DA851;
        }
        .w-icon {
          font-size: 20px;
        }
        .fade-in { animation: fadeIn 0.4s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </main>
  )
}
