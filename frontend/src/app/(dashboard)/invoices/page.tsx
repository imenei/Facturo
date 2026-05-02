'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { getCachedInvoices, cacheInvoices } from '@/lib/offlineDB';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Search, Eye, Edit, Trash2, FileDown, Loader2,
  FileText, CheckCircle, XCircle, Bell, ArrowUpDown, Hash,
  ShieldCheck, Briefcase,
} from 'lucide-react';

const TYPE_COLORS: Record<string, string> = {
  facture: 'bg-brand-100 text-brand-700',
  proforma: 'bg-purple-100 text-purple-700',
  bon_livraison: 'bg-amber-100 text-amber-700',
};

const WORKFLOW_STEPS = ['commande', 'livraison', 'facturation', 'recouvrement'];
const WORKFLOW_LABELS: Record<string, string> = {
  commande: 'Cmd', livraison: 'Liv', facturation: 'Fact', recouvrement: 'Recouv',
};

function WorkflowBar({ step, t }: { step: string; t: (k: string) => string }) {
  const idx = WORKFLOW_STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-0.5">
      {WORKFLOW_STEPS.map((s, i) => (
        <div key={s} title={t(s)}
          className={clsx('h-1.5 rounded-full transition-all', i <= idx ? 'bg-brand-500' : 'bg-slate-200',
            i === 0 ? 'w-2' : i === 1 ? 'w-3' : i === 2 ? 'w-4' : 'w-5')}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1 capitalize">{WORKFLOW_LABELS[step] || step}</span>
    </div>
  );
}

function PaymentBadge({ status, invoiceId, onUpdate, t }: {
  status: string; invoiceId: string; onUpdate: () => void; t: (k: string) => string;
}) {
  const [loading, setLoading] = useState(false);
  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setLoading(true);
    const next = status === 'paid' ? 'unpaid' : 'paid';
    try {
      await api.patch(`/invoices/${invoiceId}/payment-status`, { paymentStatus: next });
      toast.success(next === 'paid' ? t('marked_paid') : t('marked_unpaid'));
      onUpdate();
    } catch { toast.error(t('error_updating')); }
    setLoading(false);
  };
  if (loading) return <Loader2 size={14} className="animate-spin text-slate-400" />;
  return (
    <button onClick={toggle}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80',
        status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
      )}>
      {status === 'paid' ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {status === 'paid' ? t('paid_status') : t('unpaid_status')}
    </button>
  );
}

// MOD 3: badge showing who created/modified the invoice
function CreatorBadge({ invoice }: { invoice: any }) {
  const creator = invoice.createdBy;
  if (!creator) return null;
  const isAdmin = creator.role === 'admin';
  return (
    <div className="flex items-center gap-1 mt-0.5">
      <span className={clsx(
        'inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium',
        isAdmin ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600',
      )}>
        {isAdmin ? <ShieldCheck size={10} /> : <Briefcase size={10} />}
        {isAdmin ? 'Admin' : creator.name}
      </span>
      {invoice.lastModifiedBy && invoice.lastModifiedBy.id !== creator.id && (
        <span className="text-xs text-slate-400">
          · modif. {invoice.lastModifiedBy.name}
        </span>
      )}
    </div>
  );
}

export default function InvoicesPage() {
  const { user } = useAuthStore();
  const { t } = useI18nStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [numberSearch, setNumberSearch] = useState(''); // MOD 2
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [reminding, setReminding] = useState<string | null>(null);

  const typeLabels: Record<string, string> = {
    facture: t('invoice'),
    proforma: t('proforma'),
    bon_livraison: t('delivery_note'),
  };

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (search) params.client = search;
      if (numberSearch) params.number = numberSearch; // MOD 2
      if (typeFilter) params.type = typeFilter;
      if (paymentFilter) params.paymentStatus = paymentFilter;
      if (dateFilter) params.date = dateFilter;
      if (statusFilter) params.status = statusFilter;

      const [inv, comp] = await Promise.all([
        api.get('/invoices', { params }),
        api.get('/company'),
      ]);
      setInvoices(inv.data);
      setCompany(comp.data);
      await cacheInvoices(inv.data);
    } catch {
      const cached = await getCachedInvoices();
      if (cached.length) { setInvoices(cached); toast(t('offline_mode'), { icon: '📶' }); }
    }
    setLoading(false);
  }, [search, numberSearch, typeFilter, paymentFilter, dateFilter, statusFilter, t]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 300);
    return () => clearTimeout(timer);
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm(t('confirm_delete_invoice'))) return;
    try { await api.delete(`/invoices/${id}`); toast.success(t('deleted')); load(); }
    catch { toast.error(t('error_deleting')); }
  };

  const sendReminder = async (inv: any) => {
    if (!inv.clientEmail && !inv.clientPhone) { toast.error(t('no_contact_for_reminder')); return; }
    setReminding(inv.id);
    try {
      await api.post(`/notifications/send-reminder/${inv.id}`, { channels: { email: !!inv.clientEmail } });
      toast.success(`${t('reminder_sent_to')} ${inv.clientName}`);
    } catch { toast.error(t('error_sending_reminder')); }
    setReminding(null);
  };

  const updateWorkflow = async (id: string, step: string) => {
    try { await api.patch(`/invoices/${id}/workflow`, { step }); load(); }
    catch { toast.error(t('error_updating_workflow')); }
  };

  const activeFiltersCount = [typeFilter, paymentFilter, dateFilter, statusFilter, numberSearch].filter(Boolean).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('invoices_documents')}</h1>
          <p className="text-slate-500 text-sm mt-1">{invoices.length} {t('documents_count')}</p>
        </div>
        <Link href="/invoices/new" className="btn-primary"><Plus size={18} /> {t('new_invoice')}</Link>
      </div>

      <div className="card p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          {/* MOD 2: two search fields - client name + invoice number */}
          <div className="relative flex-1 min-w-44">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={t('search_by_client')} value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="relative min-w-44">
            <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="N° facture (ex: FAC-2025)" value={numberSearch}
              onChange={(e) => setNumberSearch(e.target.value)} />
          </div>
          <select className="input w-auto min-w-36" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{t('all_types')}</option>
            <option value="facture">{t('invoices')}</option>
            <option value="proforma">{t('proformas')}</option>
            <option value="bon_livraison">{t('delivery_notes')}</option>
          </select>
          <select className="input w-auto min-w-36" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="">{t('all_payments')}</option>
            <option value="paid">{t('paid')}</option>
            <option value="unpaid">{t('unpaid')}</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary relative', activeFiltersCount > 0 && 'ring-2 ring-brand-400')}>
            <ArrowUpDown size={15} /> {t('advanced_filters')}
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex gap-3 flex-wrap pt-2 border-t border-slate-100 animate-slide-up">
            <div>
              <label className="label text-xs">{t('exact_date')}</label>
              <input type="date" className="input text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">{t('document_status')}</label>
              <select className="input text-sm w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">{t('all')}</option>
                <option value="brouillon">{t('brouillon')}</option>
                <option value="emise">{t('emise')}</option>
                <option value="payee">{t('payee')}</option>
                <option value="annulee">{t('annulee')}</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => { setTypeFilter(''); setPaymentFilter(''); setDateFilter(''); setStatusFilter(''); setNumberSearch(''); setSearch(''); }}
                className="btn-secondary text-sm py-2">{t('reset_filters')}</button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {[t('number'), t('type'), t('client'), t('amount'), t('payment'), t('workflow'), t('date'), t('actions')].map((h) => (
                    <th key={h} className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <FileText size={36} className="mx-auto mb-3 opacity-30" />
                      {t('no_documents_found')}
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-slate-900">{inv.number}</div>
                      {/* MOD 3: creator badge */}
                      <CreatorBadge invoice={inv} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={clsx('badge whitespace-nowrap', TYPE_COLORS[inv.type])}>
                        {typeLabels[inv.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{inv.clientName}</div>
                      {inv.clientEmail && <div className="text-xs text-slate-400 truncate max-w-36">{inv.clientEmail}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      {Number(inv.total).toLocaleString('fr-DZ')} DZD
                    </td>
                    <td className="px-4 py-3">
                      {inv.type === 'facture' ? (
                        <PaymentBadge status={inv.paymentStatus || 'unpaid'} invoiceId={inv.id} onUpdate={load} t={t} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {inv.workflowStep ? (
                        <div className="relative">
                          <WorkflowBar step={inv.workflowStep} t={t} />
                          {user?.role === 'admin' && (
                            <select className="absolute inset-0 opacity-0 cursor-pointer w-full" value={inv.workflowStep}
                              onChange={(e) => { e.stopPropagation(); updateWorkflow(inv.id, e.target.value); }}>
                              {WORKFLOW_STEPS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          )}
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(inv.createdAt).toLocaleDateString('fr-DZ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link href={`/invoices/${inv.id}`} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-brand-600" title={t('view')}>
                          <Eye size={15} />
                        </Link>
                        <Link href={`/invoices/${inv.id}/edit`} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600" title={t('edit')}>
                          <Edit size={15} />
                        </Link>
                        <button onClick={() => generateInvoicePDF(inv, company)} className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600" title={t('export_pdf')}>
                          <FileDown size={15} />
                        </button>
                        {inv.type === 'facture' && inv.paymentStatus !== 'paid' && (
                          <button onClick={() => sendReminder(inv)} disabled={reminding === inv.id}
                            className="p-1.5 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-500" title={t('send_reminder')}>
                            {reminding === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(inv.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500" title={t('delete')}>
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invoices.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>{t('total_amount')} : <strong className="text-slate-900">
                {invoices.reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
              <span>{t('paid_amount')} : <strong className="text-emerald-700">
                {invoices.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
              <span>{t('unpaid_amount')} : <strong className="text-red-600">
                {invoices.filter((i) => i.paymentStatus !== 'paid' && i.type === 'facture').reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
