'use client';
// frontend/src/app/(dashboard)/interventions/page.tsx
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Search, Wrench, Cpu, Wifi, Zap, Settings, HelpCircle,
  Clock, PlayCircle, CheckCircle, XCircle, Pause, Loader2,
  Eye, Trash2, History, ArrowLeft, Filter,
} from 'lucide-react';

const STATUS_CONFIG = {
  en_attente:   { labelKey: 'status_pending', color: 'bg-amber-100 text-amber-700',    icon: Clock },
  en_cours:     { labelKey: 'status_in_progress', color: 'bg-blue-100 text-blue-700',      icon: PlayCircle },
  en_pause:     { labelKey: 'status_paused', color: 'bg-slate-100 text-slate-600',    icon: Pause },
  terminee:     { labelKey: 'status_done', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  non_reparee:  { labelKey: 'status_not_repaired', color: 'bg-red-100 text-red-600',        icon: XCircle },
} as const;

const WORK_TYPES = [
  { value: 'electronique', labelKey: 'work_type_electronic', icon: Zap },
  { value: 'informatique', labelKey: 'work_type_it', icon: Cpu },
  { value: 'reseau',       labelKey: 'work_type_network', icon: Wifi },
  { value: 'electrique',   labelKey: 'work_type_electrical', icon: Zap },
  { value: 'mecanique',    labelKey: 'work_type_mechanical', icon: Settings },
  { value: 'autre',        labelKey: 'work_type_other', icon: HelpCircle },
];

function StatusBadge({ status, t }: { status: string; t: (k: string) => string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.en_attente;
  const Icon = cfg.icon;
  return (
    <span className={clsx('badge flex items-center gap-1', cfg.color)}>
      <Icon size={11} />{t(cfg.labelKey)}
    </span>
  );
}

export default function InterventionsListPage() {
  const { user } = useAuthStore();
  const { t } = useI18nStore();
  const isTech = user?.role === 'technicien';
  const isAdmin = user?.role === 'admin';

  const [interventions, setInterventions] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWork, setFilterWork] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // History search
  const [showHistory, setShowHistory] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyType, setHistoryType] = useState<'machine' | 'client'>('machine');
  const [historyResults, setHistoryResults] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (filterStatus) params.status = filterStatus;
      if (filterWork)   params.workType = filterWork;
      if (search)       params.clientName = search;
      const [iv, st] = await Promise.all([
        api.get('/interventions', { params }),
        api.get('/interventions/stats'),
      ]);
      setInterventions(iv.data);
      setStats(st.data);
    } catch { toast.error(t('error_loading')); }
    setLoading(false);
  }, [filterStatus, filterWork, search]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const remove = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    try { await api.delete(`/interventions/${id}`); toast.success(t('deleted_feminine')); load(); }
    catch { toast.error(t('error')); }
  };

  const searchHistory = async () => {
    if (!historyQuery.trim()) return;
    setHistoryLoading(true);
    try {
      const url = historyType === 'machine'
        ? `/interventions/history/machine?serialNumber=${encodeURIComponent(historyQuery)}`
        : `/interventions/history/client?clientName=${encodeURIComponent(historyQuery)}`;
      const { data } = await api.get(url);
      setHistoryResults(data);
    } catch { toast.error(t('error')); }
    setHistoryLoading(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">
            {isTech ? t('my_interventions') : t('interventions_management')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{interventions.length} {t('interventions_count')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowHistory(!showHistory)} className="btn-secondary">
            <History size={16} /> {t('history')}
          </button>
          {(isAdmin || isTech) && (
            <Link href="/interventions/new" className="btn-primary">
              <Plus size={18} /> {t('new')}
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: t('total'),      value: stats.total,      color: 'text-slate-900', bg: 'bg-white' },
            { label: t('in_progress'),   value: stats.inProgress, color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: t('completed_feminine_plural'),  value: stats.done,       color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: isTech ? t('earned') : t('revenue'),
              value: `${Number(stats.totalEarned || stats.totalRevenue || 0).toLocaleString('fr-FR')} DZD`,
              color: 'text-brand-600', bg: 'bg-brand-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={clsx('card p-4', bg)}>
              <div className={clsx('text-xl font-display font-700 truncate', color)}>{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* History */}
      {showHistory && (
        <div className="card p-5 mb-5 border-2 border-brand-100 animate-slide-up">
          <h3 className="font-display font-600 text-slate-900 mb-3 flex items-center gap-2">
            <History size={16} className="text-brand-500" /> {t('history_search')}
          </h3>
          <div className="flex gap-2 mb-3">
            {(['machine', 'client'] as const).map((typeKey) => (
              <button key={typeKey} onClick={() => setHistoryType(typeKey)}
                className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  historyType === typeKey ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
                {typeKey === 'machine' ? `🔧 ${t('by_serial_number')}` : `👤 ${t('by_client')}`}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input className="input flex-1" value={historyQuery} onChange={e => setHistoryQuery(e.target.value)}
              placeholder={historyType === 'machine' ? t('serial_number_placeholder_search') : t('client_name_placeholder_search')}
              onKeyDown={e => e.key === 'Enter' && searchHistory()} />
            <button onClick={searchHistory} disabled={historyLoading} className="btn-primary px-4">
              {historyLoading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>
          {historyResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs text-slate-400">{historyResults.length} {t('results_count')}</p>
              {historyResults.map(h => (
                <Link key={h.id} href={`/interventions/${h.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:border-brand-300 hover:bg-brand-50 transition-all">
                  <div className="min-w-0">
                    <span className="font-mono text-xs text-slate-400">{h.ticketNumber}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-sm font-medium text-slate-900">{h.machineName} {h.machineBrand}</span>
                    <span className="mx-2 text-slate-300">·</span>
                    <span className="text-sm text-slate-500 truncate">{h.clientName}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <StatusBadge status={h.status} t={t} />
                    <span className="text-xs text-slate-400">{new Date(h.entryDate).toLocaleDateString('fr-FR')}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 mb-5">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={t('search_by_client')} value={search}
              onChange={e => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">{t('all_statuses')}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{t(v.labelKey)}</option>)}
          </select>
          <select className="input w-auto" value={filterWork} onChange={e => setFilterWork(e.target.value)}>
            <option value="">{t('all_types')}</option>
            {WORK_TYPES.map(w => <option key={w.value} value={w.value}>{t(w.labelKey)}</option>)}
          </select>
        </div>
        {/* Status quick filters */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {['', ...Object.keys(STATUS_CONFIG)].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={clsx('px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                filterStatus === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {s === '' ? t('all_feminine_plural') : t(STATUS_CONFIG[s as keyof typeof STATUS_CONFIG].labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          {/* Mobile: cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {interventions.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                <Wrench size={32} className="mx-auto mb-3 opacity-30" />{t('no_intervention')}
              </div>
            )}
            {interventions.map(iv => (
              <Link key={iv.id} href={`/interventions/${iv.id}`} className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0">
                  <Wrench size={18} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-400">{iv.ticketNumber}</span>
                    <StatusBadge status={iv.status} t={t} />
                  </div>
                  <div className="font-medium text-slate-900 text-sm truncate">{iv.machineName} · {iv.clientName}</div>
                  <div className="text-xs text-slate-400">{new Date(iv.entryDate).toLocaleDateString('fr-FR')}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-700 text-sm text-brand-600">{Number(iv.totalPrice).toLocaleString('fr-FR')} DZD</div>
                </div>
              </Link>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[t('ticket_number'), t('type'), t('client'), t('machine_serial'), t('status'), t('technician'), t('entry'), t('total'), ''].map(h => (
                    <th key={h} className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {interventions.length === 0 && (
                  <tr><td colSpan={9} className="text-center py-12 text-slate-400">
                    <Wrench size={32} className="mx-auto mb-3 opacity-30" />{t('no_intervention')}
                  </td></tr>
                )}
                {interventions.map(iv => {
                  const wt = WORK_TYPES.find(w => w.value === iv.workType);
                  const WIcon = wt?.icon || HelpCircle;
                  return (
                    <tr key={iv.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-slate-700 whitespace-nowrap">{iv.ticketNumber}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <WIcon size={13} />{wt ? t(wt.labelKey) : ''}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm font-medium text-slate-900">{iv.clientName}</div>
                        {iv.clientPhone && <div className="text-xs text-slate-400">{iv.clientPhone}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-700">{iv.machineName} {iv.machineBrand && `(${iv.machineBrand})`}</div>
                        {iv.serialNumber && <div className="font-mono text-xs text-slate-400">SN: {iv.serialNumber}</div>}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={iv.status} t={t} /></td>
                      <td className="px-4 py-3 text-sm text-slate-500">{iv.assignedTo?.name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{new Date(iv.entryDate).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{Number(iv.totalPrice).toLocaleString('fr-FR')} DZD</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/interventions/${iv.id}`}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-brand-600 transition-colors">
                            <Eye size={15} />
                          </Link>
                          {isAdmin && (
                            <button onClick={() => remove(iv.id)}
                              className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors">
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}