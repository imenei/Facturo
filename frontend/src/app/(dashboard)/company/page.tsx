'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Save, Loader2, Building2, Upload } from 'lucide-react';

export default function CompanyPage() {
  const [form, setForm] = useState<any>({
    name: '', address: '', phone: '', email: '', website: '',
    nif: '', nis: '', rc: '', ai: '', rib: '', bank: '',
    legalMentions: '', logo: '', signature: '', stamp: '',
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
      toast.success('Paramètres sauvegardés');
    } catch { toast.error('Erreur sauvegarde'); }
    setSaving(false);
  };

  const f = (k: string) => ({ value: form[k] || '', onChange: (e: any) => setForm({ ...form, [k]: e.target.value }) });

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center"><Building2 size={20} className="text-brand-600" /></div>
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">Paramètres entreprise</h1>
          <p className="text-slate-500 text-sm">Ces informations apparaissent sur vos documents</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Informations générales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nom / Raison sociale *</label>
              <input className="input" required {...f('name')} placeholder="Mon Entreprise SARL" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Adresse</label>
              <input className="input" {...f('address')} placeholder="123 Rue Commerce, Alger" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" {...f('phone')} placeholder="+213 21 XX XX XX" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" {...f('email')} placeholder="contact@entreprise.dz" />
            </div>
            <div>
              <label className="label">Site web</label>
              <input className="input" {...f('website')} placeholder="www.entreprise.dz" />
            </div>
          </div>
        </div>

        {/* Legal */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Informations légales & fiscales</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">NIF</label><input className="input" {...f('nif')} placeholder="NIF de l'entreprise" /></div>
            <div><label className="label">NIS</label><input className="input" {...f('nis')} placeholder="NIS de l'entreprise" /></div>
            <div><label className="label">RC</label><input className="input" {...f('rc')} placeholder="Registre du commerce" /></div>
            <div><label className="label">AI (Article Imposition)</label><input className="input" {...f('ai')} /></div>
            <div><label className="label">RIB</label><input className="input" {...f('rib')} /></div>
            <div><label className="label">Banque</label><input className="input" {...f('bank')} /></div>
          </div>
        </div>

        {/* Documents */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Documents & Visuels</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { key: 'logo', label: 'Logo' },
              { key: 'signature', label: 'Signature' },
              { key: 'stamp', label: 'Cachet / Tampon' },
            ].map(({ key, label }) => (
              <div key={key} className="text-center">
                <label className="label text-center">{label}</label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 hover:border-brand-300 transition-colors cursor-pointer relative">
                  {form[key] ? (
                    <img src={form[key]} alt={label} className="max-h-24 mx-auto object-contain" />
                  ) : (
                    <div className="py-4 text-slate-400">
                      <Upload size={24} className="mx-auto mb-2" />
                      <p className="text-xs">Cliquer pour importer</p>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleFile(key)} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
                {form[key] && (
                  <button type="button" onClick={() => setForm({ ...form, [key]: '' })} className="text-xs text-red-500 hover:underline mt-1">Supprimer</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Legal mentions */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Mentions légales</h2>
          <label className="label">Texte pied de page des documents</label>
          <textarea className="input resize-none" rows={3} {...f('legalMentions')} placeholder="Capital social : 100 000 DZD — RC : XXXX — NIF : XXXX — Tél : XXXX" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="btn-primary px-8 py-3">
            {saving ? <><Loader2 size={16} className="animate-spin" /> Sauvegarde…</> : <><Save size={16} /> Sauvegarder</>}
          </button>
        </div>
      </form>
    </div>
  );
}
