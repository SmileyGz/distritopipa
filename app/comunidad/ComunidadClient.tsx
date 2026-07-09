'use client'
import { useState, useEffect } from 'react'

type UserProfile = { phone: string, nickname: string }
export type Answer = { id: string, author: UserProfile, content: string, upvotes: number }
export type Post = { id: string, author: UserProfile, content: string, upvotes: number, answers: Answer[] }

function getVIPTierByPhone(phone: string): string {
  if (typeof window === 'undefined') return 'Nuevo'
  
  // 1. Calculate Spent (using mock orders for demo, should be fetched in reality)
  const orders = JSON.parse(localStorage.getItem('dp_mock_orders') || '[]')
  let totalSpent = 0
  const normalizedSearch = phone.replace(/\D/g, '')
  for (const order of orders) {
    if (order.status !== 'cancelled') {
      const orderPhone = (order.customer_phone || '').replace(/\D/g, '')
      if (orderPhone && orderPhone === normalizedSearch) {
        totalSpent += order.total_mxn || 0
      }
    }
  }

  if (totalSpent >= 10000) return 'Oro'
  if (totalSpent >= 5000) return 'Plata'
  if (totalSpent >= 2500) return 'Bronce'
  return 'Nuevo'
}

export default function ComunidadClient({ initialPosts }: { initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  
  // Login State
  const [inputPhone, setInputPhone] = useState('')
  const [inputNickname, setInputNickname] = useState('')
  const [needsNickname, setNeedsNickname] = useState(false)
  
  // Post State
  const [newPostContent, setNewPostContent] = useState('')
  const [replyContent, setReplyContent] = useState<Record<string, string>>({})

  useEffect(() => {
    // Load User Session
    const storedUser = localStorage.getItem('dp_community_user')
    if (storedUser) {
      setUserProfile(JSON.parse(storedUser))
    }
  }, [])

  const handlePhoneCheck = () => {
    if (!inputPhone.trim()) return
    const users = JSON.parse(localStorage.getItem('dp_community_users_dict') || '{}')
    if (users[inputPhone]) {
      const profile = { phone: inputPhone, nickname: users[inputPhone] }
      setUserProfile(profile)
      localStorage.setItem('dp_community_user', JSON.stringify(profile))
    } else {
      setNeedsNickname(true)
    }
  }

  const handleCreateProfile = () => {
    if (!inputNickname.trim()) return
    const profile = { phone: inputPhone, nickname: inputNickname.trim() }
    const users = JSON.parse(localStorage.getItem('dp_community_users_dict') || '{}')
    users[inputPhone] = profile.nickname
    localStorage.setItem('dp_community_users_dict', JSON.stringify(users))
    setUserProfile(profile)
    localStorage.setItem('dp_community_user', JSON.stringify(profile))
  }

  const handleLogout = () => {
    setUserProfile(null)
    localStorage.removeItem('dp_community_user')
    setInputPhone('')
    setInputNickname('')
    setNeedsNickname(false)
  }

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userProfile || !newPostContent.trim()) return
    
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userProfile.nickname,
          content: newPostContent,
          customer_id: userProfile.phone,
        })
      })
      if (!res.ok) throw new Error('Error al publicar')
      
      const data = await res.json()
      
      // Optimistic update
      const post: Post = {
        id: data.post_id || Math.random().toString(),
        author: userProfile,
        content: newPostContent,
        upvotes: 0,
        answers: []
      }
      setPosts([post, ...posts])
      setNewPostContent('')
    } catch (err) {
      console.error(err)
      alert("Hubo un problema publicando tu duda.")
    }
  }

  const handleReply = async (postId: string) => {
    if (!userProfile) {
      alert("Inicia sesión arriba para responder.")
      return
    }
    const content = replyContent[postId]
    if (!content?.trim()) return
    
    try {
      const res = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: userProfile.nickname,
          content,
          parent_id: postId,
          customer_id: userProfile.phone,
        })
      })
      if (!res.ok) throw new Error('Error al responder')
      
      const data = await res.json()
      
      const answer: Answer = {
        id: data.post_id || Math.random().toString(),
        author: userProfile,
        content,
        upvotes: 0
      }
      
      const newPosts = posts.map(p => {
        if (p.id === postId) {
          return { ...p, answers: [...p.answers, answer] }
        }
        return p
      })
      setPosts(newPosts)
      setReplyContent({ ...replyContent, [postId]: '' })
    } catch (err) {
      console.error(err)
      alert("Hubo un problema publicando tu respuesta.")
    }
  }

  return (
    <main className="barrio-page">
      <div className="barrio-container">
        {/* HEADER */}
        <header className="barrio-header">
          <h1>Comunidad</h1>
          <p>Sube de Nivel. Tira Paro. Resuelve Dudas.</p>
        </header>

        {/* POINTS BANNER */}
        <div className="points-banner">
          <span className="banner-icon">🔥</span>
          <div className="banner-text">
            <strong>¡Gana Puntos VIP!</strong>
            <p>Cada vez que respondes a una duda, sumas <strong className="highlight">$40 en progreso</strong> para subir de Nivel VIP. ¡Tu sabiduría te premia!</p>
          </div>
        </div>

        {/* AUTH SECTION */}
        {!userProfile ? (
          <section className="auth-section">
            <h3>Identifícate para participar</h3>
            <p className="auth-sub">Solo necesitas tu número de WhatsApp. Si ya has comprado antes, tu nivel VIP (Bronce, Plata, Oro) aparecerá automáticamente en tus posts.</p>
            {!needsNickname ? (
              <div className="auth-box">
                <input 
                  type="tel" 
                  placeholder="Tu número de WhatsApp (ej. 5512345678)" 
                  value={inputPhone} 
                  onChange={e => setInputPhone(e.target.value)} 
                  className="auth-input"
                />
                <button onClick={handlePhoneCheck} className="btn-auth">Continuar</button>
              </div>
            ) : (
              <div className="auth-box">
                <p style={{marginBottom: 10, fontSize: 13, color: '#DC143C'}}>¡Número nuevo! ¿Cómo quieres que te llamemos?</p>
                <input 
                  type="text" 
                  placeholder="Tu Apodo (Público)" 
                  value={inputNickname} 
                  onChange={e => setInputNickname(e.target.value)} 
                  className="auth-input"
                />
                <button onClick={handleCreateProfile} className="btn-auth">Crear Perfil</button>
              </div>
            )}
          </section>
        ) : (
          <div className="user-bar">
            <span>Conectado como <strong>@{userProfile.nickname}</strong> (Nivel: {getVIPTierByPhone(userProfile.phone)})</span>
            <button onClick={handleLogout} className="btn-logout">Cambiar usuario</button>
          </div>
        )}

        {/* POSTING FORM */}
        {userProfile && (
          <section className="post-form-section">
            <form onSubmit={handlePost} className="glass-form">
              <div className="form-header">
                <span className="posting-as">Publicando como @{userProfile.nickname}</span>
                <TierBadge tier={getVIPTierByPhone(userProfile.phone)} />
              </div>
              <textarea 
                placeholder="Escribe tu pregunta a la comunidad..."
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                className="premium-textarea"
              />
              <div className="form-footer">
                <button type="submit" disabled={!newPostContent.trim()} className="btn-post-premium">Publicar</button>
              </div>
            </form>
          </section>
        )}

        {/* MASONRY WALL OF POSTS */}
        <section className="wall-grid">
          {posts.map((q) => {
            const qTier = getVIPTierByPhone(q.author.phone);
            return (
              <article key={q.id} className={`glass-card tier-border-${qTier.toLowerCase()}`}>
                <div className="card-header">
                  <span className="author-name">@{q.author.nickname}</span>
                  <TierBadge tier={qTier} />
                </div>
                <h2>{q.content}</h2>
                
                <div className="answers-container">
                  {q.answers.length === 0 ? (
                    <div className="empty-answers">
                       <p>Nadie ha respondido esto todavía. Sé el primero en tirar paro.</p>
                    </div>
                  ) : (
                    q.answers.map((ans) => {
                      const ansTier = getVIPTierByPhone(ans.author.phone);
                      return (
                        <div key={ans.id} className="answer-glass">
                           <div className="answer-header">
                             <span className="answer-author">@{ans.author.nickname}</span>
                             <TierBadge tier={ansTier} small />
                           </div>
                           <p>{ans.content}</p>
                        </div>
                      )
                    })
                  )}
                </div>

                {/* Add Answer Input */}
                {userProfile && (
                  <div className="add-reply">
                    <input 
                      type="text" 
                      placeholder="Escribe tu respuesta..." 
                      className="reply-input" 
                      value={replyContent[q.id] || ''}
                      onChange={e => setReplyContent({...replyContent, [q.id]: e.target.value})}
                    />
                    <button onClick={() => handleReply(q.id)} className="btn-reply">Responder</button>
                  </div>
                )}
              </article>
            )
          })}
        </section>
      </div>

      <style>{`
        .barrio-page { min-height: 100vh; background: radial-gradient(circle at top right, #1a0505, #000000 60%); padding: 60px 20px; color: #fff; font-family: var(--font-inter), sans-serif; }
        .barrio-container { max-width: 800px; margin: 0 auto; }
        
        .barrio-header { text-align: center; margin-bottom: 30px; }
        .barrio-header h1 { font-family: var(--font-bebas), sans-serif; font-size: 72px; color: #fff; line-height: 1; letter-spacing: 1px; text-shadow: 0 0 20px rgba(220, 20, 60, 0.4); margin-bottom: 10px; }
        .barrio-header p { font-size: 18px; color: #aaa; font-weight: 300; }

        .points-banner { background: linear-gradient(135deg, rgba(220, 20, 60, 0.2), rgba(0,0,0,0.5)); border: 1px solid rgba(220, 20, 60, 0.4); border-radius: 12px; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; margin-bottom: 40px; text-align: center; }
        .banner-icon { font-size: 42px; }
        .banner-text strong { color: #fff; font-size: 18px; display: block; margin-bottom: 8px; }
        .banner-text p { color: #ccc; font-size: 14px; margin: 0; line-height: 1.4; }
        .banner-text .highlight { display: inline; color: #DC143C; font-size: 16px; text-transform: uppercase; margin: 0 4px; font-weight: 700; }

        /* AUTH SECTION */
        .auth-section { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px 24px; text-align: center; margin-bottom: 50px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
        .auth-section h3 { font-size: 24px; margin-bottom: 12px; font-weight: 600; }
        .auth-sub { font-size: 15px; color: #888; margin-bottom: 24px; max-width: 500px; margin-inline: auto; line-height: 1.5; }
        .auth-box { display: flex; flex-direction: column; gap: 12px; max-width: 320px; margin: 0 auto; }
        .auth-input { padding: 14px 16px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; color: #fff; font-size: 16px; text-align: center; outline: none; transition: border-color 0.3s; }
        .auth-input:focus { border-color: #DC143C; }
        .btn-auth { padding: 14px; background: #DC143C; color: #fff; border: none; border-radius: 8px; font-weight: 600; font-size: 16px; cursor: pointer; transition: background 0.3s, transform 0.2s; }
        .btn-auth:hover { background: #ff1a4b; transform: translateY(-2px); }
        
        .user-bar { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.05); padding: 16px 24px; border-radius: 12px; margin-bottom: 40px; border-left: 4px solid #DC143C; font-size: 14px; backdrop-filter: blur(5px); }
        .btn-logout { background: transparent; color: #aaa; border: 1px solid rgba(255,255,255,0.2); padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
        .btn-logout:hover { background: rgba(255,255,255,0.1); color: #fff; }

        /* POST FORM */
        .glass-form { background: rgba(20,20,20,0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 24px; margin-bottom: 50px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 16px; }
        .posting-as { font-size: 14px; color: #aaa; }
        .premium-textarea { width: 100%; min-height: 100px; background: transparent; border: none; font-family: var(--font-inter), sans-serif; font-size: 18px; color: #fff; resize: vertical; outline: none; font-weight: 400; line-height: 1.5; }
        .premium-textarea::placeholder { color: #555; }
        .form-footer { display: flex; justify-content: flex-end; margin-top: 16px; }
        .btn-post-premium { background: linear-gradient(135deg, #DC143C, #8b0000); color: #fff; border: none; border-radius: 30px; padding: 12px 32px; font-weight: 600; font-size: 16px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(220, 20, 60, 0.4); }
        .btn-post-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(220, 20, 60, 0.6); }
        .btn-post-premium:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; transform: none; }

        /* WALL GRID */
        .wall-grid { display: flex; flex-direction: column; gap: 32px; }
        .glass-card { background: rgba(255,255,255,0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; position: relative; transition: transform 0.3s, box-shadow 0.3s; }
        .glass-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.6); }
        
        /* Tier Borders for Cards */
        .tier-border-oro { border-top: 2px solid #ffd700; box-shadow: 0 -4px 20px rgba(255, 215, 0, 0.1); }
        .tier-border-plata { border-top: 2px solid #e0e0e0; }
        .tier-border-bronce { border-top: 2px solid #cd7f32; }

        .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
        .author-name { font-weight: 700; font-size: 16px; color: #DC143C; letter-spacing: 0.5px; }
        .glass-card h2 { font-family: var(--font-bebas), sans-serif; font-size: 32px; line-height: 1.2; color: #fff; margin-bottom: 24px; letter-spacing: 0.5px; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }

        /* ANSWERS */
        .answers-container { display: flex; flex-direction: column; gap: 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 24px; }
        .answer-glass { background: rgba(0,0,0,0.3); border-radius: 12px; padding: 16px; border: 1px solid rgba(255,255,255,0.05); }
        .answer-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .answer-author { font-size: 13px; color: #aaa; font-weight: 600; }
        .answer-glass p { margin: 0; line-height: 1.5; font-size: 15px; color: #ddd; }
        
        .empty-answers { text-align: center; padding: 20px; color: #666; font-style: italic; font-size: 14px; }
        
        .add-reply { display: flex; gap: 12px; margin-top: 24px; }
        .reply-input { flex: 1; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.2); padding: 12px 16px; border-radius: 30px; font-size: 14px; color: #fff; outline: none; transition: border-color 0.3s; }
        .reply-input:focus { border-color: #DC143C; }
        .btn-reply { background: rgba(255,255,255,0.1); color: #fff; border: 1px solid rgba(255,255,255,0.2); border-radius: 30px; padding: 0 20px; cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; }
        .btn-reply:hover { background: #fff; color: #000; }

        /* PREMIUM BADGES */
        .premium-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px); }
        .premium-badge.small { padding: 2px 8px; font-size: 10px; gap: 4px; }
        
        .premium-badge.oro { background: linear-gradient(135deg, rgba(255,215,0,0.2), rgba(218,165,32,0.1)); border-color: rgba(255,215,0,0.5); color: #ffd700; box-shadow: 0 0 10px rgba(255,215,0,0.2); }
        .premium-badge.plata { background: linear-gradient(135deg, rgba(224,224,224,0.2), rgba(153,153,153,0.1)); border-color: rgba(224,224,224,0.5); color: #e0e0e0; }
        .premium-badge.bronce { background: linear-gradient(135deg, rgba(205,127,50,0.2), rgba(139,69,19,0.1)); border-color: rgba(205,127,50,0.5); color: #cd7f32; }
        .premium-badge.nuevo { background: rgba(255,255,255,0.05); color: #aaa; border-style: dashed; }
      `}</style>
    </main>
  )
}

function TierBadge({ tier, small = false }: { tier: string, small?: boolean }) {
  const t = tier.toLowerCase()
  const icon = tier === 'Oro' ? '👑' : tier === 'Plata' ? '🥈' : tier === 'Bronce' ? '🥉' : '👋'
  return (
    <div className={`premium-badge ${t} ${small ? 'small' : ''}`}>
      <span className="badge-icon">{icon}</span>
      <span className="badge-text">{tier.toUpperCase()}</span>
    </div>
  )
}
