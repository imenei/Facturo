'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { LayoutTemplate, Star, Check, Loader2, Eye, Settings } from 'lucide-react';

const TEMPLATE_PREVIEWS: Record<string, { desc: string; icon: string; layout: string }> = {
  classic:     { desc: 'Mise en page standard, logo gauche, tableau simple', icon: '📄', layout: 'logo-left' },
  compact:     { desc: 'Informations condensées, gain de place', icon: '📋', layout: 'compact' },
  detailed:    { desc: 'Sections séparées, sous-totaux visibles', icon: '📑', layout: 'detailed' },
  corporate:   { desc: 'Logo centré, structure formelle', icon: '🏢', layout: 'logo-center' },
  table_focus: { desc: 'Accent sur le tableau produits, colonnes larges', icon: '📊', layout: 'table-focus' },
};

function TemplatePreview({ type, logoPosition }: { type: string; logoPosition: string }) {
  const isCenter = logoPosition === 'center';
  const isRight = logoPosition === 'right';

  return (
    <div className="bg-white border border-slate-200 rounded-lg p-3 text-[8px] font-mono select-none overflow-hidden" style={{ minHeight: 140 }}>
      {/* Header */}
      <div className={clsx('flex mb-2', isCenter ? 'flex-col items-center' : isRight ? 'flex-row-reverse' : 'flex-row', 'gap-2')}>
        <div className="w-8 h-5 bg-slate-200 rounded flex items-center justify-center text-[6px] text-slate-400">LOGO</div>
        {type === 'compact' ? (
          <div className="flex-1 text-slate-600 text-[7px] leading-tight">
            <div className="font-bold">ENTREPRISE</div>
            <div className="text-slate-400">contact@ex.dz · +213 5XX</div>
          </div>
        ) : (
          <div className={clsx('flex-1', isCenter && 'text-center')}>
            <div className="font-bold text-slate-800">MON ENTREPRISE</div>
            <div className="text-slate-400">Adresse · contact@ex.dz</div>
          </div>
        )}
      </div>

      {/* Title */}
      <div className={clsx('border-b border-slate-300 pb-1 mb-2', type === 'corporate' ? 'text-center' : '')}>
        <span className="font-bold text-slate-700">FACTURE N° FAC-2024-0001</span>
      </div>

      {/* Client */}
      {type !== 'compact' && (
        <div className="flex justify-between mb-2">
          <div className="text-slate-500">
            <div className="font-bold text-[7px]">FACTURER À</div>
            <div>Client SARL</div>
          </div>
          <div className="text-slate-500 text-right">
            <div>Date: 28/03/2024</div>
            {type === 'detailed' && <div>Réf: CMD-001</div>}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-slate-200 rounded overflow-hidden">
        <div className={clsx('flex bg-slate-100 border-b border-slate-200 font-bold text-slate-600',
          type === 'table_focus' ? 'text-[8px]' : 'text-[7px]')}>
          <div className="flex-1 px-1 py-0.5">Désignation</div>
          <div className="w-6 px-1 py-0.5 text-center">Qté</div>
          <div className="w-10 px-1 py-0.5 text-right">PU</div>
          <div className="w-10 px-1 py-0.5 text-right">Total</div>
        </div>
        {[1, 2].map((r) => (
          <div key={r} className="flex border-b border-slate-100 text-slate-500 text-[7px]">
            <div className="flex-1 px-1 py-0.5">Article {r}</div>
            <div className="w-6 px-1 py-0.5 text-center">2</div>
            <div className="w-10 px-1 py-0.5 text-right">1 000</div>
            <div className="w-10 px-1 py-0.5 text-right">2 000</div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="text-right mt-1 text-slate-600">
        {type === 'detailed' && <div className="text-[7px]">HT: 4 000 DZD</div>}
        <div className="font-bold text-[8px]">Total: 4 760 DZD</div>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 mt-1 pt-1 text-[6px] text-slate-400 text-center">
        {type === 'corporate' ? 'MENTIONS LÉGALES · NIF: XXXX · RC: XXXX' : 'Merci pour votre confiance'}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const load = async () => {
    try {
      const [tmpl, typ] = await Promise.all([api.get('/templates'), api.get('/templates/types')]);
      setTemplates(tmpl.data);
      setTypes(typ.data);
    } catch { toast.error('Erreur chargement'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setDefault = async (id: string) => {
    setSaving(id);
    try {
      await api.post(`/templates/${id}/set-default`);
      toast.success('Template par défaut défini');
      load();
    } catch { toast.error('Erreur'); }
    setSaving(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(id);
    try {
      await api.patch(`/templates/${id}`, editForm);
      toast.success('Template modifié');
      setEditingId(null);
      load();
    } catch { toast.error('Erreur'); }
    setSaving(null);
  };

  const createDefaults = async () => {
    setSaving('init');
    try {
      // Create one of each type if not existing
      for (const t of types) {
        const exists = templates.find((tmpl) => tmpl.type === t.type);
        if (!exists) {
          await api.post('/templates', { name: t.name, type: t.type, logoPosition: t.logoPosition, isDefault: false });
        }
      }
      toast.success('Templates créés');
      load();
    } catch { toast.error('Erreur'); }
    setSaving(null);
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
            <LayoutTemplate size={20} className="text-brand-600" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-700 text-slate-900">Templates de documents</h1>
            <p className="text-slate-500 text-sm">Choisissez la mise en page de vos factures (noir & blanc, économie d'encre)</p>
          </div>
        </div>
        {templates.length === 0 && (
          <button onClick={createDefaults} disabled={saving === 'init'} className="btn-primary">
            {saving === 'init' ? <Loader2 size={16} className="animate-spin" /> : '+ Initialiser les templates'}
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {(templates.length > 0 ? templates : types).map((tmpl: any) => {
            const typeInfo = TEMPLATE_PREVIEWS[tmpl.type] || {};
            const isDefault = tmpl.isDefault;
            const isEditing = editingId === tmpl.id;

            return (
              <div key={tmpl.id || tmpl.type} className={clsx('card p-5 flex flex-col gap-4 transition-all hover:shadow-md', isDefault && 'ring-2 ring-brand-500')}>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{typeInfo.icon}</span>
                      <span className="font-display font-700 text-slate-900">{tmpl.name}</span>
                      {isDefault && (
                        <span className="badge bg-brand-100 text-brand-700 text-xs"><Star size={10} className="mr-1" />Défaut</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">{typeInfo.desc}</p>
                  </div>
                </div>

                {/* Preview */}
                <TemplatePreview type={tmpl.type} logoPosition={tmpl.logoPosition || 'left'} />

                {/* Edit form */}
                {isEditing ? (
                  <div className="space-y-2 border-t pt-3">
                    <div>
                      <label className="label text-xs">Nom</label>
                      <input className="input text-sm" value={editForm.name || ''} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="label text-xs">Position du logo</label>
                      <select className="input text-sm" value={editForm.logoPosition || 'left'} onChange={(e) => setEditForm({ ...editForm, logoPosition: e.target.value })}>
                        <option value="left">Gauche</option>
                        <option value="center">Centre</option>
                        <option value="right">Droite</option>
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Texte d'en-tête</label>
                      <input className="input text-sm" value={editForm.headerText || ''} onChange={(e) => setEditForm({ ...editForm, headerText: e.target.value })} placeholder="Texte optionnel" />
                    </div>
                    <div>
                      <label className="label text-xs">Texte de pied de page</label>
                      <input className="input text-sm" value={editForm.footerText || ''} onChange={(e) => setEditForm({ ...editForm, footerText: e.target.value })} placeholder="Texte optionnel" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => setEditingId(null)} className="btn-secondary flex-1 text-sm justify-center py-1.5">Annuler</button>
                      <button onClick={() => saveEdit(tmpl.id)} disabled={saving === tmpl.id} className="btn-primary flex-1 text-sm justify-center py-1.5">
                        {saving === tmpl.id ? <Loader2 size={13} className="animate-spin" /> : 'Sauver'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 border-t pt-3">
                    {tmpl.id && (
                      <button onClick={() => { setEditingId(tmpl.id); setEditForm({ name: tmpl.name, logoPosition: tmpl.logoPosition, headerText: tmpl.headerText, footerText: tmpl.footerText }); }}
                        className="btn-secondary flex-1 text-sm justify-center py-1.5">
                        <Settings size={14} /> Config
                      </button>
                    )}
                    {tmpl.id && !isDefault && (
                      <button onClick={() => setDefault(tmpl.id)} disabled={saving === tmpl.id}
                        className="btn-primary flex-1 text-sm justify-center py-1.5">
                        {saving === tmpl.id ? <Loader2 size={13} className="animate-spin" /> : <><Star size={13} /> Défaut</>}
                      </button>
                    )}
                    {isDefault && (
                      <div className="flex-1 flex items-center justify-center gap-1.5 text-sm text-emerald-600 font-medium">
                        <Check size={15} /> Template actif
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 card p-5 bg-slate-50">
        <h3 className="font-display font-600 text-slate-700 mb-2 text-sm">ℹ️ À propos des templates</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          Les 5 templates diffèrent uniquement par leur structure et mise en page. Aucune couleur vive n'est utilisée pour économiser l'encre.
          Le template par défaut s'applique à toutes vos nouvelles factures, proformas et bons de livraison.
          Vous pouvez changer le template document par document lors de la création.
        </p>
      </div>
    </div>
  );
}
