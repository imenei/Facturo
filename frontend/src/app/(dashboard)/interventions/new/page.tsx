'use client';
// frontend/src/app/(dashboard)/interventions/new/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, Plus, X, Trash2, Zap, Cpu, Wifi, Settings, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

const WORK_TYPES = [
  { value: 'electronique', label: 'Électronique', icon: Zap },
  { value: 'informatique', label: 'Informatique', icon: Cpu },
  { value: 'reseau',       label: 'Réseau',       icon: Wifi },
  { value: 'electrique',   label: 'Électrique',   icon: Zap },
  { value: 'mecanique',    label: 'Mécanique',    icon: Settings },
  { value: 'autre',        label: 'Autre',        icon: HelpCircle },
];

const INTERVENTION_TYPES = [
  { value: 'reparation',   label: 'Réparation' },
  { value: 'maintenance',  label: 'Maintenance' },
  { value: 'installation', label: 'Installation' },
  { value: 'diagnostic',   label: 'Diagnostic' },
  { value: 'sav',          label: 'SAV' },
];

export default function NewInterventionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isTech = user?.role === 'technicien';
  const [saving, setSaving] = useState(false);
  const [technicians, setTechnicians] = useState<any[]>([]);

  const [form, setForm] = useState({
    workType: 'informatique',
    interventionType: 'reparation',
    estimatedMinutes: 60,
    // Client
    clientName: '', clientPhone: '', clientEmail: '', clientAddress: '',
    // Machine
    machineName: '', machineBrand: '', machineModel: '', serialNumber: '',
    // Dates
    entryDate: new Date().toISOString().split('T')[0],
    expectedExitDate: '',
    // Description
    clientDescription: '',
    // Assignment
    assignedToId: isTech ? user?.id : '',
  });

  const f = (k: string) => ({
    value: (form as any)[k] ?? '',
    onChange: (e: any) => setForm(p => ({ ...p, [k]: e.target.value })),
  });

  useEffect(() => {
    if (!isTech) {
      api.get('/users?role=technicien').then(r => setTechnicians(r.data)).catch(() => {});
    }
  }, [isTech]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (isTech) payload.assignedToId = user!.id;
      await api.post('/interventions', payload);
      toast.success('Intervention créée');
      router.push('/interventions');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/interventions" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">Nouvelle intervention</h1>
          <p className="text-slate-500 text-sm mt-0.5">Enregistrement d'une demande de réparation</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Type de travail */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Type de travail</h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4">
            {WORK_TYPES.map(wt => {
              const Icon = wt.icon;
              return (
                <label key={wt.value} className={clsx(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 cursor-pointer transition-all text-xs font-medium',
                  form.workType === wt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:border-slate-300 text-slate-600',
                )}>
                  <input type="radio" name="workType" value={wt.value} checked={form.workType === wt.value}
                    onChange={e => setForm(p => ({ ...p, workType: e.target.value }))} className="hidden" />
                  <Icon size={18} />{wt.label}
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Type d'intervention</label>
              <select className="input" {...f('interventionType')}>
                {INTERVENTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Durée estimée (min)</label>
              <input type="number" min={0} className="input" {...f('estimatedMinutes')} />
            </div>
            {!isTech && (
              <div>
                <label className="label">Technicien assigné</label>
                <select className="input" value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))}>
                  <option value="">Non assigné</option>
                  {technicians.map(u => (
                    <option key={u.id} value={u.id}>{u.name}{u.specialty ? ` — ${u.specialty}` : ''}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nom / Société <span className="text-red-500">*</span></label>
              <input className="input" required placeholder="Nom du client" {...f('clientName')} />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" placeholder="+213 5XX XXX XXX" {...f('clientPhone')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="client@exemple.com" {...f('clientEmail')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Adresse</label>
              <input className="input" placeholder="Adresse complète" {...f('clientAddress')} />
            </div>
          </div>
        </div>

        {/* Machine */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Machine / Appareil</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Nom de la machine <span className="text-red-500">*</span></label>
              <input className="input" required placeholder="Laptop, Imprimante, Switch, TV…" {...f('machineName')} />
            </div>
            <div>
              <label className="label">Marque</label>
              <input className="input" placeholder="HP, Dell, Samsung, Cisco…" {...f('machineBrand')} />
            </div>
            <div>
              <label className="label">Modèle</label>
              <input className="input" placeholder="EliteBook 840, Galaxy S21…" {...f('machineModel')} />
            </div>
            <div>
              <label className="label">N° de série</label>
              <input className="input" placeholder="SN12345678" {...f('serialNumber')} />
            </div>
            <div>
              <label className="label">Date d'entrée <span className="text-red-500">*</span></label>
              <input type="date" className="input" required {...f('entryDate')} />
            </div>
            <div>
              <label className="label">Date de sortie prévue <span className="text-slate-400 font-normal">(optionnelle)</span></label>
              <input type="date" className="input" {...f('expectedExitDate')} />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">Panne décrite par le client</label>
            <textarea className="input resize-none" rows={3}
              placeholder="Le client décrit : l'appareil ne démarre plus, écran cassé, surchauffe, réseau lent…"
              {...f('clientDescription')} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/interventions" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Création…</>
              : <><Save size={16} /> Créer l'intervention</>}
          </button>
        </div>
      </form>
    </div>
  );
}