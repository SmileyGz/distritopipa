'use client'
// app/booking/page.tsx
// Customer-facing order form. Linked from product detail drawer.
// Supports all three delivery modes and payment scenarios.

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// Pre-loaded from URL params when coming from the shelf
// e.g. /booking?product=Burbuja+Reforzada&price=99&color=Verde&qty=1

type DeliveryMode = 'delivery' | 'pickup' | 'punto_medio'
type PaymentMode  = 'deposit'  | 'pickup_cash' | 'full_prepay'
type Zone         = 'zone1' | 'zone2'

const CLABE = '1676 9100 0009 7700 36'

const DELIVERY_FEES = {
  pickup:      { day: 0,  night: 0  },
  zone1:       { day: 50, night: 80 },
  zone2:       { day: 80, night: 100 },
  punto_medio: { day: 40, night: 40 },
}

export default function BookingPage() {
  const router       = useRouter()
  const params       = useSearchParams()

  // Pre-fill from URL
  const prefillProduct = params.get('product') || ''
  const prefillPrice   = parseFloat(params.get('price') || '0')
  const prefillColor   = params.get('color') || ''
  const prefillQty     = parseInt(params.get('qty') || '1')
  const prefillBundle  = params.get('bundle_price') ? parseFloat(params.get('bundle_price')!) : null

  // Form state
  const [name, setName]               = useState('')
  const [phone, setPhone]             = useState('')
  const [email, setEmail]             = useState('')
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>('delivery')
  const [zone, setZone]               = useState<Zone>('zone1')
  const [address, setAddress]         = useState('')
  const [notes, setNotes]             = useState('')
  const [isNight, setIsNight]         = useState(false)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('deposit')
  const [step, setStep]               = useState<1|2|3>(1)
  const [submitting, setSubmitting]   = useState(false)
  const [submitted, setSubmitted]     = useState(false)
  const [orderId, setOrderId]         = useState('')
  const [orderNum, setOrderNum]       = useState('')
  const [error, setError]             = useState('')

  // ── Calculations ───────────────────────────────────────────

  const itemPrice = prefillBundle ?? (prefillPrice * prefillQty)

  const feeKey = deliveryMode === 'delivery' ? zone : deliveryMode
  const deliveryFee = DELIVERY_FEES[feeKey]?.[isNight ? 'night' : 'day'] ?? 0

  const total    = itemPrice + deliveryFee
  const anticipo = paymentMode === 'pickup_cash' ? 0
                 : paymentMode === 'full_prepay'  ? total
                 : Math.ceil(total * 0.25)
  const resta    = total - anticipo

  // ── Validation ─────────────────────────────────────────────

  function validateStep1() {
    if (!name.trim())  return 'Tu nombre es requerido'
    if (!phone.trim()) return 'Tu número de WhatsApp es requerido'
    const digits = phone.replace(/\D/,'')
    if (digits.length < 10) return 'Número de WhatsApp inválido (mínimo 10 dígitos)'
    return null
  }

  function validateStep2() {
    if (deliveryMode === 'delivery' && !address.trim()) {
      return 'La dirección de entrega es requerida'
    }
    return null
  }

  // ── Submit ─────────────────────────────────────────────────

  async function handleSubmit() {
    setError('')
    setSubmitting(true)

    const item = {
      name:         prefillProduct || 'Producto',
      qty:          prefillQty,
      unit_price:   prefillPrice,
      color:        prefillColor || undefined,
      bundle_price: prefillBundle || undefined,
    }

    const cleanPhone = phone.replace(/\D/,'')
    const fullPhone  = cleanPhone.startsWith('52') ? cleanPhone : `52${cleanPhone}`

    const { data, error: err } = await supabase
      .from('orders')
      .insert({
        customer_name:   name.trim(),
        customer_phone:  fullPhone,
        customer_email:  email.trim() || null,
        items:           [item],
        subtotal_mxn:    itemPrice,
        delivery_mode:   deliveryMode,
        delivery_zone:   deliveryMode === 'delivery' ? zone : null,
        delivery_fee:    deliveryFee,
        is_night:        isNight,
        total_mxn:       total,
        payment_mode:    paymentMode,
        delivery_address: address.trim() || null,
        delivery_notes:  notes.trim() || null,
        status:          'pending',
      })
      .select('id, order_number')
      .single()

    if (err || !data) {
      setError('Hubo un error al enviar tu pedido. Intenta de nuevo.')
      setSubmitting(false)
      return
    }

    setOrderId(data.id)
    setOrderNum(data.order_number)
    setSubmitted(true)
    setSubmitting(false)
  }

  // ─────────────────────────────────────────────────────────────
  // SUBMITTED STATE
  // ─────────────────────────────────────────────────────────────

  if (submitted) {
    const waMsg = paymentMode === 'pickup_cash'
      ? `Hola! Acabo de reservar el pedido ${orderNum}. ¿Cuándo puedo pasar a recoger?`
      : `Hola! Acabo de enviar el pedido ${orderNum} por $${total.toLocaleString('es-MX')} MXN. ¿A qué CLABE transfiero el anticipo de $${anticipo}?`

    const waUrl = `https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '529981234567'}?text=${encodeURIComponent(waMsg)}`

    return (
      <div className="page-wrap">
        <div className="success-card">
          <div className="success-icon">✅</div>
          <h2 className="success-title">¡Pedido recibido!</h2>
          <div className="success-num">{orderNum}</div>
          <p className="success-desc">
            Recibimos tu pedido. En breve te contactaremos por WhatsApp para confirmar los detalles.
          </p>

          {paymentMode !== 'pickup_cash' && (
            <div className="payment-box">
              <div className="pay-title">
                {paymentMode === 'full_prepay' ? '💳 Pago completo requerido' : '💳 Anticipo requerido'}
              </div>
              <div className="pay-amount">${anticipo.toLocaleString('es-MX')} MXN</div>
              <div className="clabe-row">
                <span className="clabe-label">CLABE:</span>
                <span className="clabe-num">{CLABE}</span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(CLABE.replace(/\s/g,''))}>
                  📋
                </button>
              </div>
              <div className="ref-row">
                <span className="ref-label">Referencia / concepto:</span>
                <span className="ref-val">{orderNum}</span>
              </div>
              {paymentMode === 'deposit' && (
                <p className="pay-note">
                  El resto (${resta.toLocaleString('es-MX')} MXN) lo pagas al recibir tu pedido en efectivo.
                </p>
              )}
            </div>
          )}

          {paymentMode === 'pickup_cash' && (
            <div className="payment-box pickup-box">
              <div className="pay-title">📍 Recoger en tienda</div>
              <p className="pay-note">
                Región 96, Cancún<br/>
                (Cerca de Coppel y Soriana Nichupté)<br/>
                <strong>Pago en efectivo: ${total.toLocaleString('es-MX')} MXN</strong>
              </p>
            </div>
          )}

          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="wa-btn">
            💬 Confirmar por WhatsApp
          </a>

          <button className="back-btn" onClick={() => router.push('/menu')}>
            ← Seguir viendo el menú
          </button>
        </div>
        <style>{sharedStyles}</style>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────
  // FORM STEPS
  // ─────────────────────────────────────────────────────────────

  return (
    <div className="page-wrap">
      {/* Header */}
      <div className="booking-header">
        <button className="back-link" onClick={() => router.back()}>← Volver</button>
        <div className="header-logo">
          <span className="logo-district">Distrito</span>
          <span className="logo-pipa">Pipa</span>
        </div>
      </div>

      {/* Order summary */}
      {prefillProduct && (
        <div className="order-summary">
          <div className="summary-label">Tu pedido</div>
          <div className="summary-row">
            <span className="summary-name">
              {prefillQty}x {prefillProduct}{prefillColor ? ` — ${prefillColor}` : ''}
            </span>
            <span className="summary-price">${itemPrice.toLocaleString('es-MX')}</span>
          </div>
          {deliveryFee > 0 && (
            <div className="summary-row">
              <span className="summary-name">Envío</span>
              <span className="summary-price">${deliveryFee}</span>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>${total.toLocaleString('es-MX')} MXN</span>
          </div>
        </div>
      )}

      {/* Step indicator */}
      <div className="steps">
        {[['1','Tus datos'],['2','Entrega'],['3','Pago']].map(([n,label],i) => (
          <div key={n} className={`step ${step === i+1 ? 'active' : step > i+1 ? 'done' : ''}`}>
            <div className="step-num">{step > i+1 ? '✓' : n}</div>
            <div className="step-label">{label}</div>
          </div>
        ))}
      </div>

      <div className="form-body">

        {/* ── STEP 1: Contact ── */}
        {step === 1 && (
          <div className="form-step">
            <h2 className="step-title">¿Cómo te contactamos?</h2>

            <label className="field-label">Nombre *</label>
            <input className="field-input" value={name}
              onChange={e => setName(e.target.value)} placeholder="Tu nombre" />

            <label className="field-label">WhatsApp *</label>
            <div className="phone-wrap">
              <span className="phone-prefix">🇲🇽 +52</span>
              <input className="field-input phone-input" value={phone}
                onChange={e => setPhone(e.target.value.replace(/\D/,''))}
                placeholder="998 123 4567" type="tel" inputMode="numeric" maxLength={10} />
            </div>
            <p className="field-hint">Te enviaremos la confirmación por aquí</p>

            <label className="field-label">Email (opcional)</label>
            <input className="field-input" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" type="email" />

            {error && <div className="error-msg">{error}</div>}

            <button className="btn-next" onClick={() => {
              const err = validateStep1()
              if (err) { setError(err); return }
              setError(''); setStep(2)
            }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── STEP 2: Delivery ── */}
        {step === 2 && (
          <div className="form-step">
            <h2 className="step-title">¿Cómo recibes tu pedido?</h2>

            {/* Delivery mode */}
            <div className="option-group">
              {[
                { value:'delivery',    icon:'🚗', title:'Envío a domicilio', sub:'1–10 km · desde $50' },
                { value:'pickup',      icon:'📍', title:'Recoger en tienda', sub:'Región 96 · gratis' },
                { value:'punto_medio', icon:'🏢', title:'Punto medio / plaza', sub:'$40 · nos coordinamos' },
              ].map(opt => (
                <button key={opt.value}
                  className={`option-card ${deliveryMode===opt.value?'active':''}`}
                  onClick={() => {
                    setDeliveryMode(opt.value as DeliveryMode)
                    if (opt.value==='pickup') setPaymentMode('pickup_cash')
                    else if (paymentMode==='pickup_cash') setPaymentMode('deposit')
                  }}
                >
                  <span className="opt-icon">{opt.icon}</span>
                  <div>
                    <div className="opt-title">{opt.title}</div>
                    <div className="opt-sub">{opt.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Zone selector */}
            {deliveryMode === 'delivery' && (
              <>
                <label className="field-label">¿A qué distancia estás?</label>
                <div className="option-group">
                  {[
                    {value:'zone1',label:'1–6 km',fee:isNight?80:50},
                    {value:'zone2',label:'6–10 km',fee:isNight?100:80},
                  ].map(z => (
                    <button key={z.value}
                      className={`option-card ${zone===z.value?'active':''}`}
                      onClick={() => setZone(z.value as Zone)}
                    >
                      <span className="opt-icon">📍</span>
                      <div>
                        <div className="opt-title">{z.label}</div>
                        <div className="opt-sub">Costo de envío: ${z.fee}</div>
                      </div>
                    </button>
                  ))}
                </div>

                <label className="field-label">Dirección de entrega *</label>
                <textarea className="field-textarea" value={address}
                  onChange={e => setAddress(e.target.value)} rows={3}
                  placeholder="Calle, número, colonia / SM / Región, referencia..." />

                <label className="toggle-label">
                  <input type="checkbox" checked={isNight}
                    onChange={e => setIsNight(e.target.checked)} />
                  <span>Entrega después de las 8pm (+$30)</span>
                </label>
              </>
            )}

            <label className="field-label">Notas adicionales (opcional)</label>
            <textarea className="field-textarea" value={notes}
              onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Horario preferido, referencias, instrucciones especiales..." />

            {error && <div className="error-msg">{error}</div>}

            <div className="nav-row">
              <button className="btn-back" onClick={() => { setError(''); setStep(1) }}>← Atrás</button>
              <button className="btn-next" onClick={() => {
                const err = validateStep2()
                if (err) { setError(err); return }
                setError(''); setStep(3)
              }}>Continuar →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Payment ── */}
        {step === 3 && (
          <div className="form-step">
            <h2 className="step-title">¿Cómo pagas?</h2>

            <div className="option-group">
              {deliveryMode !== 'pickup' && (
                <button
                  className={`option-card ${paymentMode==='deposit'?'active':''}`}
                  onClick={() => setPaymentMode('deposit')}
                >
                  <span className="opt-icon">💳</span>
                  <div>
                    <div className="opt-title">Anticipo + efectivo</div>
                    <div className="opt-sub">Deposita ${anticipo} MXN · resto al recibir</div>
                  </div>
                </button>
              )}

              {deliveryMode === 'pickup' && (
                <button
                  className={`option-card ${paymentMode==='pickup_cash'?'active':''}`}
                  onClick={() => setPaymentMode('pickup_cash')}
                >
                  <span className="opt-icon">💵</span>
                  <div>
                    <div className="opt-title">Efectivo al recoger</div>
                    <div className="opt-sub">Sin anticipo · pago total en tienda</div>
                  </div>
                </button>
              )}

              {deliveryMode !== 'pickup' && (
                <button
                  className={`option-card ${paymentMode==='full_prepay'?'active':''}`}
                  onClick={() => setPaymentMode('full_prepay')}
                >
                  <span className="opt-icon">💳</span>
                  <div>
                    <div className="opt-title">Pago completo</div>
                    <div className="opt-sub">Transfiere ${total.toLocaleString('es-MX')} MXN total</div>
                  </div>
                </button>
              )}
            </div>

            {/* Payment summary */}
            <div className="pay-summary">
              <div className="pay-sum-row">
                <span>Productos</span>
                <span>${itemPrice.toLocaleString('es-MX')}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="pay-sum-row">
                  <span>Envío</span>
                  <span>${deliveryFee}</span>
                </div>
              )}
              <div className="pay-sum-row pay-total">
                <span>TOTAL</span>
                <span>${total.toLocaleString('es-MX')} MXN</span>
              </div>
              {anticipo > 0 && (
                <div className="pay-sum-row pay-anticipo">
                  <span>{paymentMode==='full_prepay'?'A transferir':'Anticipo ahora'}</span>
                  <span>${anticipo.toLocaleString('es-MX')} MXN</span>
                </div>
              )}
              {paymentMode === 'deposit' && resta > 0 && (
                <div className="pay-sum-row">
                  <span style={{color:'#888'}}>Resto al recibir (efectivo)</span>
                  <span style={{color:'#888'}}>${resta.toLocaleString('es-MX')}</span>
                </div>
              )}
            </div>

            {error && <div className="error-msg">{error}</div>}

            <div className="legal-note">
              Accesorios de uso personal · Producto legal · No incluye sustancias
            </div>

            <div className="nav-row">
              <button className="btn-back" onClick={() => { setError(''); setStep(2) }}>← Atrás</button>
              <button className="btn-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Enviando...' : '✅ Confirmar pedido'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{sharedStyles}</style>
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────
const sharedStyles = `
  *{box-sizing:border-box;margin:0;padding:0}
  .page-wrap{min-height:100vh;background:#111;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:0 0 60px}

  .booking-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #2a2a2a}
  .back-link{background:none;border:none;color:#888;font-size:14px;cursor:pointer;padding:4px 0}
  .back-link:hover{color:#fff}
  .header-logo{text-align:right}
  .logo-district{font-size:10px;letter-spacing:.15em;color:#888;text-transform:uppercase;display:block}
  .logo-pipa{font-family:Georgia,serif;font-style:italic;font-size:20px;color:#fff;line-height:1}

  .order-summary{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:14px;margin:16px 20px 0}
  .summary-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
  .summary-row{display:flex;justify-content:space-between;font-size:13px;color:#ccc;margin-bottom:4px}
  .summary-price{color:#fff;font-weight:500}
  .summary-total{display:flex;justify-content:space-between;font-size:15px;font-weight:600;color:#fff;border-top:1px solid #2a2a2a;padding-top:8px;margin-top:4px}

  .steps{display:flex;padding:20px 20px 0;gap:0}
  .step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;position:relative}
  .step:not(:last-child)::after{content:'';position:absolute;top:13px;left:calc(50% + 14px);width:calc(100% - 28px);height:1px;background:#2a2a2a}
  .step-num{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;border:1px solid #2a2a2a;background:#1a1a1a;color:#888;z-index:1}
  .step.active .step-num{background:#CC2222;border-color:#CC2222;color:#fff}
  .step.done .step-num{background:#4ade80;border-color:#4ade80;color:#111}
  .step-label{font-size:10px;color:#888;text-align:center}
  .step.active .step-label{color:#fff}

  .form-body{padding:20px}
  .form-step{display:flex;flex-direction:column;gap:12px}
  .step-title{font-size:18px;font-weight:600;margin-bottom:4px}

  .field-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin-top:4px}
  .field-input,.field-textarea{width:100%;background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:8px;color:#fff;padding:11px 14px;font-size:14px;font-family:inherit}
  .field-input:focus,.field-textarea:focus{outline:none;border-color:#CC2222}
  .field-textarea{resize:vertical;min-height:70px}
  .field-hint{font-size:11px;color:#555;margin-top:-4px}

  .phone-wrap{display:flex;gap:0;background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:8px;overflow:hidden}
  .phone-prefix{padding:11px 12px;font-size:14px;color:#888;background:#1a1a1a;border-right:0.5px solid #2a2a2a;white-space:nowrap}
  .phone-input{flex:1;background:transparent;border:none;border-radius:0}

  .option-group{display:flex;flex-direction:column;gap:8px}
  .option-card{display:flex;align-items:center;gap:12px;padding:12px 14px;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:10px;cursor:pointer;text-align:left;transition:all .15s;color:#fff;width:100%}
  .option-card:hover{border-color:#555}
  .option-card.active{border-color:#CC2222;background:rgba(204,34,34,.08)}
  .opt-icon{font-size:20px;flex-shrink:0}
  .opt-title{font-size:14px;font-weight:500}
  .opt-sub{font-size:11px;color:#888;margin-top:2px}

  .toggle-label{display:flex;align-items:center;gap:8px;font-size:13px;color:#ccc;cursor:pointer}
  .toggle-label input{accent-color:#CC2222;width:16px;height:16px}

  .pay-summary{background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:6px}
  .pay-sum-row{display:flex;justify-content:space-between;font-size:13px;color:#888}
  .pay-total{color:#fff;font-weight:600;font-size:15px;border-top:1px solid #2a2a2a;padding-top:8px;margin-top:2px}
  .pay-anticipo{color:#fb923c;font-weight:500}

  .nav-row{display:flex;gap:10px;margin-top:8px}
  .btn-back{flex:1;padding:13px;background:transparent;color:#888;border:0.5px solid #2a2a2a;border-radius:8px;font-size:14px;cursor:pointer}
  .btn-back:hover{color:#fff}
  .btn-next,.btn-submit{flex:2;padding:13px;background:#CC2222;color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;transition:background .15s}
  .btn-next:hover,.btn-submit:hover:not(:disabled){background:#e02222}
  .btn-submit:disabled{opacity:.5;cursor:not-allowed}

  .error-msg{background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.3);color:#f87171;padding:10px 14px;border-radius:8px;font-size:13px}
  .legal-note{font-size:10px;color:#555;text-align:center;line-height:1.5}

  /* Success */
  .success-card{margin:40px 20px;background:#1a1a1a;border:0.5px solid #2a2a2a;border-radius:16px;padding:32px 24px;text-align:center}
  .success-icon{font-size:48px;margin-bottom:16px}
  .success-title{font-size:22px;font-weight:600;margin-bottom:8px}
  .success-num{font-size:13px;color:#CC2222;font-weight:600;background:rgba(204,34,34,.1);padding:4px 16px;border-radius:20px;display:inline-block;margin-bottom:12px}
  .success-desc{font-size:14px;color:#888;line-height:1.6;margin-bottom:20px}

  .payment-box{background:#111;border:0.5px solid #2a2a2a;border-radius:10px;padding:16px;margin-bottom:16px;text-align:left}
  .pickup-box{border-color:rgba(74,222,128,.2)}
  .pay-title{font-size:13px;font-weight:600;margin-bottom:10px}
  .pay-amount{font-size:24px;font-weight:600;color:#CC2222;margin-bottom:12px}
  .clabe-row{display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap}
  .clabe-label{font-size:11px;color:#888}
  .clabe-num{font-size:14px;font-weight:600;color:#fff;font-family:monospace;letter-spacing:.05em}
  .copy-btn{background:#2a2a2a;border:none;color:#888;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:14px}
  .copy-btn:hover{color:#fff}
  .ref-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
  .ref-label{font-size:11px;color:#888}
  .ref-val{font-size:13px;font-weight:600;color:#fff;font-family:monospace}
  .pay-note{font-size:12px;color:#888;line-height:1.5}

  .wa-btn{display:block;padding:14px;background:#25D366;color:#fff;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none;margin-bottom:10px;transition:background .15s}
  .wa-btn:hover{background:#22c35c}
  .back-btn{display:block;padding:12px;background:transparent;color:#888;border:0.5px solid #2a2a2a;border-radius:8px;font-size:14px;cursor:pointer;width:100%}
`
