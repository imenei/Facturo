'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Search, FileText, Package, Loader2, ArrowLeft, Trash2,
  Camera, Upload, AlertCircle, TrendingUp, BarChart3,
  CalendarDays, ShoppingBag, ChevronRight,
} from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

function resolveLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function ClientAvatar({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const resolved = resolveLogoUrl(logoUrl);
  const sizes = { sm: 'w-9 h-9 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' };
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700', 'bg-indigo-100 text-indigo-700',
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  if (resolved) {
    return (
      <div className={clsx('rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200', sizes[size])}>
        <img src={resolved} alt={name} className="w-full h-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  return (
    <div className={clsx('rounded-xl flex items-center justify-center font-700 shrink-0 uppercase', sizes[size], color)}>
      {name?.charAt(0) || '?'}
    </div>
  );
}

// MOD 1: Unpaid badge for client list
function UnpaidBadge({ amount, count, t }: { amount: number; count: number; t: (k: string) => string }) {
  if (!amount || amount <= 0) return null;
  const days = 30; // simplified
  return (
    <div className={clsx(
      'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
      amount > 100000 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700',
    )}>
      <AlertCircle size={10} />
      {Number(amount).toLocaleString('fr-DZ')} DZD {t('unpaid')}{count > 1 ? ` (${count})` : ''}
    </div>
  );
}

// MOD 5: Detailed client view with tabs
function ClientDetail({ client, onBack, t }: { client: any; onBack: () => void; t: (k: string, vars?: Record<string, string>) => string }) {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'summary' | 'factures' | 'products' | 'stats'>('summary');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/clients/${client.clientId}/details`)
      .then(({ data }) => setDetails(data))
      .catch(() => toast.error(t('error_loading_documents')))
      .finally(() => setLoading(false));
  }, [client.clientId]);

  if (loading) return (
    <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
  );

  const d = details;
  const payBadge = (status: string) =>
    status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600';

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.patch(`/clients/${client.clientId}/logo`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success(t('logo_updated'));
    } catch { toast.error(t('error_uploading_logo')); }
    e.target.value = '';
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 mt-1 shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-4 flex-1 flex-wrap">
          <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
            <ClientAvatar name={d?.clientName || client.clientName} logoUrl={d?.clientLogoUrl || client.clientLogoUrl} size="lg" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
              <Upload size={16} className="text-white" />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
          </div>
          <div>
            <h1 className="text-2xl font-display font-700 text-slate-900">{d?.clientName}</h1>
            <p className="text-slate-500 text-sm">{d?.clientEmail}{d?.clientPhone ? ` · ${d.clientPhone}` : ''}</p>
            {d?.clientAddress && <p className="text-slate-400 text-xs">{d.clientAddress}</p>}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        {(['summary', 'factures', 'products', 'stats'] as const).map((tabKey) => {
          const labels = { summary: t('summary'), factures: t('invoices'), products: t('products'), stats: t('statistics') };
          return (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={clsx(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === tabKey
                  ? 'border-brand-500 text-brand-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              )}>
              {labels[tabKey]}
            </button>
          );
        })}
      </div>

      {/* Tab: Summary */}
      {tab === 'summary' && d && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: t('total_revenue'), value: `${Number(d.summary.totalRevenue).toLocaleString('fr-DZ')} DZD`, color: 'text-brand-600' },
            { label: t('paid'), value: `${Number(d.summary.totalPaid).toLocaleString('fr-DZ')} DZD`, color: 'text-emerald-600' },
            { label: t('unpaid'), value: `${Number(d.summary.totalUnpaid).toLocaleString('fr-DZ')} DZD`, color: 'text-red-600' },
            { label: t('invoices'), value: d.summary.facturesCount, color: 'text-slate-900' },
            { label: t('average_basket'), value: `${Number(d.summary.averageInvoice).toLocaleString('fr-DZ')} DZD`, color: 'text-slate-900' },
            { label: t('total_documents'), value: d.summary.totalDocuments, color: 'text-slate-900' },
          ].map((item) => (
            <div key={item.label} className="card p-4">
              <p className="text-xs text-slate-500 mb-1">{item.label}</p>
              <p className={clsx('text-xl font-display font-700', item.color)}>{item.value}</p>
            </div>
          ))}
          {d.summary.firstOrder && (
            <div className="card p-4 md:col-span-3 flex gap-6 text-sm text-slate-600">
              <span><CalendarDays size={14} className="inline mr-1" />{t('first_order')}: <strong>{new Date(d.summary.firstOrder).toLocaleDateString('fr-FR')}</strong></span>
              <span><CalendarDays size={14} className="inline mr-1" />{t('last_order')}: <strong>{new Date(d.summary.lastOrder).toLocaleDateString('fr-FR')}</strong></span>
            </div>
          )}
          {/* MOD 1: unpaid alert */}
          {d.summary.totalUnpaid > 0 && (
            <div className="card p-4 md:col-span-3 border-l-4 border-red-400 bg-red-50">
              <div className="flex items-center gap-2 text-red-700 font-medium">
                <AlertCircle size={16} />
                {d.summary.totalUnpaid.toLocaleString('fr-DZ')} DZD {t('unpaid_on_invoices', { count: String(d.factures.filter((f: any) => f.paymentStatus === 'unpaid').length) })}
              </div>
              <Link href={`/invoices?client=${encodeURIComponent(d.clientName)}&paymentStatus=unpaid`}
                className="text-sm text-red-600 hover:underline mt-1 inline-block">
                {t('view_unpaid_invoices')} →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Tab: Factures */}
      {tab === 'factures' && d && (
        <div className="space-y-2">
          {d.factures.length === 0 && <p className="text-center text-slate-400 py-8">Aucune facture</p>}
          {d.factures.map((inv: any) => (
            <Link key={inv.id} href={`/invoices/${inv.id}`}
              className="flex items-center justify-between p-4 rounded-xl bg-white border border-slate-200 hover:border-brand-300 transition-all">
              <div>
                <div className="font-mono text-sm font-semibold text-slate-900">{inv.number}</div>
                <div className="text-xs text-slate-400">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</div>
                {/* MOD 3: creator */}
                {inv.createdBy && (
                  <div className={clsx('text-xs mt-0.5', inv.createdBy.role === 'admin' ? 'text-blue-500' : 'text-violet-500')}>
                    {inv.createdBy.role === 'admin' ? '🛡 Admin' : `💼 ${inv.createdBy.name}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className={clsx('badge text-xs', payBadge(inv.paymentStatus))}>
                  {inv.paymentStatus === 'paid' ? t('paid') : t('unpaid')}
                </span>
                <span className="font-display font-700 text-slate-900">{Number(inv.total).toLocaleString('fr-DZ')} DZD</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Tab: Products — MOD 5 */}
      {tab === 'products' && d && (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[t('product'), t('total_quantity'), t('total_revenue_short'), t('last_order')].map((h) => (
                  <th key={h} className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {d.products.length === 0 && (
                <tr><td colSpan={4} className="text-center py-8 text-slate-400"><ShoppingBag size={28} className="mx-auto mb-2 opacity-30" />{t('no_products')}</td></tr>
              )}
              {d.products.map((p: any) => (
                <tr key={p.name} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.qty}</td>
                  <td className="px-4 py-3 font-semibold text-brand-600">{Number(p.revenue).toLocaleString('fr-DZ')} DZD</td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.lastDate).toLocaleDateString('fr-FR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab: Stats — MOD 5 */}
      {tab === 'stats' && d && (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-display font-600 text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 size={18} className="text-brand-500" /> {t('monthly_revenue')}
            </h3>
            {d.monthlyRevenue.length === 0 ? (
              <p className="text-slate-400 text-sm">{t('no_data')}</p>
            ) : (
              <div className="space-y-2">
                {d.monthlyRevenue.map((m: any) => {
                  const max = Math.max(...d.monthlyRevenue.map((x: any) => Number(x.revenue)));
                  const pct = max > 0 ? (Number(m.revenue) / max) * 100 : 0;
                  return (
                    <div key={m.month} className="flex items-center gap-3">
                      <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-900 w-32 text-right shrink-0">
                        {Number(m.revenue).toLocaleString('fr-DZ')} DZD
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  const { t } = useI18nStore();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);

  const load = async (q?: string) => {
    try {
      const { data } = await api.get('/clients', { params: q ? { name: q } : {} });
      setClients(data);
    } catch { toast.error(t('error_loading_clients')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (selected) {
    return <ClientDetail client={selected} onBack={() => setSelected(null)} t={t} />;
  }

  const filtered = clients.filter((c) =>
    !search || c.clientName?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('clients')}</h1>
          <p className="text-slate-500 text-sm mt-1">{clients.length} {t('clients_count')}</p>
        </div>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9 max-w-sm" placeholder={t('search_client')} value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="card p-12 text-center text-slate-400">
              <FileText size={36} className="mx-auto mb-3 opacity-30" />
              {t('no_clients_found')}
            </div>
          )}
          {filtered.map((client) => (
            <button key={client.clientId || client.clientName}
              onClick={() => setSelected(client)}
              className="card p-4 w-full text-left hover:shadow-md hover:border-brand-200 transition-all flex items-center gap-4">
              <ClientAvatar name={client.clientName} logoUrl={client.clientLogoUrl} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-display font-600 text-slate-900">{client.clientName}</h3>
                  {/* MOD 1: unpaid badge */}
                  {Number(client.unpaidAmount) > 0 && (
                  <UnpaidBadge amount={Number(client.unpaidAmount)} count={Number(client.unpaidCount)} t={t} />
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap gap-2">
                  {client.clientEmail && <span>{client.clientEmail}</span>}
                  {client.clientPhone && <span>{client.clientPhone}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-700 text-brand-600">
                  {Number(client.totalAmount || 0).toLocaleString('fr-DZ')} DZD
                </div>
                <div className="text-xs text-slate-400">{client.documentCount} documents</div>
              </div>
              <ChevronRight size={16} className="text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
