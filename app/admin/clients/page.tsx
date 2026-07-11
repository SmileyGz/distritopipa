'use client'
// app/admin/clients/page.tsx
// ─────────────────────────────────────────────────────────────
// Client CRM - group orders by phone to calculate VIP tiers.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { adminFetch } from '@/hooks/useAdmin'
import { getVIPStatus, getTierColor, getTierIcon, type VIPStatus } from '@/lib/clients'

interface Order {
  id: string
  order_number: string
  status: string
  customer_name: string
  customer_phone: string
  customer_email?: string
  total_mxn: number
  created_at: string
}

interface ClientProfile {
  phone: string
  name: string
  email?: string
  totalSpent: number      // VIP progress (Real spent + Points)
  realSpent: number       // Real money spent
  orderCount: number
  lastOrderDate: string
  vipStatus: VIPStatus
  orders: Order[]
  communityPoints: number
  questionsCount: number
  answersCount: number
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingPhone, setEditingPhone] = useState<string | null>(null)
  const [newPhoneVal, setNewPhoneVal] = useState('')
  const [birthdays, setBirthdays] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    let orders: Order[] = []

    // Load birthdays from local storage (acting as our CRM metadata store for now)
    const storedBirthdays = JSON.parse(localStorage.getItem('dp_client_birthdays') || '{}')
    setBirthdays(storedBirthdays)

    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      orders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
    } else {
      try {
        const res = await adminFetch('/api/admin/orders')
        const json = await res.json()
        if (res.ok && json.orders) {
          orders = json.orders as Order[]
        }
      } catch (err) {
        console.error(err)
      }
    }

    // Group by phone
    const grouped = orders.reduce((acc, order) => {
      // Normalizar teléfono
      const cp = order.customer_phone || ''
      const phone = cp.replace(/\D/g, '') || cp
      if (!acc[phone]) {
        acc[phone] = {
          phone: phone,
          name: order.customer_name,
          email: order.customer_email,
          totalSpent: 0,
          orderCount: 0,
          lastOrderDate: order.created_at,
          orders: [],
        }
      }
      
      // Solo sumamos dinero de órdenes que no estén canceladas
      if (order.status !== 'cancelled') {
        acc[phone].totalSpent += order.total_mxn
        acc[phone].orderCount += 1
      }
      
      acc[phone].orders.push(order)
      
      // Actualizar nombre si el más reciente tiene un nombre diferente
      if (new Date(order.created_at) > new Date(acc[phone].lastOrderDate)) {
        acc[phone].name = order.customer_name
        acc[phone].lastOrderDate = order.created_at
        if (order.customer_email) acc[phone].email = order.customer_email
      }
      
      return acc
    }, {} as Record<string, any>)

    // Calculate gamification points to add to totalSpent
    const posts = JSON.parse(localStorage.getItem('dp_mock_community_posts') || '[]')
    const answerCounts: Record<string, number> = {}
    const questionCounts: Record<string, number> = {}
    const communityNames: Record<string, string> = {}
    
    posts.forEach((p: any) => {
      const authorPhone = p.author.phone.replace(/\D/g, '')
      questionCounts[authorPhone] = (questionCounts[authorPhone] || 0) + 1
      communityNames[authorPhone] = p.author.nickname

      p.answers.forEach((ans: any) => {
        const ansAuthorPhone = ans.author.phone.replace(/\D/g, '')
        answerCounts[ansAuthorPhone] = (answerCounts[ansAuthorPhone] || 0) + 1
        communityNames[ansAuthorPhone] = ans.author.nickname
      })
    })

    // Add users from community who don't have orders yet
    Object.keys(communityNames).forEach(phone => {
      if (!grouped[phone]) {
        grouped[phone] = {
          phone,
          name: `${communityNames[phone]} (Comunidad)`,
          email: '',
          totalSpent: 0, // No real money spent yet
          orderCount: 0,
          lastOrderDate: new Date().toISOString(),
          orders: [],
        }
      }
    })

    // Convert to array and calculate VIP status including gamification points
    const clientsList: ClientProfile[] = Object.values(grouped).map((c: any) => {
      const qCount = questionCounts[c.phone] || 0
      const aCount = answerCounts[c.phone] || 0
      const gamificationPoints = aCount * 40
      const newTotalSpent = c.totalSpent + gamificationPoints
      
      return {
        ...c,
        realSpent: c.totalSpent,
        totalSpent: newTotalSpent,
        communityPoints: gamificationPoints,
        questionsCount: qCount,
        answersCount: aCount,
        vipStatus: getVIPStatus(newTotalSpent)
      }
    })

    // Sort by total spent descending
    clientsList.sort((a, b) => b.totalSpent - a.totalSpent)
    
    setClients(clientsList)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Filter clients
  const filtered = clients.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
    (c.phone || '').includes(searchTerm)
  )

  const handleUpdatePhone = async (oldPhone: string, newPhone: string) => {
    if (!newPhone || newPhone === oldPhone) {
      setEditingPhone(null)
      return
    }

    if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://dummy.supabase.co' || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
      const mockOrders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
      const updated = mockOrders.map((o: any) => o.customer_phone.replace(/\D/g, '') === oldPhone ? { ...o, customer_phone: newPhone } : o)
      localStorage.setItem('dp_mock_orders', JSON.stringify(updated))
    } else {
      // TODO: Implement phone number update via an API route that updates the customers table
      console.warn('Phone number updates are currently disabled pending CRM migration')
    }
    
    setEditingPhone(null)
    load()
  }

  const handleUpdateBirthday = (phone: string, birthday: string) => {
    const updated = { ...birthdays, [phone]: birthday }
    setBirthdays(updated)
    localStorage.setItem('dp_client_birthdays', JSON.stringify(updated))
  }

  const counts = {
    total: clients.length,
    oro: clients.filter(c => c.vipStatus.tier === 'Oro').length,
    plata: clients.filter(c => c.vipStatus.tier === 'Plata').length,
    bronce: clients.filter(c => c.vipStatus.tier === 'Bronce').length,
  }

  return (
    <div className="clients-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Gestión CRM</div>
          <h1 className="page-title">Directorio de Clientes</h1>
        </div>
        <button className="btn-ghost" onClick={load}>↺ Actualizar</button>
      </div>

      {/* ── STATS ── */}
      <div className="stats-row">
        <div className="stat">
          <div className="stat-val" style={{ color: '#60a5fa' }}>{counts.total}</div>
          <div className="stat-label">Total Clientes</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: getTierColor('Oro') }}>{counts.oro}</div>
          <div className="stat-label">🥇 Oro</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: getTierColor('Plata') }}>{counts.plata}</div>
          <div className="stat-label">🥈 Plata</div>
        </div>
        <div className="stat">
          <div className="stat-val" style={{ color: getTierColor('Bronce') }}>{counts.bronce}</div>
          <div className="stat-label">🥉 Bronce</div>
        </div>
      </div>

      <div className="search-bar">
        <input 
          type="text" 
          placeholder="Buscar por nombre o teléfono..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      <div className="client-list">
        {loading && <div className="loading">Analizando historial de clientes...</div>}
        {!loading && filtered.length === 0 && (
          <div className="empty">No se encontraron clientes.</div>
        )}

        {filtered.map(client => {
          const isExpanded = expanded === client.phone
          const tierColor = getTierColor(client.vipStatus.tier)
          
          return (
            <div key={client.phone} className="client-card">
              <div className="card-head">
                <div className="head-left" onClick={() => setExpanded(isExpanded ? null : client.phone)}>
                  <div className="client-name">{client.name}</div>
                  
                  {editingPhone === client.phone ? (
                    <div className="edit-phone-box" onClick={e => e.stopPropagation()}>
                      <input 
                        type="tel" 
                        value={newPhoneVal} 
                        onChange={e => setNewPhoneVal(e.target.value)}
                        className="sleek-input"
                        autoFocus
                      />
                      <button className="btn-ghost" onClick={() => handleUpdatePhone(client.phone, newPhoneVal)}>Guardar</button>
                    </div>
                  ) : (
                    <div className="client-phone">
                      {client.phone} 
                      <button className="edit-icon-btn" onClick={(e) => {
                        e.stopPropagation()
                        setEditingPhone(client.phone)
                        setNewPhoneVal(client.phone)
                      }}>✏️</button>
                    </div>
                  )}
                </div>
                
                <div className="head-right" onClick={() => setExpanded(isExpanded ? null : client.phone)}>
                  {client.vipStatus.tier !== 'Ninguno' && (
                    <span 
                      className="tier-badge" 
                      style={{ 
                        color: tierColor, 
                        borderColor: tierColor, 
                        background: `${tierColor}11` 
                      }}
                    >
                      {getTierIcon(client.vipStatus.tier)} {client.vipStatus.tier}
                    </span>
                  )}
                  <div className="spent-col">
                    <span className="spent-val">${client.totalSpent.toLocaleString('es-MX')}</span>
                    <span className="order-count">{client.orderCount} {client.orderCount === 1 ? 'pedido' : 'pedidos'}</span>
                  </div>
                  <span className="expand-icon">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {isExpanded && (
                <div className="card-detail">
                  {/* Desglose VIP y Comunidad */}
                  <div className="detail-grid">
                    <div className="detail-section">
                      <div className="detail-section-title">Progreso VIP</div>
                      <div className="vip-breakdown">
                        <div className="breakdown-item">
                          <span>Compras en Tienda:</span>
                          <strong>${client.realSpent.toLocaleString('es-MX')}</strong>
                        </div>
                        <div className="breakdown-item">
                          <span>Puntos de Comunidad:</span>
                          <strong style={{ color: '#DC143C' }}>+${client.communityPoints.toLocaleString('es-MX')}</strong>
                        </div>
                        <div className="breakdown-total">
                          <span>Valor Total VIP:</span>
                          <strong>${client.totalSpent.toLocaleString('es-MX')}</strong>
                        </div>
                      </div>

                      {client.vipStatus.nextTier ? (
                        <div className="progress-box" style={{ marginTop: 12 }}>
                          <div className="progress-text">
                            Faltan <strong>${client.vipStatus.amountToNextTier?.toLocaleString('es-MX')}</strong> para nivel <strong>{client.vipStatus.nextTier}</strong>.
                          </div>
                          <div className="progress-bar-bg">
                            <div 
                              className="progress-bar-fill" 
                              style={{ 
                                width: `${Math.min(100, (client.totalSpent / (client.totalSpent + (client.vipStatus.amountToNextTier || 1))) * 100)}%`,
                                background: getTierColor(client.vipStatus.nextTier)
                              }} 
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="progress-text" style={{ color: getTierColor('Oro'), marginTop: 12 }}>
                          ¡Alcanzó el nivel máximo (Oro)!
                        </div>
                      )}
                    </div>

                    <div className="detail-section">
                      <div className="detail-section-title">💬 Actividad en Comunidad</div>
                      <div className="community-stats">
                        <div className="comm-stat">
                          <span className="comm-icon">❓</span>
                          <div>
                            <strong>{client.questionsCount}</strong>
                            <span>Preguntas</span>
                          </div>
                        </div>
                        <div className="comm-stat">
                          <span className="comm-icon">💡</span>
                          <div>
                            <strong>{client.answersCount}</strong>
                            <span>Respuestas</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="detail-section" style={{ marginTop: 16 }}>
                    <div className="detail-section-title">Historial de Pedidos</div>
                    {/* CRM Metadata (Birthday) */}
                    <div className="crm-metadata">
                      <label className="metadata-label">🎂 Cumpleaños:</label>
                      <input 
                        type="date" 
                        className="metadata-input"
                        value={birthdays[client.phone] || ''}
                        onChange={e => handleUpdateBirthday(client.phone, e.target.value)}
                      />
                    </div>
                    
                    <div className="orders-timeline">
                      {client.orders.map(o => (
                        <div key={o.id} className={`history-row ${o.status === 'cancelled' ? 'cancelled' : ''}`}>
                          <span className="h-num">{o.order_number}</span>
                          <span className="h-date">{new Date(o.created_at).toLocaleDateString('es-MX')}</span>
                          <span className="h-status">{o.status}</span>
                          <span className="h-total">${o.total_mxn.toLocaleString('es-MX')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="card-actions" style={{ marginTop: 16, display: 'flex', gap: '8px' }}>
                    <a 
                      className="btn-whatsapp-sm" 
                      href={`https://wa.me/${client.phone.replace(/\D/g,'')}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      💬 Enviar WhatsApp
                    </a>
                    <button
                      className="btn-whatsapp-sm"
                      style={{ background: 'transparent', border: '1px solid #f87171', color: '#f87171' }}
                      onClick={async () => {
                        if (confirm(`¿Estás seguro de que quieres eliminar a ${client.name} y TODOS sus pedidos?`)) {
                          const res = await adminFetch(`/api/admin/clients?phone=${encodeURIComponent(client.phone)}`, { method: 'DELETE' })
                          if (res.ok) load()
                          else alert('Error al eliminar el cliente.')
                        }
                      }}
                    >
                      🗑️ Eliminar Cliente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <style>{`
        .clients-page {
          min-height: 100vh;
          background: #111;
          color: #fff;
          padding-bottom: 80px;
        }

        .page-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 28px 20px 20px; border-bottom: 1px solid #2a2a2a;
        }
        .page-eyebrow { font-size: 10px; color: #888; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 3px; }
        .page-title { font-size: 22px; font-weight: 600; }

        .stats-row { display: flex; gap: 8px; padding: 16px 20px; flex-wrap: wrap; }
        .stat {
          background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 8px;
          padding: 10px 14px; text-align: center; min-width: 80px; flex: 1;
        }
        .stat-val { font-size: 20px; font-weight: 600; }
        .stat-label { font-size: 9px; color: #888; text-transform: uppercase; margin-top: 2px; }

        .search-bar { padding: 0 20px 16px; }
        .search-input {
          width: 100%; max-width: 400px; padding: 10px 14px; border-radius: 8px;
          background: #1a1a1a; border: 1px solid #2a2a2a; color: #fff; font-size: 14px;
        }
        .search-input:focus { outline: none; border-color: #CC2222; }

        .client-list { display: flex; flex-direction: column; gap: 8px; padding: 0 20px; }
        .loading, .empty { padding: 40px; text-align: center; color: #888; font-size: 14px; }

        .client-card {
          background: #1a1a1a; border: 0.5px solid #2a2a2a; border-radius: 10px; overflow: hidden;
          transition: border-color .15s;
        }
        .client-card:hover { border-color: #3a3a3a; }

        .card-head {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px; cursor: pointer; user-select: none; flex-wrap: wrap; gap: 10px;
        }
        .head-left { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .client-name { font-size: 15px; font-weight: 600; color: #fff; }
        .client-phone { font-size: 12px; color: #888; display: flex; align-items: center; gap: 6px; }
        
        .edit-icon-btn { background: none; border: none; font-size: 10px; cursor: pointer; opacity: 0.5; transition: opacity 0.2s; }
        .edit-icon-btn:hover { opacity: 1; }
        .edit-phone-box { display: flex; gap: 6px; align-items: center; margin-top: 4px; }
        .edit-phone-box .sleek-input { padding: 4px 8px; font-size: 12px; max-width: 120px; }
        
        .head-right { display: flex; align-items: center; gap: 14px; }
        .tier-badge {
          font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 12px;
          border: 1px solid; letter-spacing: .03em;
        }
        .spent-col { display: flex; flex-direction: column; align-items: flex-end; }
        .spent-val { font-size: 15px; font-weight: 600; color: #fff; }
        .order-count { font-size: 11px; color: #888; }
        .expand-icon { font-size: 10px; color: #555; }

        .card-detail {
          padding: 14px; border-top: 1px solid #2a2a2a;
        }

        .detail-section-title { font-size: 10px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }
        
        .detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 20px; }
        @media (max-width: 768px) { .detail-grid { grid-template-columns: 1fr; gap: 16px; } }
        
        .vip-breakdown { background: #111; border-radius: 8px; padding: 12px; font-size: 13px; display: flex; flex-direction: column; gap: 8px; border: 1px solid #2a2a2a; }
        .breakdown-item { display: flex; justify-content: space-between; color: #ccc; }
        .breakdown-total { display: flex; justify-content: space-between; color: #fff; margin-top: 4px; padding-top: 8px; border-top: 1px dashed #333; font-weight: 600; font-size: 14px; }
        
        .community-stats { display: flex; gap: 12px; }
        .comm-stat { flex: 1; background: #111; border: 1px solid #2a2a2a; border-radius: 8px; padding: 12px; display: flex; align-items: center; gap: 12px; }
        .comm-icon { font-size: 24px; }
        .comm-stat div { display: flex; flex-direction: column; }
        .comm-stat strong { font-size: 18px; color: #fff; line-height: 1; }
        .comm-stat span { font-size: 11px; color: #888; margin-top: 4px; }
        
        .progress-box { background: #111; padding: 12px; border-radius: 8px; }
        .progress-text { font-size: 12px; color: #ccc; margin-bottom: 8px; }
        .progress-text strong { color: #fff; }
        .progress-bar-bg { height: 6px; background: #2a2a2a; border-radius: 3px; overflow: hidden; }
        .progress-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
        
        .crm-metadata { display: flex; align-items: center; gap: 8px; margin-bottom: 20px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); }
        .metadata-label { font-size: 13px; color: #aaa; font-weight: 500; }
        .metadata-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 6px 10px; border-radius: 6px; font-size: 13px; color-scheme: dark; outline: none; transition: border-color 0.2s; }
        .metadata-input:focus { border-color: #60a5fa; }

        .orders-timeline { display: flex; flex-direction: column; gap: 4px; }
        .history-row {
          display: flex; justify-content: space-between; align-items: center;
          background: #111; padding: 8px 12px; border-radius: 6px; font-size: 12px;
        }
        .history-row.cancelled { opacity: 0.5; text-decoration: line-through; }
        .h-num { font-weight: 600; color: #fff; width: 60px; }
        .h-date { color: #888; flex: 1; }
        .h-status { color: #888; text-transform: capitalize; width: 80px; text-align: center; }
        .h-total { font-weight: 500; color: #4ade80; text-align: right; width: 80px; }

        .btn-whatsapp-sm {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 7px; font-size: 12px; font-weight: 600;
          background: #25D366; color: #fff; text-decoration: none; border: none; cursor: pointer;
        }
        .btn-whatsapp-sm:hover { background: #22c35c; }
        .btn-ghost {
          padding: 8px 14px; border-radius: 7px; font-size: 12px; cursor: pointer;
          background: transparent; color: #888; border: 0.5px solid #2a2a2a; transition: all .15s;
        }
        .btn-ghost:hover { color: #fff; }
      `}</style>
    </div>
  )
}
