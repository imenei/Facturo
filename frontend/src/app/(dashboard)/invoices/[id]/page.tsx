'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { generateInvoiceWord } from '@/lib/wordGenerator';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, FileDown, FileText, Edit, Truck, CheckCircle,
  XCircle, Loader2, Bell, Send, ChevronRight, Mail,
  MessageCircle, Phone, AlertTriangle,
} from 'lucide-react';
import Link from 'next/link';

/* ─── constants ─────────────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  emise: 'bg-blue-100 text-blue-700',
  payee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-red-100 text-red-700',
};
const DELIVERY_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  livree: 'bg-emerald-100 text-emerald-700',
  non_livree: 'bg-red-100 text-red-600',
};
const WORKFLOW_STEPS = ['commande', 'livraison', 'facturation', 'recouvrement'];
const WORKFLOW_LABELS: Record<string, string> = {
  commande: 'Commande', livraison: 'Livraison', facturation: 'Facturation', recouvrement: 'Recouvrement',
};

/* ─── Workflow stepper ──────────────────────── */
function WorkflowStepper({ current, invoiceId, onUpdate, canEdit }: any) {
  const [updating, setUpdating] = useState(false);
  const currentIdx = WORKFLOW_STEPS.indexOf(current);

  const advance = async (step: string) => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      await api.patch(`/invoices/${invoiceId}/workflow`, { step });
      onUpdate();
      toast.success('Workflow mis à jour');
    } catch { toast.error('Erreur'); }
    setUpdating(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const isNext = i === currentIdx + 1;
        return (
          <div key={step} className="flex items-center">
            <button
              onClick={() => advance(step)}
              disabled={!canEdit || updating || i > currentIdx + 1}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500',
                isNext && canEdit && 'ring-2 ring-brand-300 ring-offset-1 cursor-pointer hover:bg-brand-50',
                !canEdit || (i > currentIdx + 1) ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              {done ? <CheckCircle size={11} /> : <div className="w-2 h-2 rounded-full bg-current opacity-40" />}
              {WORKFLOW_LABELS[step]}
            </button>
            {i < WORKFLOW_STEPS.length - 1 && (
              <ChevronRight size={14} className={clsx('mx-0.5', done && i < currentIdx ? 'text-brand-400' : 'text-slate-300')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Reminder panel ────────────────────────── */
function ReminderPanel({ invoice }: { invoice: any }) {
  const [sending, setSending] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});

  const send = async (channel: 'email' | 'whatsapp' | 'sms') => {
    setSending(channel);
    try {
      const { data } = await api.post(`/notifications/send-reminder/${invoice.id}`, {
        channels: { [channel]: true },
      });
      setResults((p) => ({ ...p, ...data }));
      const r = data[channel];
      if (r?.success) toast.success(r.message);
      else toast.error(r?.message || 'Échec');
    } catch { toast.error('Erreur'); }
    setSending(null);
  };

  const channels = [
    { key: 'email', icon: Mail, label: 'Email', available: !!invoice.clientEmail, hint: invoice.clientEmail },
    { key: 'whatsapp', icon: MessageCircle, label: 'WhatsApp', available: !!invoice.clientPhone, hint: invoice.clientPhone },
    { key: 'sms', icon: Phone, label: 'SMS', available: !!invoice.clientPhone, hint: invoice.clientPhone },
  ] as const;

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={16} className="text-amber-500" />
        <h3 className="font-display font-600 text-slate-900">Rappel de paiement</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {channels.map(({ key, icon: Icon, label, available, hint }) => {
          const r = results[key];
          return (
            <div key={key} className="space-y-1">
              <button
                onClick={() => send(key)}
                disabled={!available || sending === key}
                title={!available ? 'Contact manquant' : hint}
                className={clsx(
                  'w-full flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 text-xs font-medium transition-all',
                  !available ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' :
                  r?.success ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                  r && !r.success ? 'border-red-300 bg-red-50 text-red-600' :
                  'border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-600 cursor-pointer'
                )}>
                {sending === key ? <Loader2 size={18} className="animate-spin" /> : <Icon size={18} />}
                {label}
              </button>
              {r && (
                <p className={clsx('text-xs text-center leading-tight', r.success ? 'text-emerald-600' : 'text-red-500')}>
                  {r.success ? '✓ Envoyé' : '✗ Échec'}
                </p>
              )}
            </div>
          );
        })}
      </div>
      {!invoice.clientEmail && !invoice.clientPhone && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
          <AlertTriangle size={12} /> Ajoutez un email ou téléphone client pour envoyer des rappels
        </p>
      )}
    </div>
  );
}

/* ─── Main page ─────────────────────────────── */
export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const { user } = useAuthStore();

  const load = async () => {
    try {
      const [inv, comp] = await Promise.all([api.get(`/invoices/${id}`), api.get('/company')]);
      setInvoice(inv.data);
      setCompany(comp.data);
    } catch { toast.error('Erreur chargement'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const togglePayment = async () => {
    const next = invoice.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    setUpdatingPayment(true);
    try {
      await api.patch(`/invoices/${id}/payment-status`, { paymentStatus: next });
      setInvoice((p: any) => ({ ...p, paymentStatus: next }));
      toast.success(next === 'paid' ? 'Facture marquée payée ✓' : 'Marquée non payée');
    } catch { toast.error('Erreur'); }
    setUpdatingPayment(false);
  };

  const updateStatus = async (status: string) => {
    try {
      await api.put(`/invoices/${id}`, { status });
      setInvoice((p: any) => ({ ...p, status }));
      toast.success('Statut mis à jour');
    } catch { toast.error('Erreur'); }
  };

  const updateDelivery = async (status: string) => {
    try {
      await api.patch(`/invoices/${id}/delivery-status`, { status });
      setInvoice((p: any) => ({ ...p, deliveryStatus: status }));
      toast.success('Livraison mise à jour');
    } catch { toast.error('Erreur'); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;
  if (!invoice) return <div className="p-8 text-slate-500">Facture introuvable</div>;

  const isAdmin = user?.role === 'admin';
  const isUnpaid = invoice.type === 'facture' && invoice.paymentStatus !== 'paid';

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-700 text-slate-900">{invoice.number}</h1>
              <span className={clsx('badge', STATUS_COLORS[invoice.status])}>{invoice.status}</span>
              <span className={clsx('badge', DELIVERY_COLORS[invoice.deliveryStatus])}>
                {invoice.deliveryStatus?.replace('_', ' ')}
              </span>
              {/* Payment badge */}
              {invoice.type === 'facture' && (
                <button onClick={togglePayment} disabled={updatingPayment}
                  className={clsx(
                    'badge cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1',
                    invoice.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                  )}>
                  {updatingPayment ? <Loader2 size={10} className="animate-spin" /> :
                    invoice.paymentStatus === 'paid' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {invoice.paymentStatus === 'paid' ? 'Payée' : 'Impayée'}
                </button>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-1">
              {invoice.clientName} · {new Date(invoice.createdAt).toLocaleDateString('fr-DZ')}
              {invoice.dueDate && ` · Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-DZ')}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button onClick={() => generateInvoicePDF(invoice, company)} className="btn-secondary text-sm">
            <FileDown size={15} /> PDF
          </button>
          <button onClick={() => generateInvoiceWord(invoice, company)} className="btn-secondary text-sm">
            <FileText size={15} /> Word
          </button>
          <Link href={`/invoices/${id}/edit`} className="btn-primary text-sm">
            <Edit size={15} /> Modifier
          </Link>
        </div>
      </div>

      {/* Workflow stepper (mod #2) */}
      {invoice.workflowStep && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-600 text-slate-500 mb-3">Progression du dossier</h3>
          <WorkflowStepper
            current={invoice.workflowStep}
            invoiceId={invoice.id}
            onUpdate={load}
            canEdit={isAdmin}
          />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        {/* Client */}
        <div className="card p-5">
          <h3 className="font-display font-600 text-slate-900 mb-3">Informations client</h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900 text-base">{invoice.clientName}</p>
            {invoice.clientAddress && <p className="text-slate-500">{invoice.clientAddress}</p>}
            {invoice.clientPhone && <p>📞 {invoice.clientPhone}</p>}
            {invoice.clientEmail && <p>📧 {invoice.clientEmail}</p>}
            {invoice.clientNif && <p className="font-mono text-xs">NIF: {invoice.clientNif}</p>}
            {invoice.clientNis && <p className="font-mono text-xs">NIS: {invoice.clientNis}</p>}
          </div>
          {/* Link to client view */}
          {invoice.clientId && (
            <Link href={`/clients`} className="mt-3 text-xs text-brand-600 hover:underline flex items-center gap-1">
              Voir tous les documents de ce client <ChevronRight size={12} />
            </Link>
          )}
        </div>

        {/* Admin controls */}
        {isAdmin ? (
          <div className="card p-5 space-y-4">
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Statut document</p>
              <div className="flex flex-wrap gap-1.5">
                {['brouillon', 'emise', 'payee', 'annulee'].map((s) => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-all capitalize',
                      invoice.status === s ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'
                    )}>{s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Statut livraison</p>
              <div className="flex flex-wrap gap-1.5">
                {['en_attente', 'livree', 'non_livree'].map((s) => (
                  <button key={s} onClick={() => updateDelivery(s)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-all',
                      invoice.deliveryStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50'
                    )}>{s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Reminder panel for commercial on unpaid invoices */
          isUnpaid && <ReminderPanel invoice={invoice} />
        )}
      </div>

      {/* Reminder panel for admin on unpaid */}
      {isAdmin && isUnpaid && <div className="mb-6"><ReminderPanel invoice={invoice} /></div>}

      {/* Items table */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-display font-600 text-slate-900">Articles</h3>
          <span className="text-sm text-slate-400">{invoice.items?.length} article{invoice.items?.length !== 1 ? 's' : ''}</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-600 text-slate-500 px-5 py-3 uppercase">Désignation</th>
              <th className="text-center text-xs font-600 text-slate-500 px-4 py-3 uppercase">Qté</th>
              <th className="text-right text-xs font-600 text-slate-500 px-4 py-3 uppercase">Prix unitaire</th>
              <th className="text-right text-xs font-600 text-slate-500 px-5 py-3 uppercase">Total HT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoice.items?.map((item: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 text-sm text-slate-700">{item.description}</td>
                <td className="px-4 py-3 text-sm text-center text-slate-500">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">
                  {Number(item.unitPrice).toLocaleString('fr-DZ')} DZD
                </td>
                <td className="px-5 py-3 text-sm text-right font-semibold text-slate-900">
                  {Number(item.total).toLocaleString('fr-DZ')} DZD
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-500">
            <span>Sous-total HT</span>
            <span>{Number(invoice.subtotal).toLocaleString('fr-DZ')} DZD</span>
          </div>
          {invoice.hasTva && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>TVA ({invoice.tvaRate}%)</span>
              <span>{Number(invoice.tvaAmount).toLocaleString('fr-DZ')} DZD</span>
            </div>
          )}
          <div className="flex justify-between font-display font-700 text-xl text-slate-900 pt-2 border-t border-slate-200">
            <span>TOTAL TTC</span>
            <span className="text-brand-600">{Number(invoice.total).toLocaleString('fr-DZ')} DZD</span>
          </div>
        </div>
      </div>

      {invoice.notes && (
        <div className="card p-5">
          <h3 className="font-display font-600 text-slate-700 mb-2 text-sm">Notes</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
}
