'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { scanCopy } from '@/lib/complianceScanner';
import toast from 'react-hot-toast';

export type PublicationLogEntry = {
  id: string;
  channel: 'whatsapp_group' | 'whatsapp_broadcast' | 'marketplace' | 'facebook_group';
  target: string; // e.g. "Grupos de WhatsApp", "Difusión"
  posted_at: string; // ISO date
  notes?: string; // outcome / results
};

export default function CopyManagementPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  // Form fields
  const [title, setTitle] = useState('');
  const [draftCopy, setDraftCopy] = useState('');
  const [whatsappCopy, setWhatsappCopy] = useState('');
  const [fbMarketplaceCopy, setFbMarketplaceCopy] = useState('');
  const [status, setStatus] = useState<string>('draft');
  const [postingDate, setPostingDate] = useState<string>('');
  const [internalNotes, setInternalNotes] = useState('');
  const [publishingLog, setPublishingLog] = useState<PublicationLogEntry[]>([]);
  const [revisions, setRevisions] = useState<any[]>([]);
  
  // Quick Log modal / form state
  const [showLogModal, setShowLogModal] = useState(false);
  const [logChannel, setLogChannel] = useState<'whatsapp_group' | 'whatsapp_broadcast' | 'marketplace' | 'facebook_group'>('whatsapp_group');
  const [logNotes, setLogNotes] = useState('');

  // Filter & Search
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/copy');
      if (res.ok) {
        const json = await res.json();
        setDrafts(json.drafts || []);
        setDbError(null);
        return;
      }
      
      const { data, error } = await supabase
        .from('copy_drafts')
        .select('*, copy_revisions(*)')
        .order('created_at', { ascending: false });

      if (error) {
        setDbError(error.message);
      } else {
        setDrafts(data || []);
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message || 'Error conectando con la base de datos');
    } finally {
      setLoading(false);
    }
  }

  // Compliance rules
  const isMarketplaceActive = fbMarketplaceCopy.trim().length > 0;
  const isWhatsappActive = whatsappCopy.trim().length > 0;
  const isDraftActive = draftCopy.trim().length > 0;
  const hasAtLeastOneCopy = isMarketplaceActive || isWhatsappActive || isDraftActive;

  const compliance = scanCopy(fbMarketplaceCopy);
  const canSave = title.trim().length > 0 && hasAtLeastOneCopy && compliance.isValid;

  async function handleSave(customPayload?: Partial<any>) {
    if (!canSave && !customPayload) return;
    setSaving(true);
    
    const finalStatus = customPayload?.status || status;
    const finalLog = customPayload?.publishing_log || publishingLog;
    const finalPostingDate = customPayload?.posting_date || (postingDate ? new Date(postingDate).toISOString() : null);

    const payload = {
      ...(activeDraft?.id ? { id: activeDraft.id } : {}),
      title: title.trim(),
      draft_copy: draftCopy,
      whatsapp_copy: whatsappCopy,
      facebook_marketplace_copy: fbMarketplaceCopy,
      status: finalStatus,
      posting_date: finalPostingDate,
      internal_notes: internalNotes,
      publishing_log: finalLog,
      ...customPayload,
    };

    try {
      const res = await fetch('/api/admin/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const json = await res.json();
        toast.success(activeDraft?.id ? '✓ Guardado y sincronizado' : '✓ Creado con éxito');
        if (json.draft) {
          loadDraft(json.draft);
        } else {
          setActiveDraft(null);
          clearForm();
        }
        fetchDrafts();
        return;
      }

      // Fallback
      if (activeDraft?.id) {
        const { error } = await supabase.from('copy_drafts').update(payload).eq('id', activeDraft.id);
        if (error) throw error;
        toast.success('✓ Actualizado con éxito');
      } else {
        const { error } = await supabase.from('copy_drafts').insert([payload]);
        if (error) throw error;
        toast.success('✓ Guardado con éxito');
      }

      fetchDrafts();
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message || 'Verifica la conexión'));
    } finally {
      setSaving(false);
    }
  }

  // Register a publication event instantly (1-click, zero blockers)
  async function handleQuickRegister(channel: PublicationLogEntry['channel'] = 'whatsapp_group', optionalNote = '') {
    const channelNames: Record<PublicationLogEntry['channel'], string> = {
      whatsapp_group: 'Grupos de WhatsApp',
      whatsapp_broadcast: 'Lista de Difusión',
      marketplace: 'Facebook Marketplace',
      facebook_group: 'Grupos de Facebook',
    };

    const newEntry: PublicationLogEntry = {
      id: Date.now().toString(),
      channel,
      target: channelNames[channel],
      posted_at: new Date().toISOString(),
      notes: optionalNote.trim(),
    };

    const updatedLog = [newEntry, ...publishingLog];
    setPublishingLog(updatedLog);
    setStatus('posted');
    setPostingDate(new Date().toISOString().substring(0, 10));

    setShowLogModal(false);
    setLogNotes('');

    toast.success(`🚀 Envío a ${channelNames[channel]} registrado`);
    
    await handleSave({
      publishing_log: updatedLog,
      status: 'posted',
      posting_date: new Date().toISOString(),
    });
  }

  async function handleDeletePublication(entryId: string) {
    const updated = publishingLog.filter((p) => p.id !== entryId);
    setPublishingLog(updated);
    toast.success('Registro de envío removido');
    await handleSave({ publishing_log: updated });
  }

  // Revisions Eraser Handlers
  async function handleDeleteSingleRevision(revId: string) {
    if (!confirm('¿Eliminar esta versión específica del historial de texto?')) return;
    try {
      const res = await fetch(`/api/admin/copy?revision_id=${revId}`, { method: 'DELETE' });
      if (res.ok) {
        setRevisions((prev) => prev.filter((r) => r.id !== revId));
        toast.success('Versión eliminada del historial');
        fetchDrafts();
      } else {
        throw new Error('Error al eliminar revisión');
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo eliminar');
    }
  }

  async function handleClearAllRevisions() {
    if (!activeDraft?.id) return;
    if (!confirm(`¿Borrar TODO el historial de revisiones de texto para "${activeDraft.title}"? (Esta acción dejará limpio el historial de cambios)`)) return;
    
    try {
      const res = await fetch(`/api/admin/copy?clear_revisions_draft_id=${activeDraft.id}`, { method: 'DELETE' });
      if (res.ok) {
        setRevisions([]);
        toast.success('🗑️ Historial de revisiones de texto limpiado');
        fetchDrafts();
      } else {
        throw new Error('Error al limpiar revisiones');
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo limpiar');
    }
  }

  function handleRestoreRevision(text: string) {
    setFbMarketplaceCopy(text);
    toast.success('↺ Texto restaurado en el editor de Marketplace');
  }

  async function handleDelete() {
    if (!activeDraft?.id) return;
    if (!confirm(`¿Eliminar definitivamente el borrador "${activeDraft.title}"?`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/copy?id=${activeDraft.id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Borrador eliminado');
        clearForm();
        fetchDrafts();
      } else {
        throw new Error('Error al eliminar');
      }
    } catch (err: any) {
      toast.error(err.message || 'No se pudo eliminar');
    } finally {
      setDeleting(false);
    }
  }

  function clearForm() {
    setActiveDraft(null);
    setTitle('');
    setDraftCopy('');
    setWhatsappCopy('');
    setFbMarketplaceCopy('');
    setStatus('draft');
    setPostingDate('');
    setInternalNotes('');
    setPublishingLog([]);
    setRevisions([]);
  }

  function loadDraft(d: any) {
    setActiveDraft(d);
    setTitle(d.title || '');
    setDraftCopy(d.draft_copy || '');
    setWhatsappCopy(d.whatsapp_copy || '');
    setFbMarketplaceCopy(d.facebook_marketplace_copy || '');
    setStatus(d.status || 'draft');
    setPostingDate(d.posting_date ? d.posting_date.substring(0, 10) : '');
    setInternalNotes(d.internal_notes || '');
    setRevisions(d.copy_revisions || []);

    // Parse publishing log safely
    try {
      let log = d.publishing_log;
      if (typeof log === 'string') log = JSON.parse(log);
      setPublishingLog(Array.isArray(log) ? log : []);
    } catch {
      setPublishingLog([]);
    }
  }

  function copyToClipboard(text: string, label: string) {
    if (!text.trim()) {
      toast.error(`El copy de ${label} está vacío`);
      return;
    }
    navigator.clipboard.writeText(text);
    toast.success(`📋 ${label} copiado al portapapeles`);
  }

  // Sorted revisions: NEWEST at the top!
  const sortedRevisions = useMemo(() => {
    if (!revisions || revisions.length === 0) return [];
    return [...revisions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [revisions]);

  // Filtered drafts
  const filteredDrafts = useMemo(() => {
    return drafts.filter((d) => {
      const matchesStatus = filterStatus === 'all' || d.status === filterStatus;
      const q = searchQuery.toLowerCase().trim();
      const matchesQuery =
        !q ||
        d.title?.toLowerCase().includes(q) ||
        d.facebook_marketplace_copy?.toLowerCase().includes(q) ||
        d.whatsapp_copy?.toLowerCase().includes(q) ||
        d.internal_notes?.toLowerCase().includes(q);

      return matchesStatus && matchesQuery;
    });
  }, [drafts, filterStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    let totalPublications = 0;
    drafts.forEach((d) => {
      try {
        let pLog = d.publishing_log;
        if (typeof pLog === 'string') pLog = JSON.parse(pLog);
        if (Array.isArray(pLog)) totalPublications += pLog.length;
      } catch {}
    });

    return {
      total: drafts.length,
      posted: drafts.filter((d) => d.status === 'posted').length,
      approved: drafts.filter((d) => d.status === 'approved').length,
      draft: drafts.filter((d) => d.status === 'draft').length,
      totalPublications,
    };
  }, [drafts]);

  const channelBadges = {
    whatsapp_group: { label: '📱 WhatsApp Grupos', color: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
    whatsapp_broadcast: { label: '💬 WhatsApp Difusión', color: 'bg-teal-950 text-teal-300 border-teal-800' },
    marketplace: { label: '🛒 FB Marketplace', color: 'bg-orange-950 text-orange-300 border-orange-800' },
    facebook_group: { label: '👥 FB Grupos', color: 'bg-blue-950 text-blue-300 border-blue-800' },
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto text-white">
      {/* Top Brand Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-zinc-800 gap-4">
        <div>
          <div className="text-xs tracking-widest text-[#DC143C] font-bold uppercase mb-1">
            Gestión Editorial & Tracking de Redes
          </div>
          <h1 className="text-3xl font-black tracking-tight">Copy Content Manager</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Guarda tus copies maestros, valida compliance y registra cada vez que los reenvías a Grupos de WhatsApp o Marketplace.
          </p>
        </div>
        <button
          onClick={clearForm}
          className="bg-[#DC143C] hover:bg-red-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-red-900/20 flex items-center gap-2"
        >
          <span>+</span> Nuevo Registro de Copy
        </button>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 my-6">
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] uppercase font-bold text-zinc-400">Copies Maestros</span>
          <p className="text-2xl font-black text-white mt-1">{stats.total}</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] uppercase font-bold text-emerald-400">🚀 Total Re-envíos Registrados</span>
          <p className="text-2xl font-black text-emerald-400 mt-1">{stats.totalPublications}</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] uppercase font-bold text-blue-400">🟢 Listos para Difundir</span>
          <p className="text-2xl font-black text-blue-400 mt-1">{stats.approved}</p>
        </div>
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
          <span className="text-[11px] uppercase font-bold text-amber-400">🟡 En Borrador</span>
          <p className="text-2xl font-black text-amber-400 mt-1">{stats.draft}</p>
        </div>
      </div>

      {/* Database Notice if applicable */}
      {dbError && (
        <div className="mb-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Aviso de Base de Datos</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Si acabas de añadir nuevas columnas, verifica haber corrido el script en el SQL Editor de Supabase.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Explorer & Filters */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 backdrop-blur-sm flex flex-col h-fit max-h-[860px]">
          {/* Search bar */}
          <div className="mb-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Buscar por título o contenido..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#DC143C]"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-zinc-800 text-[11px]">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'posted', label: '🚀 Publicados' },
              { id: 'approved', label: '🟢 Listos' },
              { id: 'draft', label: '🟡 Borradores' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-zinc-800 text-white border border-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="text-center py-12 text-zinc-500 text-sm">Cargando base de datos...</div>
            ) : filteredDrafts.length === 0 ? (
              <div className="text-center py-12 text-zinc-500 text-sm">
                <p>No se encontraron registros.</p>
                <p className="text-xs text-zinc-600 mt-1">Crea uno nuevo a la derecha.</p>
              </div>
            ) : (
              filteredDrafts.map((d) => {
                let pCount = 0;
                try {
                  let pLog = d.publishing_log;
                  if (typeof pLog === 'string') pLog = JSON.parse(pLog);
                  if (Array.isArray(pLog)) pCount = pLog.length;
                } catch {}

                return (
                  <div
                    key={d.id}
                    onClick={() => loadDraft(d)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      activeDraft?.id === d.id
                        ? 'bg-zinc-800/90 border-[#DC143C] shadow-md shadow-red-950/20'
                        : 'bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm text-zinc-100 truncate flex-1">{d.title}</h3>
                      <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        d.status === 'posted'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/50'
                          : d.status === 'approved'
                          ? 'bg-blue-950 text-blue-400 border border-blue-800/50'
                          : 'bg-amber-950 text-amber-400 border border-amber-800/50'
                      }`}>
                        {d.status === 'posted' ? 'Publicado' : d.status === 'approved' ? 'Listo' : 'Borrador'}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-400 line-clamp-2 mt-1.5">
                      {d.whatsapp_copy || d.facebook_marketplace_copy || d.draft_copy || 'Sin contenido aún...'}
                    </p>

                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        {d.whatsapp_copy && <span className="text-[10px] bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 px-1 rounded">WA</span>}
                        {d.facebook_marketplace_copy && <span className="text-[10px] bg-orange-900/40 text-orange-400 border border-orange-800/50 px-1 rounded">FB</span>}
                        {pCount > 0 && (
                          <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800/50 px-1.5 rounded-full font-bold">
                            {pCount}x
                          </span>
                        )}
                      </div>
                      <span>{d.posting_date ? `📅 ${d.posting_date.substring(0, 10)}` : new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Editor & Management Controls */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 backdrop-blur-sm">
          {/* Top Bar of Active Record */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-zinc-800/80">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-300">
                {activeDraft ? 'Editando Copy Maestro' : 'Nuevo Copy Maestro'}
              </span>
              {activeDraft && (
                <span className="text-[11px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">
                  ID: {activeDraft.id.substring(0, 8)}...
                </span>
              )}
            </div>

            {/* Quick Actions */}
            {activeDraft && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickRegister('whatsapp_group')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-md shadow-emerald-950/40 flex items-center gap-1.5"
                  title="Registrar envío a grupos de WhatsApp inmediatamente con 1 clic"
                >
                  <span>🚀</span> 1-Clic: Registré Envío a Grupos
                </button>
                <button
                  type="button"
                  onClick={() => setShowLogModal(true)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 transition"
                  title="Personalizar canal de envío"
                >
                  Otro Canal
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-400 hover:text-red-300 text-xs px-2.5 py-1.5 rounded-lg border border-red-900/40 hover:bg-red-950/30 transition"
                >
                  {deleting ? '...' : 'Eliminar'}
                </button>
              </div>
            )}
          </div>

          {/* Row 1: Title & Status */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-6">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Título del Copy / Campaña *
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#DC143C]"
                placeholder="Ej: Promo Fin de Semana - Grupos WhatsApp Cancún"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Estado del Copy
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DC143C]"
              >
                <option value="draft">🟡 Borrador (Boceto)</option>
                <option value="approved">🟢 Aprobado / Listo para Usar</option>
                <option value="posted">🚀 En Difusión / Publicado</option>
                <option value="needs_review">⏸️ Pausado / Archivo</option>
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 flex justify-between">
                <span>Último Envío</span>
                <button
                  type="button"
                  onClick={() => setPostingDate(new Date().toISOString().substring(0, 10))}
                  className="text-[10px] text-[#DC143C] hover:underline"
                >
                  Hoy
                </button>
              </label>
              <input
                type="date"
                value={postingDate}
                onChange={(e) => setPostingDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DC143C]"
              />
            </div>
          </div>

          {/* Row 2: Original Idea / Product Anchor */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Idea del Producto o Servicio (Ángulo Maestro)
            </label>
            <input
              value={draftCopy}
              onChange={(e) => setDraftCopy(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
              placeholder="Ej: Destacar entrega express en 30 minutos a domicilio..."
            />
          </div>

          {/* Row 3: Split Editor (WhatsApp vs Marketplace) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WhatsApp Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Versión WhatsApp (Grupos & Difusión)
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(whatsappCopy, 'WhatsApp')}
                    className="text-xs bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <span>📋</span> Copiar
                  </button>
                  {activeDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(whatsappCopy, 'WhatsApp');
                        handleQuickRegister('whatsapp_group');
                      }}
                      className="text-[11px] bg-emerald-800/80 hover:bg-emerald-700 text-emerald-100 border border-emerald-600/50 px-2.5 py-1 rounded-lg transition font-semibold"
                      title="Copia el texto al portapapeles y registra inmediatamente el re-envío"
                    >
                      🚀 Copiar + Registrar
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={whatsappCopy}
                onChange={(e) => setWhatsappCopy(e.target.value)}
                className="w-full bg-zinc-950 border border-emerald-900/40 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 h-52 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="¡Qué onda grupo! Les recordamos que nuestro servicio de delivery está activo para llevarles lo que necesiten..."
              />
              <p className="text-[11px] text-zinc-500">Reutiliza este texto en cuantos grupos quieras. Registra cada envío con 1 solo clic.</p>
            </div>

            {/* FB Marketplace Version */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                  <label className="text-xs font-bold uppercase tracking-wider text-orange-400">
                    Versión FB Marketplace (Compliance)
                  </label>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => copyToClipboard(fbMarketplaceCopy, 'Marketplace')}
                    className="text-xs bg-orange-950 hover:bg-orange-900 text-orange-300 border border-orange-800 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  >
                    <span>📋</span> Copiar
                  </button>
                  {activeDraft && (
                    <button
                      type="button"
                      onClick={() => {
                        copyToClipboard(fbMarketplaceCopy, 'Marketplace');
                        handleQuickRegister('marketplace');
                      }}
                      className="text-[11px] bg-orange-900/80 hover:bg-orange-800 text-orange-100 border border-orange-700/50 px-2.5 py-1 rounded-lg transition font-semibold"
                      title="Copia el texto y registra la publicación en Marketplace"
                    >
                      🚀 Copiar + Registrar
                    </button>
                  )}
                </div>
              </div>
              <textarea
                value={fbMarketplaceCopy}
                onChange={(e) => setFbMarketplaceCopy(e.target.value)}
                className={`w-full bg-zinc-950 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 h-52 focus:outline-none transition-colors border ${
                  compliance.isValid
                    ? 'border-orange-500/50 focus:border-orange-500'
                    : 'border-red-600 bg-red-950/20 focus:border-red-500'
                }`}
                placeholder="Somos Distrito, tu servicio local de entregas rápidas. Conoce el catálogo completo en nuestra web..."
              />

              {/* Compliance Scanner Feedback */}
              <div className="space-y-1 text-xs">
                {!compliance.isValid && (
                  <p className="text-red-400 font-semibold bg-red-950/40 border border-red-800/40 rounded-lg p-2">
                    {compliance.errors}
                  </p>
                )}
                {compliance.warnings && (
                  <p className="text-amber-400 font-medium bg-amber-950/30 border border-amber-800/30 rounded-lg p-2">
                    {compliance.warnings}
                  </p>
                )}
                {compliance.ctaMissing && isMarketplaceActive && (
                  <p className="text-cyan-400 font-medium bg-cyan-950/30 border border-cyan-800/30 rounded-lg p-2">
                    {compliance.ctaMissing}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* 🚀 Dedicated Publishing / Repost Log (Historial de Envíos y Re-publicaciones) */}
          <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    🚀 Registro de Publicaciones & Re-envíos ({publishingLog.length})
                  </h3>
                  <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                    Historial de Reuso
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Cada vez que mandas este copy a grupos de WhatsApp o Marketplace queda registrado aquí con 1 solo clic.
                </p>
              </div>

              {activeDraft && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickRegister('whatsapp_group')}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 shadow-sm"
                  >
                    <span>+</span> Registrar Envío WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLogModal(true)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-700 transition"
                  >
                    Añadir con Nota
                  </button>
                </div>
              )}
            </div>

            {/* List of Publications */}
            {publishingLog.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 text-xs bg-zinc-900/40 rounded-xl border border-zinc-800/60">
                <p>Aún no has registrado ningún envío para este copy.</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">
                  Haz clic en &quot;🚀 Copiar + Registrar&quot; para empezar a contar tus difusiones a grupos.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {publishingLog.map((log) => {
                  const badge = channelBadges[log.channel] || channelBadges.whatsapp_group;
                  return (
                    <div
                      key={log.id}
                      className="p-3 bg-zinc-900 border border-zinc-800 rounded-xl flex items-start justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.color}`}>
                            {badge.label}
                          </span>
                          <span className="text-[11px] text-zinc-400">
                            {new Date(log.posted_at).toLocaleString()}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-zinc-300 text-[11px] pl-1">
                            Nota: &quot;{log.notes}&quot;
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeletePublication(log.id)}
                        className="text-zinc-600 hover:text-red-400 text-xs p-1 transition"
                        title="Eliminar este registro de envío"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Internal Notes & Strategy Learnings */}
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                🗒️ Notas Internas & Aprendizajes de Estrategia
              </label>
              <span className="text-[10px] text-zinc-500">Notas generales del copy</span>
            </div>
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 h-20 focus:outline-none focus:border-zinc-700"
              placeholder="Notas generales: ej. Este copy convierte mejor cuando se acompaña con la foto del delivery en moto."
            />
          </div>

          {/* 🔄 Text Revision History with ERASER and CORRECT CHRONOLOGICAL SORTING */}
          {sortedRevisions.length > 0 && (
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-zinc-800/80">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                    <span>🔄</span> Historial de Revisiones de Texto ({sortedRevisions.length})
                  </h4>
                  <p className="text-[11px] text-zinc-500">
                    Ordenado cronológicamente (la versión más reciente arriba).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllRevisions}
                  className="text-[11px] text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 border border-red-900/50 px-2.5 py-1 rounded-lg transition flex items-center gap-1"
                  title="Borrar todo el historial de revisiones"
                >
                  <span>🗑️</span> Limpiar Todo el Historial
                </button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {sortedRevisions.map((rev: any, idx: number) => {
                  const versionNumber = sortedRevisions.length - idx;
                  const isLatest = idx === 0;

                  return (
                    <div
                      key={rev.id || idx}
                      className={`text-xs p-3 rounded-xl border transition-all ${
                        isLatest
                          ? 'bg-zinc-900 border-zinc-700/80'
                          : 'bg-zinc-950/60 border-zinc-800/60 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5 text-[11px]">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            isLatest ? 'bg-blue-950 text-blue-300 border border-blue-800' : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            Versión #{versionNumber} {isLatest ? '(Más reciente)' : versionNumber === 1 ? '(Original)' : ''}
                          </span>
                          <span className="text-zinc-500">
                            {new Date(rev.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleRestoreRevision(rev.facebook_marketplace_copy)}
                            className="text-[10px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded transition"
                            title="Restaurar este texto en el editor"
                          >
                            ↺ Restaurar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleRevision(rev.id)}
                            className="text-zinc-500 hover:text-red-400 text-xs px-1.5 py-0.5 rounded transition"
                            title="Eliminar esta revisión"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <p className="text-zinc-300 text-[11px] line-clamp-3 italic bg-zinc-950/80 p-2 rounded-lg border border-zinc-900">
                        &quot;{rev.facebook_marketplace_copy}&quot;
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            onClick={() => handleSave()}
            disabled={!canSave || saving}
            className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg ${
              canSave && !saving
                ? 'bg-[#DC143C] hover:bg-red-700 text-white cursor-pointer shadow-red-950/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
            }`}
          >
            {saving
              ? 'Guardando cambios...'
              : canSave
              ? (activeDraft ? 'Actualizar Copy Maestro' : 'Guardar Nuevo Copy Maestro')
              : !hasAtLeastOneCopy
              ? 'Escribe al menos un copy (WhatsApp o Marketplace) para guardar'
              : !compliance.isValid
              ? 'Elimina las palabras prohibidas detectadas'
              : 'Asigna un título para guardar'}
          </button>
        </div>
      </div>

      {/* Modal: Registrar Publicación / Re-envío (Completamente Opcional, 0 campos obligatorios) */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-zinc-800">
              <h3 className="font-bold text-sm uppercase tracking-wider text-white">
                🚀 Registrar Envío
              </h3>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="text-zinc-500 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Canal
              </label>
              <select
                value={logChannel}
                onChange={(e: any) => setLogChannel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#DC143C]"
              >
                <option value="whatsapp_group">📱 Grupos de WhatsApp</option>
                <option value="whatsapp_broadcast">💬 WhatsApp Lista de Difusión</option>
                <option value="marketplace">🛒 Facebook Marketplace</option>
                <option value="facebook_group">👥 Grupos de Facebook</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Nota o Resultado (Totalmente Opcional)
              </label>
              <textarea
                value={logNotes}
                onChange={(e) => setLogNotes(e.target.value)}
                placeholder="Opcional: ej. Enviado a 15 grupos de Cancún..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-600 h-20 focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleQuickRegister(logChannel, logNotes)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-lg shadow-emerald-950/40"
              >
                Guardar Envío
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
