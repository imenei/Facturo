'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import { Save, Loader2, Building2, Upload } from 'lucide-react';

export default function CompanyPage() {
  const { t } = useI18nStore();
  const [form, setForm] = useState<any>({
    name: '', address: '', phone: '', email: '', website: '',
    nif: '', nis: '', rc: '', ai: '', rib: '', bank: '',
    legalMentions: '', logo: '', signature: '', stamp: '', documentColor: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/company').then(({ data }) => {
      setForm((prev: any) => ({ ...prev, ...data }));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleFile = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setForm((prev: any) => ({ ...prev, [field]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/company', form);
      toast.success(t('settings_saved'));
    } catch {
      toast.error(t('error_saving_settings'));
    }
    setSaving(false);
  };

  const f = (k: string) => ({ value: form[k] || '', onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-brand-600" /></div>
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('company_settings')}</h1>
          <p className="text-slate-500 text-sm">{t('company_settings_description')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('general_information')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">{t('company_name')} *</label>
              <input className="input" required {...f('name')} placeholder={t('company_name_placeholder')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('address')}</label>
              <input className="input" {...f('address')} placeholder={t('address_placeholder')} />
            </div>
            <div>
              <label className="label">{t('phone')}</label>
              <input className="input" {...f('phone')} placeholder={t('phone_placeholder')} />
            </div>
            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" {...f('email')} placeholder={t('email_placeholder')} />
            </div>
            <div>
              <label className="label">{t('website')}</label>
              <input className="input" {...f('website')} placeholder={t('website_placeholder')} />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('legal_tax_information')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">NIF</label><input className="input" {...f('nif')} placeholder={t('nif_placeholder')} /></div>
            <div><label className="label">NIS</label><input className="input" {...f('nis')} placeholder={t('nis_placeholder')} /></div>
            <div><label className="label">RC</label><input className="input" {...f('rc')} placeholder={t('rc_placeholder')} /></div>
            <div><label className="label">{t('ai')}</label><input className="input" {...f('ai')} /></div>
            <div><label className="label">RIB</label><input className="input" {...f('rib')} /></div>
            <div><label className="label">{t('bank')}</label><input className="input" {...f('bank')} /></div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('documents_visuals')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { key: 'logo', label: t('logo') },
              { key: 'signature', label: t('signature') },
              { key: 'stamp', label: t('stamp') },
            ].map(({ key, label }) => (
              <div key={key} className="text-center">
                <label className="label text-center">{label}</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-brand-300 transition-colors cursor-pointer relative">
                  {form[key] ? (
                    <img src={form[key]} alt={label} className="max-h-24 mx-auto object-contain" />
                  ) : (
                    <div className="py-4 text-slate-400">
                      <Upload size={24} className="mx-auto mb-2" />
                      <p className="text-xs">{t('click_to_import')}</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFile(key)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                {form[key] && (
                  <button type="button" onClick={() => setForm({ ...form, [key]: '' })} className="text-xs text-red-500 hover:underline mt-1">
                    {t('delete')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-1">{t('Couleur des documents')}</h2>
          <p className="text-sm text-slate-500 mb-4">{t('Couleur principale des factures, bons de livraison et exports PDF / Word.')}</p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {[
              { hex: '', name: 'Noir (par défaut)', preview: '#141414' },
              { hex: '#374151', name: 'Anthracite', preview: '#374151' },
              { hex: '#1e3a8a', name: 'Bleu marine', preview: '#1e3a8a' },
              { hex: '#1d4ed8', name: 'Bleu', preview: '#1d4ed8' },
              { hex: '#0f766e', name: 'Turquoise', preview: '#0f766e' },
              { hex: '#047857', name: 'Vert', preview: '#047857' },
              { hex: '#b91c1c', name: 'Rouge', preview: '#b91c1c' },
              { hex: '#7f1d1d', name: 'Bordeaux', preview: '#7f1d1d' },
              { hex: '#c2410c', name: 'Orange', preview: '#c2410c' },
              { hex: '#6d28d9', name: 'Violet', preview: '#6d28d9' },
            ].map((color) => {
              const active = (form.documentColor || '') === color.hex;
              return (
                <button key={color.name} type="button" title={t(color.name)} aria-label={t(color.name)}
                  onClick={() => setForm({ ...form, documentColor: color.hex })}
                  className={`h-9 w-9 rounded-full border-2 transition-all ${active ? 'border-brand-500 ring-2 ring-brand-200 scale-110' : 'border-white shadow'}`}
                  style={{ backgroundColor: color.preview }} />
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-slate-600">{t('Personnalisée')}</label>
            <input type="color" aria-label={t('Personnalisée')} value={/^#[0-9a-fA-F]{6}$/.test(form.documentColor || '') ? form.documentColor : '#141414'}
              onChange={(e) => setForm({ ...form, documentColor: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded border border-slate-200 bg-white p-1" />
            <input className="input max-w-[9rem] font-mono" dir="ltr" maxLength={7} placeholder="#141414"
              value={form.documentColor || ''} onChange={(e) => setForm({ ...form, documentColor: e.target.value })} />
            <div className="h-10 flex-1 min-w-[10rem] rounded-lg flex items-center px-4 text-sm font-semibold text-white"
              style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(form.documentColor || '') ? form.documentColor : '#141414' }}>
              {form.name || 'Mon Entreprise'}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">{t('Une couleur trop claire est automatiquement assombrie pour garder le texte lisible.')}</p>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('legal_notices')}</h2>
          <label className="label">{t('footer_text')}</label>
          <textarea className="input resize-none" rows={3} {...f('legalMentions')} placeholder={t('legal_notices_placeholder')} />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
            {saving ? <><Loader2 size={16} className="animate-spin" /> {t('saving')}</> : <><Save size={16} /> {t('save')}</>}
          </button>
        </div>
      </form>
    </div>
  );
}