'use client'

import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import posthog from 'posthog-js'

function SuccessContent() {
  const searchParams = useSearchParams()
  const payment_id = searchParams.get('payment_id')
  const status = searchParams.get('status')
  const external_reference = searchParams.get('external_reference')
  const type = searchParams.get('type')
  const orderNumberParam = searchParams.get('order_number')
  const emailParam = searchParams.get('email')
  const totalParam = searchParams.get('total')
  
  const clearCart = useStore(state => state.clearCart)
  const [mounted, setMounted] = useState(false)
  const [orderData, setOrderData] = useState<any>(null)
  const [copiedClabe, setCopiedClabe] = useState(false)

  const isSpei = type === 'spei'

  useEffect(() => {
    setMounted(true)
    clearCart()
    
    try {
      if (isSpei) {
        const storedSpei = localStorage.getItem('dp_spei_order')
        if (storedSpei) {
          setOrderData(JSON.parse(storedSpei))
        }
      } else {
        const stored = localStorage.getItem('dp_pending_order')
        if (stored) {
          const orderInfo = JSON.parse(stored)
          setOrderData(orderInfo)
          localStorage.removeItem('dp_pending_order')

          if (status === 'approved') {
            const finalOrderId = external_reference || orderInfo.order_id
            if (finalOrderId) {
              fetch('/api/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  order_id: finalOrderId,
                  payment_reference: payment_id || 'mercadopago_redirect',
                  gateway: 'mercadopago'
                })
              }).catch(console.error)

              // PostHog Tracking
              posthog.capture('purchase', {
                order_id: finalOrderId,
                value: orderInfo.paymentPref === 'total' ? orderInfo.finalTotal : 50,
                currency: 'MXN',
                payment_type: orderInfo.paymentPref,
                fulfillment: orderInfo.fulfillment
              })
            }
          }
        }
      }
    } catch (e) {}
  }, [clearCart, isSpei, status, external_reference, payment_id])

  const handleCopyClabe = () => {
    navigator.clipboard.writeText('167691000009770036')
    setCopiedClabe(true)
    setTimeout(() => setCopiedClabe(false), 3000)
  }

  const handleWhatsApp = () => {
    if (!orderData) {
      // Fallback if local storage was cleared before redirect
      const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529987393474'}?text=${encodeURIComponent('Hola Distrito Pipa, he completado mi pago de anticipo (ID: ' + payment_id + '). Te envío mi ubicación.')}`
      window.open(whatsappUrl, '_blank')
      return
    }
    
    const isPickup = orderData.fulfillment === 'pickup'
    const isTotal = orderData.paymentPref === 'total'
    const balanceDue = isTotal ? 0 : orderData.finalTotal - 50 // They paid $50 anticipo or total
    
    let msg = `Hola Distrito Pipa, he completado mi pedido por ${isPickup ? 'Pick-up' : 'Envío a Domicilio'}:\n\n`
    if (orderData.items) {
      orderData.items.forEach((item: any) => {
        msg += `📦 ${item.quantity}x ${item.product.name_es.split('|')[0].trim()} ($${item.quantity * item.product.price_mxn})\n`
      })
    }
    msg += `\nCliente: ${orderData.customerName} (${orderData.customerPhone})`
    if (!isPickup) {
      msg += `\nDirección: ${orderData.address}`
      msg += `\nZona: ${orderData.zone === 'zone1' ? '1 a 6 km' : '6 a 10 km'}`
      msg += `\nHorario: ${orderData.timeOfDay === 'day' ? 'Día' : 'Noche'}`
    }
    msg += `\n\n✅ *${isTotal ? 'Total' : 'Anticipo de $50 MXN'} pagado por MercadoPago* (ID: ${payment_id || 'N/A'})`
    
    if (balanceDue > 0) {
      msg += `\n💸 *Resto a pagar en efectivo al recibir: $${balanceDue.toLocaleString('es-MX')} MXN*\n\n`
    } else {
      msg += `\n💸 *Pedido liquidado al 100%*\n\n`
    }
    
    msg += isPickup ? `Pasaré a recogerlo pronto.` : `Te comparto mi ubicación exacta para el envío.`
    
    const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529987393474'}?text=${encodeURIComponent(msg)}`
    window.open(whatsappUrl, '_blank')
  }

  if (!mounted) return null

  // Dedicated SPEI Pre-reservation Screen (No WhatsApp redirect/button)
  if (isSpei) {
    const customerEmail = emailParam || orderData?.customerEmail || ''
    const orderNumber = orderNumberParam || orderData?.order_number || 'En proceso'
    const totalAmount = Number(totalParam) || orderData?.finalTotal || 0
    const balanceDue = totalAmount > 50 ? totalAmount - 50 : 0

    return (
      <main className="success-page">
        <div className="success-card fade-in">
          <div className="success-icon">📩</div>
          <h2>¡Pre-reservación Registrada!</h2>
          <p className="success-text">
            Te hemos enviado los datos completos para tu transferencia a: <br />
            <strong style={{ color: '#fff', fontSize: '15px' }}>{customerEmail}</strong>
          </p>

          <div className="bank-details-card">
            <div className="bdc-header">
              <span>🏦 DATOS PARA TRANSFERENCIA SPEI</span>
            </div>
            <div className="bdc-row">
              <span className="bdc-label">Banco:</span>
              <span className="bdc-value">Hey Banco</span>
            </div>
            <div className="bdc-row">
              <span className="bdc-label">CLABE:</span>
              <div className="clabe-copy-wrap">
                <span className="bdc-clabe">167691000009770036</span>
                <button type="button" onClick={handleCopyClabe} className="btn-copy">
                  {copiedClabe ? '✅ Copiada' : 'Copiar'}
                </button>
              </div>
            </div>
            <div className="bdc-row">
              <span className="bdc-label">A nombre de:</span>
              <span className="bdc-value">José Luis</span>
            </div>
            <div className="bdc-row">
              <span className="bdc-label">Concepto / Ref:</span>
              <span className="bdc-value highlight-ref">{orderNumber}</span>
            </div>
            <div className="bdc-divider"></div>
            <div className="bdc-row">
              <span className="bdc-label">Anticipo a transferir:</span>
              <span className="bdc-value highlight-green">$50 MXN</span>
            </div>
            {balanceDue > 0 && (
              <div className="bdc-row">
                <span className="bdc-label">Resto al recibir (efectivo):</span>
                <span className="bdc-value">${balanceDue.toLocaleString('es-MX')} MXN</span>
              </div>
            )}
          </div>

          <div className="next-steps spei-steps">
            <p>
              Revisa tu bandeja de entrada (o spam) para ver el comprobante. En cuanto realices tu transferencia de $50, apartaremos tus artículos para entrega.
            </p>
          </div>

          <div className="action-buttons">
            <Link href="/catalogo" className="btn-catalog">
              Volver al Catálogo
            </Link>
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
            max-width: 520px;
            width: 100%;
            text-align: center;
          }
          .success-icon {
            font-size: 60px;
            margin-bottom: 16px;
          }
          .success-card h2 {
            font-family: var(--font-bebas), sans-serif;
            font-size: 34px;
            letter-spacing: 0.05em;
            margin: 0 0 12px 0;
            color: #27ae60;
          }
          .success-text {
            color: #aaa;
            font-size: 14px;
            line-height: 1.5;
            margin-bottom: 24px;
          }
          .bank-details-card {
            background: #141414;
            border: 1px solid #282828;
            border-radius: 8px;
            padding: 20px;
            text-align: left;
            margin-bottom: 20px;
          }
          .bdc-header {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.08em;
            color: #27ae60;
            margin-bottom: 14px;
            border-bottom: 1px solid #222;
            padding-bottom: 8px;
          }
          .bdc-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 13px;
            margin-bottom: 10px;
            color: #ccc;
          }
          .bdc-label {
            color: #888;
          }
          .bdc-value {
            font-weight: 600;
            color: #fff;
          }
          .highlight-ref {
            color: #DC143C;
            font-family: monospace;
            font-size: 14px;
          }
          .highlight-green {
            color: #2ecc71;
            font-size: 15px;
            font-weight: bold;
          }
          .clabe-copy-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .bdc-clabe {
            font-family: monospace;
            font-size: 13px;
            background: #000;
            padding: 4px 8px;
            border-radius: 4px;
            border: 1px solid #333;
            color: #fff;
          }
          .btn-copy {
            background: #252525;
            border: 1px solid #444;
            color: #fff;
            padding: 4px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
          }
          .btn-copy:hover {
            background: #333;
            border-color: #27ae60;
          }
          .bdc-divider {
            border-top: 1px dashed #2a2a2a;
            margin: 12px 0;
          }
          .spei-steps {
            background: rgba(39, 174, 96, 0.08);
            border: 1px solid rgba(39, 174, 96, 0.2);
            border-radius: 8px;
            padding: 14px;
            margin-bottom: 24px;
          }
          .spei-steps p {
            margin: 0;
            font-size: 12px;
            color: #aaa;
            line-height: 1.5;
          }
          .btn-catalog {
            background: #27ae60;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            padding: 14px 24px;
            font-size: 15px;
            font-weight: 600;
            display: block;
            width: 100%;
            transition: background 0.2s;
          }
          .btn-catalog:hover {
            background: #219653;
          }
          .fade-in { animation: fadeIn 0.4s ease; }
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </main>
    )
  }

  return (
    <main className="success-page">
      <div className="success-card fade-in">
        <div className="success-icon">✅</div>
        <h2>{orderData?.paymentPref === 'total' ? '¡Pago Confirmado!' : '¡Anticipo Confirmado!'}</h2>
        <p className="success-text">
          Tu pago de <strong>${orderData?.paymentPref === 'total' ? (orderData?.finalTotal || 0).toLocaleString('es-MX') : '50'} MXN</strong> ha sido procesado por MercadoPago con éxito.
        </p>
        
        <div className="next-steps">
          <h3>Siguiente paso obligatorio:</h3>
          <p>
            {orderData?.fulfillment === 'pickup' 
              ? 'Para poder confirmar tu horario de recolección, envíanos un mensaje por WhatsApp dándole clic al botón de abajo.' 
              : 'Para que podamos despachar tu pedido, envíanos tu ubicación exacta (Pin) por WhatsApp dándole clic al botón de abajo.'}
          </p>
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
          font-size: 15px;
          color: #aaa;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .next-steps {
          background: #222;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 20px;
          text-align: left;
          margin-bottom: 30px;
        }
        .next-steps h3 {
          color: #fff;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin: 0 0 8px 0;
        }
        .next-steps p {
          color: #888;
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
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

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <main className="success-page" style={{ minHeight: '100vh', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Cargando confirmación...</p>
      </main>
    }>
      <SuccessContent />
    </Suspense>
  )
}
