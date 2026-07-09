'use client'

import React, { useState } from 'react'
import Link from 'next/link'

export default function MayoreoPage() {
  const [form, setForm] = useState({ name: '', store: '', phone: '', amount: '1 a 2 Docenas', inquiry: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!form.name || !form.phone) return
    
    // Save as wholesale lead in orders
    const orders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
    const newLead = {
      id: `lead_${Date.now()}`,
      order_number: `MAY-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'wholesale_inquiry',
      customer_name: form.name,
      customer_phone: form.phone,
      total_mxn: 0,
      admin_notes: `Negocio: ${form.store} | Cantidad deseada: ${form.amount}\nConsulta: ${form.inquiry}`,
      created_at: new Date().toISOString()
    }
    
    orders.push(newLead)
    localStorage.setItem('dp_mock_orders', JSON.stringify(orders))
    setSubmitted(true)
  }

  return (
    <div className="mayoreo-wrap">
      <header className="mayoreo-header">
        <h1>MAYOREO</h1>
        <p>Distribuye las mejores pipas de cristal de Cancún. Venta exclusiva por docenas para Smoke Shops y revendedores.</p>
      </header>

      <section className="section">
        <div className="tiers-grid">
          <div className="tier-card">
            <h3 className="tier-name">Plan Starter</h3>
            <div className="tier-desc">Ideal para probar la rotación en mostrador.</div>
            <ul className="tier-features">
              <li>Desde 1 Docena (12 pz)</li>
              <li>25% de descuento</li>
              <li>Entrega en Región 96</li>
            </ul>
          </div>
          <div className="tier-card featured">
            <h3 className="tier-name">Plan Crecimiento</h3>
            <div className="tier-desc">Para negocios con alta demanda.</div>
            <ul className="tier-features">
              <li>Desde 3 Docenas (36 pz)</li>
              <li>35% de descuento</li>
              <li>Prioridad de re-stock</li>
              <li>Entrega en Región 96</li>
            </ul>
          </div>
          <div className="tier-card">
            <h3 className="tier-name">Plan Distribuidor</h3>
            <div className="tier-desc">Para mayoristas y tiendas master.</div>
            <ul className="tier-features">
              <li>Desde 10 Docenas (120 pz)</li>
              <li>50% de descuento</li>
              <li>Asignación de cuenta</li>
              <li>Entrega en Región 96</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="section form-section">
        <div className="lead-box">
          {submitted ? (
            <div className="success-msg">
              <h3>✅ Solicitud Recibida</h3>
              <p>Hemos recibido tus datos correctamente. Nuestro equipo revisará tu solicitud y te contactaremos por WhatsApp muy pronto.</p>
            </div>
          ) : (
            <>
              <h2 className="lead-title">Cotizar Pedido de Mayoreo</h2>
              <p className="lead-sub">Llena el formulario para acceder a nuestros precios preferenciales por docena.</p>
              
              <div className="form-group">
                <label>Tu Nombre</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej. Juan Pérez" />
              </div>
              <div className="form-group">
                <label>Nombre del Negocio (Opcional)</label>
                <input type="text" value={form.store} onChange={e => setForm({...form, store: e.target.value})} placeholder="Ej. Smoke Shop Central" />
              </div>
              <div className="form-group">
                <label>Teléfono (WhatsApp)</label>
                <input type="tel" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="10 dígitos" />
              </div>
              <div className="form-group">
                <label>¿Qué volumen buscas inicialmente?</label>
                <select value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} className="sleek-select">
                  <option value="1 a 2 Docenas">1 a 2 Docenas (12-24 pz)</option>
                  <option value="3 a 5 Docenas">3 a 5 Docenas (36-60 pz)</option>
                  <option value="Más de 10 Docenas">Más de 10 Docenas (120+ pz)</option>
                </select>
              </div>
              <div className="form-group">
                <label>¿Alguna duda o mensaje? (Opcional)</label>
                <textarea value={form.inquiry} onChange={e => setForm({...form, inquiry: e.target.value})} placeholder="Cuéntanos un poco sobre tu tienda..." className="sleek-textarea" rows={3}></textarea>
              </div>
              
              <button className="cta-btn" onClick={handleSubmit} disabled={!form.name || !form.phone}>
                Enviar Solicitud
              </button>
            </>
          )}
        </div>
      </section>

      <style>{`
        .mayoreo-wrap { min-height: 100vh; background: #111; color: #fff; font-family: -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; }
        
        .mayoreo-header { text-align: center; margin-bottom: 40px; padding-top: 20px; }
        .mayoreo-header h1 { font-family: var(--font-bebas); font-size: 48px; color: #fff; letter-spacing: 2px; margin-bottom: 8px; }
        .mayoreo-header p { color: #888; font-size: 16px; max-width: 600px; margin: 0 auto; line-height: 1.6; }

        .section { padding: 0 20px 40px 20px; }
        .tiers-grid { display: grid; gap: 20px; max-width: 1000px; margin: 0 auto; }
        
        .tier-card { background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 12px; padding: 30px; text-align: center; transition: transform 0.2s; }
        .tier-card:hover { transform: translateY(-5px); }
        .tier-card.featured { border-color: #CC2222; position: relative; }
        .tier-card.featured::before { content: 'MÁS POPULAR'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #CC2222; color: #fff; font-size: 10px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.1em; }
        .tier-name { font-size: 22px; margin-bottom: 8px; }
        .tier-desc { font-size: 13px; color: #888; margin-bottom: 24px; }
        .tier-features { list-style: none; padding: 0; margin: 0; text-align: left; }
        .tier-features li { padding: 8px 0; border-bottom: 0.5px solid #2a2a2a; font-size: 14px; color: #ccc; }
        .tier-features li::before { content: '✓'; color: #CC2222; margin-right: 8px; font-weight: bold; }

        .form-section { background: #0d0d0d; border-top: 0.5px solid #1a1a1a; }
        .lead-box { max-width: 500px; margin: 0 auto; background: #1a1a1a; padding: 40px; border-radius: 12px; border: 0.5px solid #2a2a2a; }
        .lead-title { font-size: 24px; margin-bottom: 8px; }
        .lead-sub { font-size: 14px; color: #888; margin-bottom: 24px; line-height: 1.5; }
        .form-group { margin-bottom: 16px; text-align: left; }
        .form-group label { display: block; font-size: 11px; color: #888; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        .form-group input, .form-group select, .form-group textarea { width: 100%; padding: 12px; background: #111; border: 0.5px solid #2a2a2a; border-radius: 8px; color: #fff; font-size: 14px; outline: none; font-family: inherit; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: #CC2222; }
        .sleek-textarea { resize: vertical; min-height: 80px; }
        
        .success-msg { text-align: center; padding: 40px 20px; }
        .success-msg h3 { font-size: 24px; color: #4ade80; margin-bottom: 16px; }
        .success-msg p { font-size: 15px; color: #ccc; line-height: 1.5; }

        .cta-btn { display: block; width: 100%; padding: 16px; background: #25D366; color: #111; border: none; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; transition: background 0.2s; margin-top: 24px; }
        .cta-btn:hover:not(:disabled) { background: #22c35c; }
        .cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (min-width: 768px) {
          .tiers-grid { grid-template-columns: repeat(3, 1fr); }
          .hero { padding: 100px 20px; }
        }
      `}</style>
    </div>
  )
}
