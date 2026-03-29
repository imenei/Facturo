'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { generateInvoiceWord } from '@/lib/wordGenerator';
import { getCachedInvoices, cacheInvoices } from '@/lib/offlineDB';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, Search, Eye, Edit, Trash2, FileDown, Loader2,
  FileText, CheckCircle, XCircle, Bell, ChevronDown, ArrowUpDown,
} from 'lucide-react';

/* ── constants ─────────────────────────────── */
const TYPE_COLORS: Record<string, string> = {
  facture: 'bg-brand-100 text-brand-700',
  proforma: 'bg-purple-100 text-purple-700',
  bon_livraison: 'bg-amber-100 text-amber-700',
};
const TYPE_LABELS: Record<string, string> = {
  facture: 'Facture',
  proforma: 'Proforma',
  bon_livraison: 'Bon livraison',
};
const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  emise: 'bg-blue-100 text-blue-700',
  payee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-red-100 text-red-700',
};
const WORKFLOW_STEPS = ['commande', 'livraison', 'facturation', 'recouvrement'];
const WORKFLOW_LABELS: Record<string, string> = {
  commande: 'Cmd', livraison: 'Liv', facturation: 'Fact', recouvrement: 'Recouv',
};

/* ── Workflow mini-bar ──────────────────────── */
function WorkflowBar({ step }: { step: string }) {
  const idx = WORKFLOW_STEPS.indexOf(step);
  return (
    <div className="flex items-center gap-0.5">
      {WORKFLOW_STEPS.map((s, i) => (
        <div key={s} title={s}
          className={clsx('h-1.5 rounded-full transition-all', i <= idx ? 'bg-brand-500' : 'bg-slate-200',
            i === 0 ? 'w-2' : i === 1 ? 'w-3' : i === 2 ? 'w-4' : 'w-5')}
        />
      ))}
      <span className="text-xs text-slate-400 ml-1 capitalize">{WORKFLOW_LABELS[step] || step}</span>
    </div>
  );
}

/* ── Payment status toggle ──────────────────── */
function PaymentBadge({ status, invoiceId, onUpdate }: { status: string; invoiceId: string; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    const next = status === 'paid' ? 'unpaid' : 'paid';
    try {
      await api.patch(`/invoices/${invoiceId}/payment-status`, { paymentStatus: next });
      toast.success(next === 'paid' ? 'Marquée payée ✓' : 'Marquée non payée');
      onUpdate();
    } catch { toast.error('Erreur'); }
    setLoading(false);
  };

  if (loading) return <Loader2 size={14} className="animate-spin text-slate-400" />;

  return (
    <button onClick={toggle}
      className={clsx(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all hover:opacity-80',
        status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
      )}>
      {status === 'paid' ? <CheckCircle size={11} /> : <XCircle size={11} />}
      {status === 'paid' ? 'Payée' : 'Impayée'}
    </button>
  );
}

/* ── Main page ──────────────────────────────── */
export default function InvoicesPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<any>(null);

  // Filters (mod #6 — server-side)
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Reminder state
  const [reminding, setReminding] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params: any = {};
      if (search) params.client = search;
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
      if (cached.length) { setInvoices(cached); toast('Mode hors-ligne', { icon: '📶' }); }
    }
    setLoading(false);
  }, [search, typeFilter, paymentFilter, dateFilter, statusFilter]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette facture ?')) return;
    try { await api.delete(`/invoices/${id}`); toast.success('Supprimée'); load(); }
    catch { toast.error('Erreur'); }
  };

  const sendReminder = async (inv: any) => {
    if (!inv.clientEmail && !inv.clientPhone) {
      toast.error('Aucun contact client pour envoyer un rappel');
      return;
    }
    setReminding(inv.id);
    try {
      const channels = { email: !!inv.clientEmail, whatsapp: false, sms: false };
      await api.post(`/notifications/send-reminder/${inv.id}`, { channels });
      toast.success(`Rappel envoyé à ${inv.clientName}`);
    } catch { toast.error('Erreur envoi rappel'); }
    setReminding(null);
  };

  const updateWorkflow = async (id: string, step: string) => {
    try {
      await api.patch(`/invoices/${id}/workflow`, { step });
      load();
    } catch { toast.error('Erreur'); }
  };

  const activeFiltersCount = [typeFilter, paymentFilter, dateFilter, statusFilter].filter(Boolean).length;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">Factures & Documents</h1>
          <p className="text-slate-500 text-sm mt-1">{invoices.length} document{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <Link href="/invoices/new" className="btn-primary"><Plus size={18} /> Nouvelle facture</Link>
      </div>

      {/* Search + filters */}
      <div className="card p-4 mb-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-52">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Rechercher par client…" value={search}
              onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-auto min-w-36" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Tous les types</option>
            <option value="facture">Factures</option>
            <option value="proforma">Proformas</option>
            <option value="bon_livraison">Bons de livraison</option>
          </select>
          <select className="input w-auto min-w-36" value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
            <option value="">Tout paiement</option>
            <option value="paid">Payées</option>
            <option value="unpaid">Impayées</option>
          </select>
          <button onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary relative', activeFiltersCount > 0 && 'ring-2 ring-brand-400')}>
            <ArrowUpDown size={15} /> Filtres avancés
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-brand-600 text-white text-xs rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Advanced filters */}
        {showFilters && (
          <div className="flex gap-3 flex-wrap pt-2 border-t border-slate-100 animate-slide-up">
            <div>
              <label className="label text-xs">Date exacte</label>
              <input type="date" className="input text-sm" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Statut document</label>
              <select className="input text-sm w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="">Tous</option>
                <option value="brouillon">Brouillon</option>
                <option value="emise">Émise</option>
                <option value="payee">Payée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={() => { setTypeFilter(''); setPaymentFilter(''); setDateFilter(''); setStatusFilter(''); }}
                className="btn-secondary text-sm py-2">Réinitialiser</button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  {['N°', 'Type', 'Client', 'Montant', 'Paiement', 'Workflow', 'Date', 'Actions'].map((h) => (
                    <th key={h} className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-slate-400">
                      <FileText size={36} className="mx-auto mb-3 opacity-30" />
                      Aucun document trouvé
                    </td>
                  </tr>
                )}
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">

                    {/* N° */}
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900 whitespace-nowrap">
                      {inv.number}
                    </td>

                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className={clsx('badge whitespace-nowrap', TYPE_COLORS[inv.type])}>
                        {TYPE_LABELS[inv.type]}
                      </span>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{inv.clientName}</div>
                      {inv.clientEmail && <div className="text-xs text-slate-400 truncate max-w-36">{inv.clientEmail}</div>}
                    </td>

                    {/* Montant */}
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      {Number(inv.total).toLocaleString('fr-DZ')} DZD
                    </td>

                    {/* Payment status (mod #2) */}
                    <td className="px-4 py-3">
                      {inv.type === 'facture' ? (
                        <PaymentBadge status={inv.paymentStatus || 'unpaid'} invoiceId={inv.id} onUpdate={load} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>

                    {/* Workflow (mod #2) */}
                    <td className="px-4 py-3">
                      {inv.workflowStep ? (
                        <div className="group/wf relative">
                          <WorkflowBar step={inv.workflowStep} />
                          {/* Dropdown to change step */}
                          {user?.role === 'admin' && (
                            <select
                              className="absolute inset-0 opacity-0 cursor-pointer w-full"
                              value={inv.workflowStep}
                              onChange={(e) => { e.stopPropagation(); updateWorkflow(inv.id, e.target.value); }}>
                              {WORKFLOW_STEPS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      ) : <span className="text-xs text-slate-400">—</span>}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                      {new Date(inv.createdAt).toLocaleDateString('fr-DZ')}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <Link href={`/invoices/${inv.id}`}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-brand-600 transition-colors" title="Voir">
                          <Eye size={15} />
                        </Link>
                        <Link href={`/invoices/${inv.id}/edit`}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-amber-600 transition-colors" title="Modifier">
                          <Edit size={15} />
                        </Link>
                        <button onClick={() => generateInvoicePDF(inv, company)}
                          className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-red-600 transition-colors" title="Export PDF">
                          <FileDown size={15} />
                        </button>
                        {/* Reminder button for unpaid invoices */}
                        {inv.type === 'facture' && inv.paymentStatus !== 'paid' && (
                          <button onClick={() => sendReminder(inv)} disabled={reminding === inv.id}
                            className="p-1.5 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-500 transition-colors" title="Envoyer rappel">
                            {reminding === inv.id ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => handleDelete(inv.id)}
                            className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors" title="Supprimer">
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

          {/* Summary footer */}
          {invoices.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-4 text-xs text-slate-500">
              <span>Total : <strong className="text-slate-900">
                {invoices.reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
              <span>Payé : <strong className="text-emerald-700">
                {invoices.filter((i) => i.paymentStatus === 'paid').reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
              <span>Impayé : <strong className="text-red-600">
                {invoices.filter((i) => i.paymentStatus !== 'paid' && i.type === 'facture').reduce((s, i) => s + Number(i.total), 0).toLocaleString('fr-DZ')} DZD
              </strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
