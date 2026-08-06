'use client'
import { useState, useMemo, useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import toast from 'react-hot-toast'
import { useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

const getDiscountedPriceForItem = (item: any, allItems: any[]) => {
  if (!item.product.bundle_pricing?.length) return undefined;
  
  // Group all items of the same product to check total quantity
  const groupItems = allItems.filter((x: any) => x.product.id === item.product.id);
  const groupQty = groupItems.reduce((sum, x) => sum + x.quantity, 0);
  
  if (groupQty <= 1) return undefined;
  
  let remainingQty = groupQty;
  let bestPriceTotal = 0;
  const tiers = [...item.product.bundle_pricing].sort((a: any, b: any) => b.qty - a.qty);
  
  for (const tier of tiers) {
    if (remainingQty >= tier.qty) {
      const bundles = Math.floor(remainingQty / tier.qty);
      bestPriceTotal += bundles * tier.price;
      remainingQty %= tier.qty;
    }
  }
  bestPriceTotal += remainingQty * item.product.price_mxn;
  const baseGroupTotal = groupQty * item.product.price_mxn;
  
  if (bestPriceTotal >= baseGroupTotal) return undefined;
  
  // Prorate this specific item's share of the discounted total
  const proportion = item.quantity / groupQty;
  return bestPriceTotal * proportion;
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const items = useStore(state => state.items)
  const clearCart = useStore(state => state.clearCart)
  const removeFromCart = useStore(state => state.removeFromCart)
  const getCartSubtotal = useStore(state => state.getCartSubtotal)
  const getCartDiscount = useStore(state => state.getCartDiscount)
  const getCartTotal = useStore(state => state.getCartTotal)
  
  const [mounted, setMounted] = useState(false)
  const [paymentFailedNotice, setPaymentFailedNotice] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [processingMode, setProcessingMode] = useState<'mercadopago' | 'spei' | 'pickup'>('mercadopago')
  useEffect(() => setMounted(true), [])

  const [step, setStep] = useState(1)
  
  // Step 1: Method
  const [fulfillment, setFulfillment] = useState<'pickup'|'delivery'|null>(null)
  const [zone, setZone] = useState<'zone1'|'zone2'|null>(null) // zone1 = 1-6km, zone2 = 6-10km
  
  // Step 2: Details
  const [timeOfDay, setTimeOfDay] = useState<'day'|'night'>('day')
  
  // Customer info
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('') 
  const [customerEmail, setCustomerEmail] = useState('')
  const [pickupTime, setPickupTime] = useState('')
  const [addressStreet, setAddressStreet] = useState('')
  const [addressColonia, setAddressColonia] = useState('')
  const [addressRef, setAddressRef] = useState('')
  const address = `${addressStreet.trim()}, ${addressColonia.trim()}${addressRef.trim() ? `. Ref: ${addressRef.trim()}` : ''}`
  
  // Step 3: Payment
  const [paymentPref, setPaymentPref] = useState<'anticipo' | 'total' | 'spei'>('anticipo')

  // Math
  const subtotal = getCartSubtotal()
  const discount = getCartDiscount()
  
  const deliveryFee = useMemo(() => {
    if (fulfillment !== 'delivery' || !zone) return 0;
    if (zone === 'zone1') return timeOfDay === 'night' ? 80 : 50;
    if (zone === 'zone2') return timeOfDay === 'night' ? 100 : 80;
    return 0;
  }, [fulfillment, zone, timeOfDay])

  const finalTotal = getCartTotal() + deliveryFee;

  const isDelivery = fulfillment === 'delivery';
  const amountToPayNow = isDelivery 
    ? (paymentPref === 'total' ? finalTotal : 50)
    : (paymentPref === 'total' ? finalTotal : 0);
  const balanceDue = finalTotal - amountToPayNow;

  const handleNext = () => {
    setStep(s => Math.min(s + 1, 3))
  }
  
  const handleBack = () => setStep(s => Math.max(s - 1, 1))

  // Handle return from MercadoPago
  useEffect(() => {
    if (!mounted) return

    const status = searchParams.get('status') || searchParams.get('collection_status')
    const paymentId = searchParams.get('payment_id') || searchParams.get('collection_id')
    const hasMpParams = searchParams.has('preference_id') || searchParams.has('payment_id') || searchParams.has('status') || searchParams.has('collection_status')

    // If approved, redirect immediately to success page
    if (status === 'approved') {
      router.replace(`/checkout/success?${searchParams.toString()}`)
      return
    }

    // If returned with null/failed/cancelled status from MercadoPago
    if (hasMpParams && (paymentId === 'null' || status === 'null' || status === 'rejected' || status === 'cancelled' || !status)) {
      try {
        const stored = localStorage.getItem('dp_pending_order')
        if (stored) {
          const data = JSON.parse(stored)
          if (data.customerName) setCustomerName(data.customerName)
          if (data.customerPhone) setCustomerPhone(data.customerPhone)
          if (data.customerEmail) setCustomerEmail(data.customerEmail)
          if (data.fulfillment) setFulfillment(data.fulfillment)
          if (data.zone) setZone(data.zone)
          if (data.timeOfDay) setTimeOfDay(data.timeOfDay)
          if (data.paymentPref) setPaymentPref(data.paymentPref)
          if (data.pickupTime) setPickupTime(data.pickupTime)
          if (data.addressStreet) setAddressStreet(data.addressStreet)
          if (data.addressColonia) setAddressColonia(data.addressColonia)
          if (data.addressRef) setAddressRef(data.addressRef)
          
          setStep(3)
          setPaymentFailedNotice(true)
          toast.error('El pago en MercadoPago no se completó. No se realizó ningún cargo.', { duration: 6000 })
          
          try {
            posthog.capture('payment_return_failed_or_cancelled', {
              status,
              payment_id: paymentId,
              order_id: data.order_id
            })
          } catch (phErr) {}
        }
      } catch (e) {
        console.error('Error recovering pending order:', e)
      }

      // Clean up URL parameters in browser history
      try {
        window.history.replaceState({}, '', '/checkout')
      } catch (e) {}
    }
  }, [mounted, searchParams, router])

  const handleConfirmOrder = async () => {
    if (items.length === 0) {
      toast.error('Tu carrito está vacío')
      return;
    }

    const mode = paymentPref === 'spei' ? 'spei' : (fulfillment === 'pickup' && paymentPref === 'anticipo') ? 'pickup' : 'mercadopago'
    setProcessingMode(mode)
    setIsProcessingPayment(true)
    
    try {
      if (fulfillment === 'pickup' && paymentPref === 'anticipo') {
        // Pickup cash doesn't use MercadoPago, goes straight to WhatsApp
        let msg = `Hola! Quiero agendar una visita (Pickup) para recoger:\n\n`
        items.forEach(item => {
          msg += `📦 ${item.quantity}x ${item.product.name_es.split('|')[0].trim()} ($${item.quantity * item.product.price_mxn})\n`
        })
        msg += `\nCliente: ${customerName} (${customerPhone})`
        msg += `\nHorario agendado: ${pickupTime}`
        msg += `\nTotal a pagar en efectivo: $${finalTotal.toLocaleString('es-MX')} MXN\n\n`
        msg += `Por favor, envíame la ubicación exacta.`
        
        const whatsappUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529987393474'}?text=${encodeURIComponent(msg)}`
        
        clearCart()
        
        // Fire and forget db save
        fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ product_id: i.product.id, name: i.product.name_es, qty: i.quantity, unit_price: i.product.price_mxn, color: i.color, size: i.size, bundle_price: getDiscountedPriceForItem(i, items) })),
            delivery_zone: 'pickup',
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            delivery_address: 'Pickup Local',
            is_night: false,
            payment_preference: 'anticipo'
          })
        }).catch(console.error)

        // Directly redirect to prevent popup blockers
        window.location.href = whatsappUrl
      } else if (paymentPref === 'spei') {
        // SPEI Pre-reservation flow: Save order, send pre-reservation email, redirect to confirmation page (NO WhatsApp)
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ product_id: i.product.id, name: i.product.name_es, qty: i.quantity, unit_price: i.product.price_mxn, color: i.color, size: i.size, bundle_price: getDiscountedPriceForItem(i, items) })),
            delivery_zone: fulfillment === 'pickup' ? 'pickup' : zone,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            delivery_address: fulfillment === 'pickup' ? 'Pickup Local' : address,
            is_night: timeOfDay === 'night',
            payment_preference: 'spei'
          })
        })

        const data = await res.json()

        if (data.success) {
          localStorage.setItem('dp_spei_order', JSON.stringify({
            order_id: data.order_id,
            order_number: data.order_number,
            items,
            customerName,
            customerPhone,
            customerEmail,
            address,
            zone,
            timeOfDay,
            finalTotal,
            fulfillment
          }))
          clearCart()
          router.push(`/checkout/success?type=spei&order_number=${encodeURIComponent(data.order_number || '')}&email=${encodeURIComponent(customerEmail)}&total=${finalTotal}`)
        } else {
          setIsProcessingPayment(false)
          toast.error(data.error || 'Error al generar pre-reservación')
        }
      } else {
        // Any MP flow (Delivery Anticipo, Delivery Total, Pickup Total)
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map(i => ({ product_id: i.product.id, name: i.product.name_es, qty: i.quantity, unit_price: i.product.price_mxn, color: i.color, size: i.size, bundle_price: getDiscountedPriceForItem(i, items) })),
            delivery_zone: fulfillment === 'pickup' ? 'pickup' : zone,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail,
            delivery_address: fulfillment === 'pickup' ? 'Pickup Local' : address,
            is_night: timeOfDay === 'night',
            payment_preference: paymentPref
          })
        })
        
        const data = await res.json()
        
        if (data.init_point) {
          // Store full order details in localStorage for state recovery and success page
          localStorage.setItem('dp_pending_order', JSON.stringify({
            order_id: data.order_id,
            items,
            customerName,
            customerPhone,
            customerEmail,
            address,
            addressStreet,
            addressColonia,
            addressRef,
            zone,
            timeOfDay,
            finalTotal,
            paymentPref,
            fulfillment,
            pickupTime
          }))
          
          window.location.href = data.init_point
        } else {
          setIsProcessingPayment(false)
          toast.error(data.sb_error ? `Error DB: ${data.sb_error}` : data.mp_error ? `Error MercadoPago: ${data.mp_error}` : data.error || 'Hubo un error al generar el pago. Intenta de nuevo.')
          console.error(data)
        }
      }
    } catch (e) {
      setIsProcessingPayment(false)
      toast.error('Error de conexión al procesar la orden')
      console.error('Failed to save order to db', e)
    }
  }

  if (!mounted) return null;

  if (items.length === 0) {
    return (
      <main className="checkout-empty">
        <h2>Tu carrito está vacío</h2>
        <Link href="/catalogo" className="btn-primary">Ir al Catálogo</Link>
        <style>{`.checkout-empty { min-height: 100vh; background: #111; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 20px; color: #fff; } .btn-primary { background: #DC143C; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; }`}</style>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      {/* PROCESSING INTERMEDIATE STATE MODAL */}
      {isProcessingPayment && (
        <div className="payment-processing-overlay fade-in">
          <div className="ppo-card">
            <div className="ppo-spinner-wrap">
              <div className="ppo-spinner"></div>
              <span className="ppo-lock-icon">🔒</span>
            </div>
            <h3 className="ppo-title">
              {processingMode === 'spei'
                ? 'Registrando Pre-reservación...'
                : processingMode === 'pickup'
                  ? 'Preparando tu pedido...'
                  : 'Conectando con la Pasarela de Pago...'}
            </h3>
            <p className="ppo-subtitle">
              {processingMode === 'spei'
                ? 'Guardando tu orden y generando los datos de transferencia para tu correo.'
                : processingMode === 'pickup'
                  ? 'Transfiriendo a WhatsApp para enviarte la ubicación exacta.'
                  : 'Por favor no recargues ni cierres esta ventana. Te estamos transfiriendo de forma 100% segura.'}
            </p>
            <div className="ppo-badges">
              <span className="ppo-badge">🛡️ Conexión Encriptada SSL</span>
              <span className="ppo-badge">⚡ Redirección en curso</span>
            </div>
          </div>
        </div>
      )}

      <div className="checkout-container">
        <div className="checkout-layout">
          
          {/* LEFT: SLEEK WIZARD */}
          <div className="checkout-wizard">
            <div className="wizard-header">
              <Link href="/catalogo" className="back-link">← Volver al catálogo</Link>
              <h2>{step === 1 ? '1. ¿Cómo te llega?' : step === 2 ? '2. Detalles de Entrega' : '3. Pago Seguro'}</h2>
            </div>
            
            <div className="wizard-content">
              {/* STEP 1 */}
              {step === 1 && (
                <div className="step-body fade-in">
                  <div className="option-group">
                    <button 
                      className={`method-btn ${fulfillment === 'delivery' ? 'active' : ''}`}
                      onClick={() => { setFulfillment('delivery'); setZone('zone1'); }}
                    >
                      <span className="icon">🛵</span>
                      <div className="text-left">
                        <strong>Envío a Domicilio</strong>
                        <p>Recíbelo en la puerta de tu casa en Cancún.</p>
                      </div>
                    </button>
                    <button 
                      className={`method-btn ${fulfillment === 'pickup' ? 'active' : ''}`}
                      onClick={() => setFulfillment('pickup')}
                    >
                      <span className="icon">📍</span>
                      <div className="text-left">
                        <strong>Recoger en persona (Efectivo)</strong>
                        <p>Región 96 (Cerca de Coppel Nichupté).</p>
                      </div>
                    </button>
                  </div>

                  {fulfillment === 'delivery' && (
                    <div className="zone-selector fade-in">
                      <label className="section-label">¿En qué zona estás?</label>
                      <div className="option-group grid-2">
                        <button className={`zone-btn ${zone === 'zone1' ? 'active' : ''}`} onClick={() => setZone('zone1')}>
                          <strong>1 a 6 km</strong>
                          <p>Desde $50 (Zona Urbana)</p>
                        </button>
                        <button className={`zone-btn ${zone === 'zone2' ? 'active' : ''}`} onClick={() => setZone('zone2')}>
                          <strong>6 a 10 km</strong>
                          <p>Desde $80 (Zona Extendida)</p>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="delivery-highlights-banner">
                    <div className="dh-pill"><span>⚡</span> Mismo día (30-90 min)</div>
                    <div className="dh-pill"><span>📦</span> Empaque 100% discreto</div>
                  </div>
                  
                  <div className="wizard-actions">
                    <button className="btn-primary" disabled={!fulfillment || (fulfillment === 'delivery' && !zone)} onClick={handleNext}>Continuar</button>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && fulfillment === 'delivery' && (
                <div className="step-body fade-in">
                  <div className="form-group grid-2" style={{ gap: '12px' }}>
                    <div>
                      <label className="section-label">Tu Nombre</label>
                      <input 
                        className="sleek-input" 
                        type="text" 
                        placeholder="Ej. Juan Pérez" 
                        value={customerName} onChange={e => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="section-label">WhatsApp</label>
                      <input 
                        className="sleek-input" 
                        type="tel" 
                        placeholder="10 dígitos" 
                        value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="section-label">Correo Electrónico</label>
                    <input 
                      className="sleek-input" 
                      type="email" 
                      placeholder="Para enviarte confirmaciones" 
                      value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="section-label">Horario de Entrega</label>
                    <select className="sleek-input" value={timeOfDay} onChange={e => setTimeOfDay(e.target.value as any)}>
                      <option value="day">Día (Tarifa normal)</option>
                      <option value="night">Noche (Después de las 8pm)</option>
                    </select>
                  </div>
                  <div className="form-group grid-2" style={{ gap: '12px', marginTop: '4px' }}>
                    <div>
                      <label className="section-label">Calle y Número / Mz Lote</label>
                      <input 
                        className="sleek-input" 
                        type="text" 
                        placeholder="Ej. Calle Cedro Mz 2 Lote 3" 
                        value={addressStreet} onChange={e => setAddressStreet(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="section-label">Colonia / Región</label>
                      <input 
                        className="sleek-input" 
                        type="text" 
                        placeholder="Ej. Región 96" 
                        value={addressColonia} onChange={e => setAddressColonia(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="section-label">Referencias y Cruzamientos (Opcional)</label>
                    <input 
                      className="sleek-input" 
                      type="text"
                      placeholder="Ej. Casa verde 2 pisos, portón negro. Frente al parque." 
                      value={addressRef} onChange={e => setAddressRef(e.target.value)}
                    />
                  </div>
                  <div className="wizard-actions">
                    <button className="btn-ghost" onClick={handleBack}>Regresar</button>
                    <button 
                      className="btn-primary" 
                      disabled={!addressStreet.trim() || !addressColonia.trim() || !customerName.trim() || customerPhone.length < 10 || !customerEmail.includes('@')} 
                      onClick={handleNext}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {step === 2 && fulfillment === 'pickup' && (
                <div className="step-body fade-in">
                  <div className="form-group grid-2" style={{ gap: '12px', marginBottom: '16px' }}>
                    <div>
                      <label className="section-label">Tu Nombre</label>
                      <input 
                        className="sleek-input" 
                        type="text" 
                        placeholder="Ej. Juan Pérez" 
                        value={customerName} onChange={e => setCustomerName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="section-label">WhatsApp</label>
                      <input 
                        className="sleek-input" 
                        type="tel" 
                        placeholder="10 dígitos" 
                        value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="section-label">Correo Electrónico</label>
                    <input 
                      className="sleek-input" 
                      type="email" 
                      placeholder="Para enviarte confirmaciones" 
                      value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="section-label">Hora para agendar tu visita</label>
                    <select 
                      className="sleek-input" 
                      value={pickupTime} 
                      onChange={e => setPickupTime(e.target.value)}
                      style={{ marginTop: '8px' }}
                    >
                      <option value="" disabled>Selecciona un horario</option>
                      {Array.from({ length: 19 }).map((_, i) => {
                        const totalMins = 9 * 60 + i * 30
                        const hours = Math.floor(totalMins / 60)
                        const mins = totalMins % 60
                        const ampm = hours >= 12 ? 'PM' : 'AM'
                        const displayHours = hours > 12 ? hours - 12 : hours
                        const timeStr = `${displayHours}:${mins.toString().padStart(2, '0')} ${ampm}`
                        return <option key={timeStr} value={timeStr}>{timeStr}</option>
                      })}
                    </select>
                    <p className="hint-text">Te enviaremos la ubicación exacta por WhatsApp al confirmar.</p>
                  </div>
                  <div className="wizard-actions">
                    <button className="btn-ghost" onClick={handleBack}>Regresar</button>
                    <button 
                      className="btn-primary" 
                      disabled={!pickupTime || !customerName.trim() || customerPhone.length < 10 || !customerEmail.includes('@')} 
                      onClick={handleNext}
                    >
                      Continuar
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {step === 3 && (
                <div className="step-body fade-in">
                  {paymentFailedNotice && (
                    <div className="payment-failure-notice fade-in">
                      <div className="pfn-header">
                        <span className="pfn-icon">⚠️</span>
                        <strong>El pago en MercadoPago no se completó</strong>
                      </div>
                      <p className="pfn-desc">
                        No se realizó ningún cobro a tu tarjeta. Tus datos de entrega siguen guardados aquí abajo.
                      </p>
                      <div className="pfn-options">
                        <span>Puedes reintentar el pago o elegir <strong>Transferencia Bancaria SPEI</strong> abajo para recibir las instrucciones por correo:</span>
                      </div>
                    </div>
                  )}

                  <label className="section-label">Opciones de Pago</label>
                  <div className="option-group">
                    {fulfillment === 'delivery' ? (
                      <>
                        <button type="button" className={`method-btn ${paymentPref === 'anticipo' ? 'active' : ''}`} onClick={() => setPaymentPref('anticipo')}>
                          <span className="icon">💵</span>
                          <div className="text-left">
                            <strong>MercadoPago: Anticipo ($50) + Efectivo</strong>
                            <p>Paga el anticipo de $50 online con tarjeta. El resto (${finalTotal - 50} MXN) en efectivo al recibir.</p>
                          </div>
                        </button>
                        <button type="button" className={`method-btn ${paymentPref === 'total' ? 'active' : ''}`} onClick={() => setPaymentPref('total')}>
                          <span className="icon">💳</span>
                          <div className="text-left">
                            <strong>MercadoPago: Pagar Total Online</strong>
                            <p>Paga el 100% ahora vía MercadoPago (Tarjeta o saldo).</p>
                          </div>
                        </button>
                        <button type="button" className={`method-btn ${paymentPref === 'spei' ? 'active' : ''}`} onClick={() => setPaymentPref('spei')}>
                          <span className="icon">🏦</span>
                          <div className="text-left">
                            <strong>Transferencia Bancaria SPEI (Anticipo $50)</strong>
                            <p>Genera tu pre-reservación. Te enviamos los datos bancarios a tu correo para transferir.</p>
                          </div>
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className={`method-btn ${paymentPref === 'anticipo' ? 'active' : ''}`} onClick={() => setPaymentPref('anticipo')}>
                          <span className="icon">💵</span>
                          <div className="text-left">
                            <strong>Efectivo al Recoger</strong>
                            <p>Paga el 100% en efectivo cuando pases por tu pedido.</p>
                          </div>
                        </button>
                        <button type="button" className={`method-btn ${paymentPref === 'total' ? 'active' : ''}`} onClick={() => setPaymentPref('total')}>
                          <span className="icon">💳</span>
                          <div className="text-left">
                            <strong>Pagar Total Online</strong>
                            <p>Paga el 100% adelantado vía MercadoPago y solo pasa a recoger.</p>
                          </div>
                        </button>
                        <button type="button" className={`method-btn ${paymentPref === 'spei' ? 'active' : ''}`} onClick={() => setPaymentPref('spei')}>
                          <span className="icon">🏦</span>
                          <div className="text-left">
                            <strong>Transferencia Bancaria SPEI (Anticipo $50)</strong>
                            <p>Genera tu pre-reservación. Te enviamos los datos a tu correo para transferir.</p>
                          </div>
                        </button>
                      </>
                    )}
                  </div>

                  <div className="discrete-assurance">
                    <div className="kraft-thumb">📦</div>
                    <div className="da-text">
                      <strong>Empaque 100% discreto garantizado.</strong>
                      <p>Nadie sabrá qué hay adentro de tu paquete.</p>
                    </div>
                  </div>

                  <div className="wizard-actions">
                    <button className="btn-ghost" onClick={handleBack}>Regresar</button>
                    <button className="btn-primary" onClick={handleConfirmOrder}>
                      {paymentPref === 'spei' 
                        ? 'Confirmar Pre-reservación' 
                        : (fulfillment === 'pickup' && paymentPref === 'anticipo') 
                          ? 'Confirmar por WhatsApp' 
                          : 'Confirmar y Pagar'}
                    </button>
                  </div>

                  {paymentPref !== 'spei' && (
                    <div className="alternative-payment-box">
                      <div className="alt-divider"><span>O SI PREFIERES TRANSFERENCIA MANUAL</span></div>
                      <button type="button" className="btn-secondary-spei" onClick={() => { setPaymentPref('spei'); }}>
                        <span className="w-icon">🏦</span>
                        Pagar Anticipo ($50) por Transferencia Bancaria SPEI
                      </button>
                    </div>
                  )}

                  <div className="trust-badge">
                    <span>⭐️ Recomendados por +120 vecinos en Cancún</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: PREMIUM TICKET RECEIPT */}
          <div className="receipt-wrapper">
            <div className="receipt-ticket">
              <div className="receipt-edge top"></div>
              <div className="receipt-body">
                <div className="receipt-brand">DISTRITO PIPA</div>
                <div className="receipt-subtitle">ORDEN DE COMPRA</div>
                
                <div className="receipt-items">
                  {items.map((item, i) => (
                    <div key={i} className="r-line" style={{alignItems: 'center'}}>
                      <span className="r-item-name">{item.quantity}x {item.product.name_es}</span>
                      <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                        <span>${item.quantity * item.product.price_mxn}</span>
                        <button 
                          onClick={() => removeFromCart(item.product.id, item.size, item.color)} 
                          style={{background: 'transparent', border: 'none', color: '#c0392b', cursor: 'pointer', fontSize: '14px', padding: '0 4px', fontWeight: 'bold'}}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="receipt-divider"></div>
                
                <div className="r-line">
                  <span>Subtotal</span>
                  <span>${subtotal}</span>
                </div>
                {discount > 0 && (
                  <div className="r-line" style={{ color: '#27ae60', fontWeight: 'bold' }}>
                    <span>Descuento Volumen</span>
                    <span>-${discount}</span>
                  </div>
                )}
                {deliveryFee > 0 && (
                  <div className="r-line">
                    <span>Envío</span>
                    <span>${deliveryFee}</span>
                  </div>
                )}
                
                <div className="receipt-divider"></div>
                
                <div className="r-line r-total">
                  <span>TOTAL</span>
                  <span>${finalTotal}</span>
                </div>

                {step === 3 && (
                  <div className="receipt-breakdown">
                    <div className="r-line highlight">
                      <span>A PAGAR HOY:</span>
                      <span>${amountToPayNow}</span>
                    </div>
                    {balanceDue > 0 && (
                      <div className="r-line rest">
                        <span>Resto al recibir:</span>
                        <span>${balanceDue}</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="receipt-footer">
                  ★ Gracias por elegir Distrito Pipa ★
                </div>
              </div>
              <div className="receipt-edge bottom"></div>
            </div>

            {/* EMBEDDED DELIVERY INFO */}
            <div className="checkout-delivery-card fade-in">
              <div className="cdc-header">
                <span>🚚 INFORMACIÓN DE ENTREGA (CANCÚN)</span>
              </div>
              <div className="cdc-item">
                <span className="cdc-icon">⚡</span>
                <div>
                  <strong>Entrega Mismo Día</strong>
                  <p>30 a 90 minutos promedio en pedidos antes de las 8:00 PM.</p>
                </div>
              </div>
              <div className="cdc-item">
                <span className="cdc-icon">📍</span>
                <div>
                  <strong>Tarifas & Cobertura</strong>
                  <p>Zona Urbana: $50 MXN | Zona Extendida: $80 MXN | Pick-up: Gratis (Reg. 96).</p>
                </div>
              </div>
              <div className="cdc-item">
                <span className="cdc-icon">📦</span>
                <div>
                  <strong>Empaque 100% Discreto</strong>
                  <p>Bolsa Kraft sellada.</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .checkout-page {
          min-height: 100vh;
          background: #111;
          color: #fff;
          padding: 40px 20px;
          display: flex;
          justify-content: center;
        }

        .checkout-container {
          width: 100%;
          max-width: 900px;
        }

        .checkout-layout {
          display: flex;
          flex-direction: column-reverse; /* Put ticket on top for mobile */
          gap: 40px;
        }

        @media (min-width: 768px) {
          .checkout-layout {
            flex-direction: row;
            align-items: flex-start;
          }
          .checkout-wizard { flex: 1.2; }
          .receipt-wrapper { flex: 0.8; position: sticky; top: 40px; }
        }

        /* WIZARD (Sleek Dark Mode) */
        .checkout-wizard {
          background: #1a1a1a;
          border: 1px solid #2a2a2a;
          border-radius: 12px;
          padding: 32px 24px;
        }

        .wizard-header { margin-bottom: 24px; }
        .back-link { font-size: 13px; color: #888; text-decoration: none; margin-bottom: 12px; display: inline-block; transition: color 0.2s; }
        .back-link:hover { color: #fff; }
        .wizard-header h2 { font-family: var(--font-bebas), sans-serif; font-size: 32px; letter-spacing: 0.05em; margin: 0; }

        .fade-in { animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }

        .step-body { display: flex; flex-direction: column; gap: 20px; }
        .section-label { font-size: 13px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 8px; display: block; }
        
        .option-group { display: flex; flex-direction: column; gap: 10px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }

        .method-btn, .zone-btn {
          display: flex; align-items: center; gap: 16px;
          background: #222; border: 1px solid #333; border-radius: 8px;
          padding: 16px; color: #fff; cursor: pointer; text-align: left;
          transition: all 0.2s;
        }
        .method-btn:hover, .zone-btn:hover { border-color: #555; }
        .method-btn.active, .zone-btn.active {
          background: rgba(220, 20, 60, 0.1);
          border-color: #DC143C;
        }
        
        .method-btn .icon { font-size: 24px; }
        .method-btn strong, .zone-btn strong { font-size: 15px; font-weight: 600; display: block; }
        .method-btn p, .zone-btn p { font-size: 12px; color: #888; margin: 4px 0 0; }

        .zone-selector { margin-top: 10px; padding-top: 20px; border-top: 1px dashed #333; }
        .zone-btn { flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 16px; }

        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .sleek-input {
          background: #111; border: 1px solid #333; border-radius: 8px;
          color: #fff; padding: 14px; font-family: var(--font-inter), sans-serif;
          font-size: 14px; outline: none; transition: border-color 0.2s;
        }
        .sleek-input:focus { border-color: #DC143C; }
        .hint-text { font-size: 12px; color: #888; line-height: 1.4; }

        .deposit-box {
          background: #222; border-left: 3px solid #DC143C; padding: 16px; border-radius: 0 8px 8px 0;
        }
        .deposit-box strong { font-size: 14px; display: block; margin-bottom: 4px; }
        .deposit-toggles { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
        .radio-label { display: flex; align-items: center; gap: 10px; font-size: 14px; cursor: pointer; }
        .radio-label input { accent-color: #DC143C; width: 16px; height: 16px; }

        .wizard-actions {
          display: flex; justify-content: flex-end; gap: 12px;
          margin-top: 12px; padding-top: 24px; border-top: 1px solid #2a2a2a;
        }
        .btn-primary {
          background: #DC143C; color: #fff; border: none; border-radius: 8px;
          padding: 12px 24px; font-family: var(--font-inter), sans-serif;
          font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;
        }
        .btn-primary:hover:not(:disabled) { background: #b81032; }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-ghost {
          background: transparent; color: #888; border: 1px solid transparent;
          padding: 12px 24px; font-size: 14px; cursor: pointer; transition: color 0.2s;
        }
        .btn-ghost:hover { color: #fff; }

        .discrete-assurance { display: flex; align-items: center; gap: 12px; background: rgba(255,255,255,0.05); padding: 12px 16px; border-radius: 8px; border: 1px dashed #333; margin-top: 20px; }
        .kraft-thumb { width: 40px; height: 40px; background: #222; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 20px; border: 1px solid #333; }
        .da-text strong { font-size: 13px; color: #fff; display: block; margin-bottom: 2px; }
        .da-text p { font-size: 11px; color: #888; margin: 0; }

        .trust-badge { text-align: right; font-size: 11px; color: #888; margin-top: 8px; }
        .trust-badge span { background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; display: inline-block; }

        /* RECEIPT (Premium Ticket) */
        .receipt-ticket {
          background: #fafafa;
          color: #111;
          border-radius: 4px;
          position: relative;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          font-family: 'Courier New', Courier, monospace;
        }

        .receipt-edge {
          height: 12px;
          background: #111;
          position: absolute;
          left: 0; right: 0;
          mask-image: radial-gradient(circle at 6px 6px, transparent 6px, black 6.5px);
          mask-size: 12px 12px;
          mask-position: -6px 0;
        }
        .receipt-edge.top { top: 0; transform: rotate(180deg); }
        .receipt-edge.bottom { bottom: 0; }

        .receipt-body {
          padding: 40px 24px;
        }

        .receipt-brand { text-align: center; font-family: var(--font-bebas), sans-serif; font-size: 28px; letter-spacing: 0.1em; color: #111; }
        .receipt-subtitle { text-align: center; font-size: 11px; letter-spacing: 0.1em; color: #555; margin-bottom: 24px; }
        
        .r-line { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; line-height: 1.4; }
        .r-item-name { max-width: 70%; }
        
        .receipt-divider { border-top: 1px dashed #aaa; margin: 16px 0; }
        
        .r-total { font-size: 18px; font-weight: bold; margin: 16px 0; }
        
        .receipt-breakdown {
          background: #eee; border: 1px solid #ddd; padding: 12px; border-radius: 4px; margin-top: 16px;
        }
        .highlight { font-weight: bold; font-size: 14px; margin-bottom: 0; }
        .rest { font-size: 12px; color: #555; margin-top: 6px; margin-bottom: 0; }
        
        .receipt-footer { text-align: center; font-size: 11px; color: #555; margin-top: 32px; border-top: 1px dashed #aaa; padding-top: 16px; }

        .payment-failure-notice {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 20px;
        }
        .pfn-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #f59e0b;
          font-size: 15px;
          margin-bottom: 6px;
        }
        .pfn-icon { font-size: 18px; }
        .pfn-desc {
          color: #ddd;
          font-size: 13px;
          line-height: 1.4;
          margin: 0 0 8px 0;
        }
        .pfn-options {
          font-size: 12px;
          color: #aaa;
        }
        .alternative-payment-box {
          margin-top: 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .alt-divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: #666;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .alt-divider::before, .alt-divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid #333;
        }
        .alt-divider span {
          padding: 0 10px;
        }
        .btn-secondary-spei {
          background: #18221c;
          border: 1px solid #234e38;
          color: #2ecc71;
          font-weight: 600;
          padding: 12px 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
        }
        .btn-secondary-spei:hover {
          background: #1e3327;
          border-color: #27ae60;
        }

        /* PAYMENT PROCESSING OVERLAY */
        .payment-processing-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .ppo-card {
          background: #181818;
          border: 1px solid #333;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(220, 20, 60, 0.15);
          border-radius: 16px;
          padding: 36px 28px;
          max-width: 440px;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .ppo-spinner-wrap {
          position: relative;
          width: 70px;
          height: 70px;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .ppo-spinner {
          position: absolute;
          width: 100%;
          height: 100%;
          border: 3px solid rgba(220, 20, 60, 0.2);
          border-top-color: #DC143C;
          border-right-color: #27ae60;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .ppo-lock-icon {
          font-size: 24px;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .ppo-title {
          font-family: var(--font-bebas), sans-serif;
          font-size: 26px;
          letter-spacing: 0.05em;
          color: #fff;
          margin: 0 0 10px 0;
        }
        .ppo-subtitle {
          color: #aaa;
          font-size: 13px;
          line-height: 1.5;
          margin: 0 0 20px 0;
        }
        .ppo-badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }
        .ppo-badge {
          background: #222;
          border: 1px solid #333;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #ccc;
          padding: 6px 12px;
        }

        /* STEP 1 HIGHLIGHTS BANNER */
        .delivery-highlights-banner {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-top: -4px;
          margin-bottom: 4px;
        }
        .dh-pill {
          background: #1d1d1d;
          border: 1px solid #2e2e2e;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 11px;
          color: #bbb;
          display: flex;
          align-items: center;
          gap: 5px;
          font-weight: 500;
        }
        .dh-pill span {
          font-size: 12px;
        }

        /* SIDEBAR EMBEDDED DELIVERY CARD */
        .checkout-delivery-card {
          margin-top: 20px;
          background: #161616;
          border: 1px solid #282828;
          border-radius: 10px;
          padding: 18px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .cdc-header {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #DC143C;
          border-bottom: 1px solid #222;
          padding-bottom: 8px;
        }
        .cdc-item {
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .cdc-icon {
          font-size: 16px;
          line-height: 1.2;
        }
        .cdc-item strong {
          display: block;
          font-size: 12px;
          color: #eee;
          margin-bottom: 2px;
        }
        .cdc-item p {
          font-size: 11px;
          color: #888;
          line-height: 1.35;
          margin: 0;
        }
      `}</style>
    </main>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <main className="checkout-page" style={{ minHeight: '100vh', background: '#111', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p>Cargando checkout...</p>
      </main>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
