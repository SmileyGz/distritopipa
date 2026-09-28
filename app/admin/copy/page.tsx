'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { scanCopy } from '@/lib/complianceScanner';

export default function CopyManagementPage() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [activeDraft, setActiveDraft] = useState<any | null>(null);
  
  const [title, setTitle] = useState('');
  const [draftCopy, setDraftCopy] = useState('');
  const [whatsappCopy, setWhatsappCopy] = useState('');
  const [fbMarketplaceCopy, setFbMarketplaceCopy] = useState('');
  
  const [imgNoGlass, setImgNoGlass] = useState(false);
  const [imgNoSmoke, setImgNoSmoke] = useState(false);
  const [imgFocusDelivery, setImgFocusDelivery] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  async function fetchDrafts() {
    const { data, error } = await supabase.from('copy_drafts').select('*').order('created_at', { ascending: false });
    if (data) setDrafts(data);
  }

  const compliance = scanCopy(fbMarketplaceCopy);
  const imagesValid = imgNoGlass && imgNoSmoke && imgFocusDelivery;
  const canSave = compliance.isValid && imagesValid && title.trim().length > 0;

  async function handleSave() {
    if (!canSave) return;
    
    const payload = {
      title,
      draft_copy: draftCopy,
      whatsapp_copy: whatsappCopy,
      facebook_marketplace_copy: fbMarketplaceCopy,
      img_no_glass: imgNoGlass,
      img_no_smoke: imgNoSmoke,
      img_focus_delivery: imgFocusDelivery,
    };

    if (activeDraft?.id) {
      await supabase.from('copy_drafts').update(payload).eq('id', activeDraft.id);
      // Log revision
      await supabase.from('copy_revisions').insert({
        draft_id: activeDraft.id,
        facebook_marketplace_copy: fbMarketplaceCopy
      });
    } else {
      const { data } = await supabase.from('copy_drafts').insert([payload]).select().single();
      if (data) {
        await supabase.from('copy_revisions').insert({
          draft_id: data.id,
          facebook_marketplace_copy: fbMarketplaceCopy
        });
      }
    }
    
    setActiveDraft(null);
    clearForm();
    fetchDrafts();
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
    <div className="p-6 max-w-7xl mx-auto flex gap-6">
      {/* Sidebar List */}
      <div className="w-1/3 border-r pr-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Copy Manager</h1>
          <button onClick={() => { setActiveDraft(null); clearForm(); }} className="bg-black text-white px-3 py-1 rounded text-sm hover:bg-gray-800">New Draft</button>
        </div>
        <div className="space-y-4">
          {drafts.map(d => (
            <div key={d.id} onClick={() => loadDraft(d)} className="p-4 border rounded cursor-pointer hover:bg-gray-50">
              <h3 className="font-semibold truncate">{d.title}</h3>
              <p className="text-xs text-gray-500 mt-1">{new Date(d.created_at).toLocaleDateString()}</p>
            </div>
          ))}
          {drafts.length === 0 && <p className="text-sm text-gray-500 italic">No drafts yet. Create one!</p>}
        </div>
      </div>

      {/* Editor */}
      <div className="w-2/3 space-y-6">
        <div>
          <label className="block text-sm font-medium mb-1">Title (Internal)</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full border p-2 rounded" placeholder="e.g., Weekend Delivery Promo" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-green-700">WhatsApp Copy (Standard)</label>
            <textarea value={whatsappCopy} onChange={e => setWhatsappCopy(e.target.value)} className="w-full border-2 border-green-500 p-2 rounded h-48 focus:outline-none focus:ring-2 focus:ring-green-300" placeholder="WhatsApp version (safer zone)..." />
          </div>

          <div>
            <label className="block text-sm font-medium text-orange-600 mb-1">FB Marketplace Copy ⚠️ (High Security)</label>
            <textarea 
              value={fbMarketplaceCopy} 
              onChange={e => setFbMarketplaceCopy(e.target.value)} 
              className={`w-full border-2 p-2 rounded h-48 focus:outline-none ${compliance.isValid ? 'border-orange-500 focus:ring-2 focus:ring-orange-300' : 'border-red-600 bg-red-50 focus:ring-2 focus:ring-red-400'}`} 
              placeholder="Marketplace version..." 
            />
            {/* Validation Feedback */}
            <div className="mt-2 text-sm space-y-1">
              {!compliance.isValid && <p className="text-red-600 font-bold">{compliance.errors}</p>}
              {compliance.warnings && <p className="text-yellow-600 font-semibold">{compliance.warnings}</p>}
              {compliance.ctaMissing && <p className="text-blue-600 font-medium">{compliance.ctaMissing}</p>}
            </div>
          </div>
        </div>

        {/* Quick Snippets */}
        <div>
           <p className="text-sm font-medium text-gray-600 mb-2">Safe Snippets (Click to insert):</p>
           <div className="flex flex-wrap gap-2 text-sm">
             <button onClick={() => setFbMarketplaceCopy(prev => prev + ' Lo que necesitas para relajarte.')} className="bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition">+ Relajarte</button>
             <button onClick={() => setFbMarketplaceCopy(prev => prev + ' Conoce el catálogo completo en nuestra web: distritopipa.com')} className="bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition">+ CTA Web</button>
             <button onClick={() => setFbMarketplaceCopy(prev => prev + ' Servicio a domicilio rápido en Cancún.')} className="bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition">+ Delivery</button>
           </div>
        </div>

        {/* Mandatory Checklist */}
        <div className="bg-gray-50 p-4 rounded-lg border">
          <h3 className="font-medium mb-3 text-gray-800">Image Compliance Checklist (Required to Save)</h3>
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={imgNoGlass} onChange={e => setImgNoGlass(e.target.checked)} className="w-4 h-4 text-black border-gray-300 rounded" />
            <span className="text-sm">Image does <b>NOT</b> show glass items or explicit paraphernalia</span>
          </label>
          <label className="flex items-center gap-3 mb-2 cursor-pointer">
            <input type="checkbox" checked={imgNoSmoke} onChange={e => setImgNoSmoke(e.target.checked)} className="w-4 h-4 text-black border-gray-300 rounded" />
            <span className="text-sm">Image does <b>NOT</b> contain smoke</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={imgFocusDelivery} onChange={e => setImgFocusDelivery(e.target.checked)} className="w-4 h-4 text-black border-gray-300 rounded" />
            <span className="text-sm">Image focuses strictly on the <b>Delivery Service</b> or Lifestyle vibe</span>
          </label>
        </div>

        <button 
          onClick={handleSave} 
          disabled={!canSave} 
          className={`w-full py-3 rounded-lg text-white font-bold transition-colors ${canSave ? 'bg-black hover:bg-gray-800' : 'bg-gray-300 cursor-not-allowed'}`}
        >
          {canSave ? 'Save Approved Copy' : 'Fix Errors & Complete Checklist to Save'}
        </button>
      </div>
    </div>
  );
}
