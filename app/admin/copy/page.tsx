'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { scanCopy } from '@/lib/complianceScanner';
import toast from 'react-hot-toast';

export default function CopyManagementPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [title, setTitle] = useState('');
  const [draftCopy, setDraftCopy] = useState('');
  const [whatsappCopy, setWhatsappCopy] = useState('');
  const [fbMarketplaceCopy, setFbMarketplaceCopy] = useState('');
  
  const [imgNoGlass, setImgNoGlass] = useState(false);
  const [imgNoSmoke, setImgNoSmoke] = useState(false);
  const [imgFocusDelivery, setImgFocusDelivery] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('copy_drafts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setDbError(error.message);
      } else {
        setDrafts(data || []);
        setDbError(null);
      }
    } catch (err: any) {
      setDbError(err.message || 'Error conectando a Supabase');
    } finally {
      setLoading(false);
    }
  }

  const compliance = scanCopy(fbMarketplaceCopy);
  const imagesValid = imgNoGlass && imgNoSmoke && imgFocusDelivery;
  const canSave = compliance.isValid && imagesValid && title.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    
    const payload = {
      title,
      draft_copy: draftCopy,
      whatsapp_copy: whatsappCopy,
      facebook_marketplace_copy: fbMarketplaceCopy,
      img_no_glass: imgNoGlass,
      img_no_smoke: imgNoSmoke,
      img_focus_delivery: imgFocusDelivery,
    };

    try {
      if (activeDraft?.id) {
        const { error } = await supabase.from('copy_drafts').update(payload).eq('id', activeDraft.id);
        if (error) throw error;

        await supabase.from('copy_revisions').insert({
          draft_id: activeDraft.id,
          facebook_marketplace_copy: fbMarketplaceCopy
        });
        toast.success('Copy actualizado con éxito');
      } else {
        const { data, error } = await supabase.from('copy_drafts').insert([payload]).select().single();
        if (error) throw error;

        if (data) {
          await supabase.from('copy_revisions').insert({
            draft_id: data.id,
            facebook_marketplace_copy: fbMarketplaceCopy
          });
        }
        toast.success('Nuevo copy guardado con éxito');
      }
      
      setActiveDraft(null);
      clearForm();
      fetchDrafts();
    } catch (err: any) {
      toast.error('Error al guardar: ' + (err.message || 'Verifica la migración SQL en Supabase'));
    } finally {
      setSaving(false);
    }
  }

  function clearForm() {
    setTitle('');
    setDraftCopy('');
    setWhatsappCopy('');
    setFbMarketplaceCopy('');
    setImgNoGlass(false);
    setImgNoSmoke(false);
    setImgFocusDelivery(false);
  }

  function loadDraft(d: any) {
    setActiveDraft(d);
    setTitle(d.title || '');
    setDraftCopy(d.draft_copy || '');
    setWhatsappCopy(d.whatsapp_copy || '');
    setFbMarketplaceCopy(d.facebook_marketplace_copy || '');
    setImgNoGlass(d.img_no_glass || false);
    setImgNoSmoke(d.img_no_smoke || false);
    setImgFocusDelivery(d.img_focus_delivery || false);
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-zinc-800 gap-4">
        <div>
          <div className="text-xs tracking-widest text-[#DC143C] font-bold uppercase mb-1">
            Meta Compliance & Content Hub
          </div>
          <h1 className="text-3xl font-black tracking-tight">Copy Management</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Diseña, valida y blinda tus copies para WhatsApp y Facebook Marketplace sin riesgo de baneo.
          </p>
        </div>
        <button
          onClick={() => { setActiveDraft(null); clearForm(); }}
          className="bg-[#DC143C] hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-all shadow-lg shadow-red-900/20"
        >
          + Nuevo Borrador
        </button>
      </div>

      {/* SQL Migration Alert if tables not yet detected */}
      {dbError && (
        <div className="mt-6 p-4 rounded-xl bg-amber-950/40 border border-amber-600/50 text-amber-200 text-sm flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-semibold">Tablas no detectadas en Supabase</p>
            <p className="text-xs text-amber-300/80 mt-0.5">
              Recuerda ejecutar el script <code className="bg-black/50 px-1 py-0.5 rounded text-amber-100">sql/014_copy_management.sql</code> en el SQL Editor de tu panel de Supabase para activar la persistencia.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: List of drafts */}
        <div className="lg:col-span-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Historial de Copies</h2>
            <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">{drafts.length}</span>
          </div>

          {loading ? (
            <div className="text-center py-12 text-zinc-500 text-sm">Cargando borradores...</div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-sm">
              <p>No hay borradores guardados.</p>
              <p className="text-xs text-zinc-600 mt-1">Crea uno en el editor de la derecha.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  onClick={() => loadDraft(d)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                    activeDraft?.id === d.id
                      ? 'bg-zinc-800/90 border-[#DC143C] shadow-md shadow-red-950/20'
                      : 'bg-zinc-950/40 border-zinc-800/80 hover:bg-zinc-800/50 hover:border-zinc-700'
                  }`}
                >
                  <h3 className="font-semibold text-sm text-zinc-100 truncate">{d.title}</h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 mt-1">
                    {d.facebook_marketplace_copy || d.whatsapp_copy || 'Sin contenido aún...'}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
                    <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    <span className="capitalize text-zinc-400 font-medium">{d.status || 'draft'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: Editor */}
        <div className="lg:col-span-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 space-y-6 backdrop-blur-sm">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Título del Copy / Campaña
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-[#DC143C]"
              placeholder="Ej: Promo Fin de Semana - Delivery Rápido Cancún"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* WhatsApp Version */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <label className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  WhatsApp (Zona Segura 1-a-1)
                </label>
              </div>
              <textarea
                value={whatsappCopy}
                onChange={(e) => setWhatsappCopy(e.target.value)}
                className="w-full bg-zinc-950 border border-emerald-900/40 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 h-44 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="¡Qué onda! Te dejamos la lista de lo que buscas para este fin..."
              />
              <p className="text-[11px] text-zinc-500 mt-1">Usa lenguaje natural y directo. No hay filtro estricto de bots.</p>
            </div>

            {/* FB Marketplace Version */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span>
                <label className="text-xs font-bold uppercase tracking-wider text-orange-400">
                  FB Marketplace ⚠️ (Zona Máxima Seguridad)
                </label>
              </div>
              <textarea
                value={fbMarketplaceCopy}
                onChange={(e) => setFbMarketplaceCopy(e.target.value)}
                className={`w-full bg-zinc-950 rounded-xl p-3 text-sm text-zinc-100 placeholder-zinc-600 h-44 focus:outline-none transition-colors border ${
                  compliance.isValid
                    ? 'border-orange-500/50 focus:border-orange-500'
                    : 'border-red-600 bg-red-950/20 focus:border-red-500'
                }`}
                placeholder="Somos Distrito, tu servicio local de entregas rápidas..."
              />

              {/* Validation Feedback */}
              <div className="mt-2 space-y-1 text-xs">
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
                {compliance.ctaMissing && (
                  <p className="text-cyan-400 font-medium bg-cyan-950/30 border border-cyan-800/30 rounded-lg p-2">
                    {compliance.ctaMissing}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Snippets */}
          <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-xl p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Frases Seguras Aprobadas (1 Clic para Insertar en Marketplace):
            </p>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => setFbMarketplaceCopy((prev) => prev + (prev ? ' ' : '') + 'Lo que necesitas para relajarte.')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition"
              >
                + "Lo que necesitas para relajarte"
              </button>
              <button
                type="button"
                onClick={() => setFbMarketplaceCopy((prev) => prev + (prev ? ' ' : '') + 'Conoce el catálogo completo en nuestra web: distritopipa.com')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition"
              >
                + "CTA Web: distritopipa.com"
              </button>
              <button
                type="button"
                onClick={() => setFbMarketplaceCopy((prev) => prev + (prev ? ' ' : '') + 'Servicio a domicilio rápido en Cancún.')}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg border border-zinc-700 transition"
              >
                + "Delivery rápido Cancún"
              </button>
            </div>
          </div>

          {/* Mandatory Image Compliance Checklist */}
          <div className="bg-zinc-950/60 border border-zinc-800 rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Checklist Obligatorio de Imagen (Para desbloquear guardado)
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                imagesValid ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {imagesValid ? '✓ Verificado' : 'Pendiente'}
              </span>
            </div>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-zinc-300 hover:text-white transition">
              <input
                type="checkbox"
                checked={imgNoGlass}
                onChange={(e) => setImgNoGlass(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#DC143C] focus:ring-0"
              />
              <span>La imagen <b>NO</b> muestra artículos de cristal, pipas o parafernalia explícita.</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-zinc-300 hover:text-white transition">
              <input
                type="checkbox"
                checked={imgNoSmoke}
                onChange={(e) => setImgNoSmoke(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#DC143C] focus:ring-0"
              />
              <span>La imagen <b>NO</b> contiene humo ni efectos de humo.</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-zinc-300 hover:text-white transition">
              <input
                type="checkbox"
                checked={imgFocusDelivery}
                onChange={(e) => setImgFocusDelivery(e.target.checked)}
                className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-[#DC143C] focus:ring-0"
              />
              <span>La imagen se enfoca estrictamente en el <b>Servicio de Delivery</b> o vibra urbana/local.</span>
            </label>
          </div>

          {/* Submit button */}
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition-all shadow-lg ${
              canSave && !saving
                ? 'bg-[#DC143C] hover:bg-red-700 text-white cursor-pointer shadow-red-950/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800'
            }`}
          >
            {saving
              ? 'Guardando...'
              : canSave
              ? (activeDraft ? 'Actualizar Copy Blindado' : 'Guardar Copy Blindado')
              : 'Completa el título, elimina palabras prohibidas y marca el checklist para guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
