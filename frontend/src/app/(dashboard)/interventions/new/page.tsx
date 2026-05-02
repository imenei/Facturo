'use client';
// frontend/src/app/(dashboard)/interventions/new/page.tsx
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import { ArrowLeft, Save, Loader2, Plus, X, Trash2, Zap, Cpu, Wifi, Settings, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

const WORK_TYPES = [
  { value: 'electronique', labelKey: 'work_type_electronic', icon: Zap },
  { value: 'informatique', labelKey: 'work_type_it', icon: Cpu },
  { value: 'reseau',       labelKey: 'work_type_network', icon: Wifi },
  { value: 'electrique',   labelKey: 'work_type_electrical', icon: Zap },
  { value: 'mecanique',    labelKey: 'work_type_mechanical', icon: Settings },
  { value: 'autre',        labelKey: 'work_type_other', icon: HelpCircle },
];

const INTERVENTION_TYPES = [
  { value: 'reparation',   labelKey: 'intervention_type_repair' },
  { value: 'maintenance',  labelKey: 'intervention_type_maintenance' },
  { value: 'installation', labelKey: 'intervention_type_installation' },
  { value: 'diagnostic',   labelKey: 'intervention_type_diagnostic' },
  { value: 'sav',          labelKey: 'intervention_type_after_sales' },
];

export default function NewInterventionPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useI18nStore();
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
      toast.success(t('intervention_created'));
      router.push('/interventions');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error'));
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
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('new_intervention')}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{t('intervention_registration_subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Type de travail */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('work_type')}</h2>
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
                  <Icon size={18} />{t(wt.labelKey)}
                </label>
              );
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">{t('intervention_type')}</label>
              <select className="input" {...f('interventionType')}>
                {INTERVENTION_TYPES.map((it) => <option key={it.value} value={it.value}>{t(it.labelKey)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('estimated_duration_minutes')}</label>
              <input type="number" min={0} className="input" {...f('estimatedMinutes')} />
            </div>
            {!isTech && (
              <div>
                <label className="label">{t('assigned_technician')}</label>
                <select className="input" value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))}>
                  <option value="">{t('unassigned')}</option>
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
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('client')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">{t('name_company')} <span className="text-red-500">*</span></label>
              <input className="input" required placeholder={t('client_name')} {...f('clientName')} />
            </div>
            <div>
              <label className="label">{t('phone')}</label>
              <input className="input" placeholder={t('phone_placeholder')} {...f('clientPhone')} />
            </div>
            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" placeholder={t('client_email_placeholder')} {...f('clientEmail')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('address')}</label>
              <input className="input" placeholder={t('full_address')} {...f('clientAddress')} />
            </div>
          </div>
        </div>

        {/* Machine */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('machine_device')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">{t('machine_name')} <span className="text-red-500">*</span></label>
              <input className="input" required placeholder={t('machine_name_placeholder')} {...f('machineName')} />
            </div>
            <div>
              <label className="label">{t('brand')}</label>
              <input className="input" placeholder={t('brand_placeholder')} {...f('machineBrand')} />
            </div>
            <div>
              <label className="label">{t('model')}</label>
              <input className="input" placeholder={t('model_placeholder')} {...f('machineModel')} />
            </div>
            <div>
              <label className="label">{t('serial_number')}</label>
              <input className="input" placeholder={t('serial_number_placeholder')} {...f('serialNumber')} />
            </div>
            <div>
              <label className="label">{t('entry_date')} <span className="text-red-500">*</span></label>
              <input type="date" className="input" required {...f('entryDate')} />
            </div>
            <div>
              <label className="label">{t('expected_exit_date')} <span className="text-slate-400 font-normal">({t('optional_feminine')})</span></label>
              <input type="date" className="input" {...f('expectedExitDate')} />
            </div>
          </div>
          <div className="mt-4">
            <label className="label">{t('client_reported_issue')}</label>
            <textarea className="input resize-none" rows={3}
              placeholder={t('client_issue_placeholder')}
              {...f('clientDescription')} />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Link href="/interventions" className="btn-secondary">{t('cancel')}</Link>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> {t('creating')}</>
              : <><Save size={16} /> {t('create_intervention')}</>}
          </button>
        </div>
      </form>
    </div>
  );
}