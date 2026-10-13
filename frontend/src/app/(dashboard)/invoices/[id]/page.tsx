'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import { generateInvoicePDF } from '@/lib/pdfGenerator';
import { useAuthStore } from '@/store/authStore';
import { isManager } from '@/lib/roles';
import { useI18nStore } from '@/store/i18nStore';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, FileDown, FileText, Edit, CheckCircle,
  XCircle, Loader2, Bell, ChevronRight, Mail,
  AlertTriangle, Eye, Trash2,
  ShieldCheck, Briefcase, Lock, TrendingUp, Settings, History, Save,
  Clock, Timer, RotateCcw, Truck, Link2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DELIVERY_UPDATED_EVENT } from '@/hooks/useRealtimeDelivery';
import Link from 'next/link';
import { adjustedUnitPrice, computeNetProfit, formatMoney, formatMoneyDzd, lineGrossMargin, resolveInvoiceAdjustment, roundMoney } from '@/lib/formatMoney';

const generateInvoiceWord = async (invoice: any, company: any) => {
  const { generateInvoiceWord: fn } = await import('@/lib/wordGenerator');
  return fn(invoice, company);
};

const STATUS_COLORS: Record<string, string> = {
  brouillon: 'bg-slate-100 text-slate-600',
  emise: 'bg-blue-100 text-blue-700',
  payee: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-red-100 text-red-700',
};
const DELIVERY_COLORS: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  en_cours: 'bg-blue-100 text-blue-700',
  livree: 'bg-emerald-100 text-emerald-700',
  non_livree: 'bg-red-100 text-red-600',
};
const DELIVERY_LABELS: Record<string, string> = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  livree: 'Livrée',
  non_livree: 'Non livrée',
};
const WORKFLOW_STEPS = ['commande', 'livraison', 'facturation', 'recouvrement'];
const WORKFLOW_LABELS: Record<string, string> = {
  commande: 'commande_step',
  livraison: 'livraison_step',
  facturation: 'facturation_step',
  recouvrement: 'recouvrement_step',
};

function WorkflowStepper({ current, invoiceId, onUpdate, canEdit, t }: any) {
  const [updating, setUpdating] = useState(false);
  const currentIdx = WORKFLOW_STEPS.indexOf(current);

  const advance = async (step: string) => {
    if (!canEdit) return;
    setUpdating(true);
    try {
      await api.patch(`/invoices/${invoiceId}/workflow`, { step });
      onUpdate();
      toast.success(t('workflow_updated'));
    } catch { toast.error(t('error_updating_workflow')); }
    setUpdating(false);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {WORKFLOW_STEPS.map((step, i) => {
        const done = i <= currentIdx;
        const isNext = i === currentIdx + 1;
        return (
          <div key={step} className="flex items-center">
            <button onClick={() => advance(step)} disabled={!canEdit || updating || i > currentIdx + 1}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                done ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500',
                isNext && canEdit && 'ring-2 ring-brand-300 ring-offset-1 cursor-pointer hover:bg-brand-50',
                !canEdit || i > currentIdx + 1 ? 'cursor-default' : 'cursor-pointer',
              )}>
              {done ? <CheckCircle size={11} /> : <div className="w-2 h-2 rounded-full bg-current opacity-40" />}
              {t(WORKFLOW_LABELS[step])}
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

// Workflow du bon de livraison — même présentation que celui des factures.
// Il ne concerne QUE la livraison : le paiement de la facture liée reste indépendant.
function DeliveryWorkflow({ invoice, canEdit, busy, onChange }: {
  invoice: any; canEdit: boolean; busy: boolean; onChange: (status: string) => void;
}) {
  const { t } = useI18nStore();
  const current: string = invoice.deliveryStatus || 'en_attente';
  const finished = current === 'livree' || current === 'non_livree';
  const task = invoice.deliveryTask;
  const steps = [
    { key: 'en_attente', label: DELIVERY_LABELS.en_attente, Icon: Clock },
    { key: 'en_cours', label: DELIVERY_LABELS.en_cours, Icon: Timer },
    finished && current === 'non_livree'
      ? { key: 'non_livree', label: DELIVERY_LABELS.non_livree, Icon: XCircle }
      : { key: 'livree', label: DELIVERY_LABELS.livree, Icon: CheckCircle },
  ];
  const currentIdx = finished ? 2 : current === 'en_cours' ? 1 : 0;

  return (
    <div>
      <div className="flex items-center gap-1 flex-wrap">
        {steps.map((step, i) => {
          const done = i <= currentIdx;
          const isNext = i === currentIdx + 1;
          const failed = step.key === 'non_livree';
          return (
            <div key={step.key} className="flex items-center">
              <button
                type="button"
                onClick={() => onChange(step.key)}
                disabled={!canEdit || busy || i > currentIdx + 1 || i === currentIdx}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  done ? (failed ? 'bg-red-600 text-white' : 'bg-brand-600 text-white') : 'bg-slate-100 text-slate-500',
                  isNext && canEdit && 'ring-2 ring-brand-300 ring-offset-1 cursor-pointer hover:bg-brand-50',
                  !canEdit || i > currentIdx + 1 || i === currentIdx ? 'cursor-default' : 'cursor-pointer',
                )}>
                {done ? <step.Icon size={11} /> : <div className="w-2 h-2 rounded-full bg-current opacity-40" />}
                {t(step.label)}
              </button>
              {i < steps.length - 1 && (
                <ChevronRight size={14} className={clsx('mx-0.5', done && i < currentIdx ? 'text-brand-400' : 'text-slate-300')} />
              )}
            </div>
          );
        })}
      </div>

      {canEdit && current === 'en_cours' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onChange('non_livree')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50">
            <XCircle size={12} /> {t('Marquer non livrée')}
          </button>
        </div>
      )}
      {canEdit && finished && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => onChange('en_cours')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <RotateCcw size={12} /> {t('Rouvrir la livraison')}
          </button>
          <button type="button" disabled={busy} onClick={() => onChange('en_attente')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {t('Remettre en attente')}
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        {invoice.deliveryPersonName && <span className="flex items-center gap-1"><Truck size={11} /> {t('Livreur')} : <strong className="text-slate-700">{invoice.deliveryPersonName}</strong></span>}
        <span>{t('Prix de livraison')} : <strong className="text-slate-700">{formatMoneyDzd(invoice.deliveryPrice || 0)}</strong></span>
        {task?.startedDeliveryAt && <span>{t('Démarrée le')} {new Date(task.startedDeliveryAt).toLocaleString('fr-FR')}</span>}
        {task?.finishedDeliveryAt && <span>{t('Terminée le')} {new Date(task.finishedDeliveryAt).toLocaleString('fr-FR')}{task.deliveryDurationMinutes != null ? ` (${task.deliveryDurationMinutes} min)` : ''}</span>}
      </div>
    </div>
  );
}

function ReminderPanel({ invoice, t }: { invoice: any; t: (key: string) => string }) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState(invoice.clientEmail || '');
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [headerName, setHeaderName] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/notifications/reminder-history');
      setHistory(data.filter((entry: any) => entry.invoiceId === invoice.id));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible de charger l’historique des rappels.');
    }
    setHistoryLoading(false);
  };

  const editTemplate = async () => {
    setTemplateLoading(true);
    try {
      const { data } = await api.get('/notifications/email-template');
      setSubject(data.subject || '');
      setBody(data.body || '');
      setHeaderName(data.headerName || 'HelpDZ');
      setTemplateOpen(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible de charger le modèle de rappel.');
    }
    setTemplateLoading(false);
  };

  const saveTemplate = async () => {
    if (!subject.trim() || !body.trim() || !headerName.trim()) {
      toast.error(t('L’en-tête, l’objet et le contenu du rappel sont obligatoires.'));
      return;
    }
    setTemplateSaving(true);
    try {
      await api.put('/notifications/email-template', { subject, body, headerName });
      setTemplateOpen(false);
      toast.success(t('Modèle de rappel enregistré.'));
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Impossible d’enregistrer le modèle de rappel.');
    }
    setTemplateSaving(false);
  };

  const send = async () => {
    if (!recipientEmail.trim()) { toast.error(t('no_contact_for_reminder')); return; }
    setConfirmOpen(false);
    setSending(true);
    try {
      const { data } = await api.post(`/notifications/send-reminder/${invoice.id}`, { recipientEmail });
      setResult(data.email);
      if (data.email?.success) toast.success(data.email.message);
      else toast.error(data.email?.message || t('reminder_failed'));
      await loadHistory();
    } catch (error: any) { toast.error(error?.response?.data?.message || t('error_sending_reminder')); }
    setSending(false);
  };

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-amber-500" />
          <h3 className="font-display font-600 text-slate-900">{t('payment_reminder')}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => {
            const opening = !historyOpen;
            setHistoryOpen(opening);
            if (opening) void loadHistory();
          }} className="btn-secondary flex items-center gap-2 text-sm">
            <History size={14} /> {historyOpen ? 'Masquer l’historique' : 'Historique'}
          </button>
          <button type="button" onClick={() => void editTemplate()} disabled={templateLoading}
            className="btn-secondary flex items-center gap-2 text-sm">
            {templateLoading ? <Loader2 size={14} className="animate-spin" /> : <Settings size={14} />}
            {t('Modifier le contenu')}
          </button>
        </div>
      </div>
      {templateOpen && (
        <div className="mb-4 space-y-3 border-y border-slate-200 py-4">
          <div>
            <label className="label" htmlFor="reminderTemplateHeader">{t('Nom affiché dans l’en-tête')}</label>
            <input id="reminderTemplateHeader" className="input" value={headerName}
              onChange={(event) => setHeaderName(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reminderTemplateSubject">{t('Objet de l’email')}</label>
            <input id="reminderTemplateSubject" className="input" value={subject}
              onChange={(event) => setSubject(event.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reminderTemplateBody">{t('Contenu de l’email')}</label>
            <textarea id="reminderTemplateBody" className="input min-h-52 font-mono text-sm" rows={8}
              value={body} onChange={(event) => setBody(event.target.value)} />
            <p className="mt-1 text-xs text-slate-500">
              Variables disponibles : {'{{clientName}}'}, {'{{invoiceNumber}}'}, {'{{amount}}'}, {'{{dueDate}}'}, {'{{companyName}}'}.
              {t('Le HTML est accepté.')}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTemplateOpen(false)} className="btn-secondary">{t('Annuler')}</button>
            <button type="button" onClick={() => void saveTemplate()} disabled={templateSaving}
              className="btn-primary flex items-center gap-2">
              {templateSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {t('Enregistrer')}
            </button>
          </div>
        </div>
      )}
      <label className="label" htmlFor="invoiceReminderRecipient">{t('Adresse e-mail du destinataire')}</label>
      <input id="invoiceReminderRecipient" className="input mb-3" type="email" value={recipientEmail}
        onChange={(event) => setRecipientEmail(event.target.value)} />
      <button
        onClick={() => setConfirmOpen(true)}
        disabled={!recipientEmail.trim() || sending}
        className={clsx(
          'w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 text-sm font-medium transition-all',
          !recipientEmail.trim() || sending ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed' :
          result?.success ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
          result && !result.success ? 'border-red-300 bg-red-50 text-red-600' :
          'border-slate-200 hover:border-brand-300 hover:bg-brand-50 text-slate-600',
        )}
      >
        {sending ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
        {t('send_email_reminder')}
      </button>
      {!recipientEmail.trim() && (
        <p className="text-xs text-amber-600 mt-3 flex items-center gap-1">
          <AlertTriangle size={12} /> {t('add_contact_for_reminders')}
        </p>
      )}
      {historyOpen && (
        <div className="mt-4 border-t border-slate-200 pt-3">
          <h4 className="mb-2 text-sm font-semibold text-slate-700">{t('Historique des rappels')}</h4>
          {historyLoading ? <Loader2 size={18} className="animate-spin text-slate-400" /> : history.length === 0 ? (
            <p className="text-sm text-slate-500">{t('Aucun rappel enregistré pour cette facture.')}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {history.map((entry) => (
                <div key={entry.id} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
                  <div>
                    <span className={entry.success ? 'text-emerald-700' : 'text-red-600'}>
                      {entry.success ? 'Envoyé' : 'Échec'}
                    </span>
                    <span className="ml-2 text-slate-600">{entry.recipientEmail}</span>
                    {entry.message && <p className="mt-0.5 text-xs text-slate-500">{entry.message}</p>}
                  </div>
                  <time className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString('fr-FR')}</time>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={confirmOpen}
        title={t("Confirmer l'envoi du rappel")}
        confirmLabel="Envoyer"
        loading={sending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={send}
      >
        <p>{t('Êtes-vous sûr de vouloir envoyer un rappel à cette adresse email ?')}</p>
        <p><strong>{recipientEmail || 'Aucune adresse email'}</strong></p>
        <p>{t('Un email de rappel de paiement sera envoyé à ce destinataire.')}</p>
      </ConfirmDialog>
    </div>
  );
}

function InternalMarginSection({ invoice, t }: { invoice: any; t: (k: string) => string }) {
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const charges = Array.isArray(invoice.otherCharges) ? invoice.otherCharges : [];
  const adjustmentType = invoice.adjustmentType || 'discount';
  const adjustmentAmount = Number(invoice.adjustmentAmount ?? invoice.discountAmount ?? 0);
  const hasData = items.some((item: any) => item.purchasePrice !== undefined && item.purchasePrice !== null);
  if (!hasData && Number(invoice.totalMargin) === 0 && !Number(invoice.otherCharge) && !charges.length && !Number(invoice.deliveryPrice) && !invoice.deliveryPersonName && !adjustmentAmount) return null;

  const totalRevenue = Number(invoice.total) || 0;
  const grossMargin = roundMoney(items.reduce((sum: number, item: any) => {
    if (item.purchasePrice == null) return sum;
    return sum + lineGrossMargin(Number(item.unitPrice), Number(item.purchasePrice), Number(item.quantity));
  }, 0) || Number(invoice.totalMargin) || 0);
  const adjustmentImpact = adjustmentType === 'addition' ? adjustmentAmount : -adjustmentAmount;
  const billedCharges = charges.reduce((sum: number, charge: any) => sum + Number(charge.amount || 0), 0);
  const netProfit = computeNetProfit(grossMargin + adjustmentImpact + billedCharges, Number(invoice.otherCharge) || 0, Number(invoice.deliveryPrice) || 0);
  const marginRate = totalRevenue > 0 ? ((grossMargin / totalRevenue) * 100).toFixed(1) : '0';

  return (
    <div className="card overflow-hidden mb-6 border-2 border-dashed border-slate-300">
      <div className="px-5 py-3 bg-slate-100 border-b border-slate-200 flex items-center gap-2 flex-wrap">
        <Lock size={14} className="text-slate-500" />
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
          {t('Données internes — non incluses dans le PDF client')}
        </span>
        <TrendingUp size={14} className="text-emerald-500 ml-auto" />
        <span className="text-xs font-bold text-emerald-700">Bénéfice net : {formatMoneyDzd(netProfit)}</span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 bg-white border-b border-slate-100 text-sm text-slate-600">
        <span>Marge brute : <strong>{formatMoneyDzd(grossMargin)}</strong></span>
        {adjustmentAmount > 0 && <span>{adjustmentType === 'addition' ? 'Ajout' : 'Remise'} ({Number(invoice.adjustmentPercent ?? invoice.discountPercent ?? 0)}%) : <strong>{adjustmentType === 'addition' ? '+' : '-'}{formatMoneyDzd(adjustmentAmount)}</strong></span>}
        <span>Autre charge : <strong>{formatMoneyDzd(invoice.otherCharge || 0)}</strong></span>
        <span>{t('Prix de livraison')} : <strong>{formatMoneyDzd(invoice.deliveryPrice || 0)}</strong></span>
        {invoice.deliveryPersonName && <span>{t('Livreur')} : <strong>{invoice.deliveryPersonName}</strong></span>}
        <span className="text-xs text-slate-400">Marge brute / chiffre d'affaires : {marginRate}%</span>
      </div>
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50">
            <th className="text-left text-xs font-600 text-slate-500 px-5 py-2.5 uppercase">{t('Produit')}</th>
            <th className="text-right text-xs font-600 text-slate-500 px-4 py-2.5 uppercase">{t('Prix achat')}</th>
            <th className="text-right text-xs font-600 text-slate-500 px-4 py-2.5 uppercase">{t('Prix vente')}</th>
            <th className="text-right text-xs font-600 text-slate-500 px-4 py-2.5 uppercase">{t('Qté')}</th>
            <th className="text-right text-xs font-600 text-slate-500 px-5 py-2.5 uppercase">Marge totale</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {items.map((item: any, i: number) => {
            const purchase = Number(item.purchasePrice || 0);
            const sale = Number(item.unitPrice);
            const qty = Number(item.quantity);
            const margin = lineGrossMargin(sale, purchase, qty);
            const marginPct = sale > 0 ? (((sale - purchase) / sale) * 100).toFixed(0) : '0';
            return (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-5 py-2.5 text-sm text-slate-700">{item.description}</td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-500 font-mono">
                  {purchase > 0 ? formatMoneyDzd(purchase) : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-700 font-mono">{formatMoneyDzd(sale)}</td>
                <td className="px-4 py-2.5 text-sm text-right text-slate-500">{qty}</td>
                <td className="px-5 py-2.5 text-sm text-right font-semibold">
                  {purchase > 0 ? (
                    <span className={clsx(margin >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                      {formatMoneyDzd(margin)}
                      <span className="text-xs font-normal text-slate-400 ml-1">({marginPct}%)</span>
                    </span>
                  ) : <span className="text-slate-300">—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-emerald-50/50 border-t-2 border-slate-200">
            <td colSpan={4} className="px-5 py-3 text-sm font-600 text-slate-700">Marge brute totale</td>
            <td className="px-5 py-3 text-right">
              <span className={clsx('text-base font-display font-700', grossMargin >= 0 ? 'text-emerald-600' : 'text-red-500')}>
                {formatMoneyDzd(grossMargin)}
              </span>
            </td>
          </tr>
        </tfoot>
      </table>
      {charges.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-3 space-y-1">
          <p className="text-xs font-semibold uppercase text-slate-500">{t('Frais facturés')}</p>
          {charges.map((charge: any, index: number) => (
            <div key={`${charge.description}-${index}`} className="flex justify-between gap-3 text-sm text-slate-600">
              <span>{charge.description || 'Frais'}</span><strong>{formatMoneyDzd(charge.amount)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18nStore();
  const [invoice, setInvoice] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatingPayment, setUpdatingPayment] = useState(false);
  const [updatingDelivery, setUpdatingDelivery] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleting, setDeleting] = useState(false);
  const { user } = useAuthStore();

  const load = async (silent = false) => {
    try {
      const [inv, comp] = await Promise.all([api.get(`/invoices/${id}`), api.get('/company')]);
      setInvoice(inv.data);
      setCompany(comp.data);
    } catch { if (!silent) toast.error(t('error_loading_invoice')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Synchronisation avec l'interface livreur : dès que le statut de livraison change
  // (livreur, administrateur ou commercial), la page se met à jour sans rechargement.
  useEffect(() => {
    const onDeliveryUpdated = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      const ids: string[] = [detail.invoiceId, ...(detail.linkedInvoiceIds || [])].filter(Boolean);
      if (ids.length === 0 || ids.includes(String(id))) void load(true);
    };
    window.addEventListener(DELIVERY_UPDATED_EVENT, onDeliveryUpdated);
    return () => window.removeEventListener(DELIVERY_UPDATED_EVENT, onDeliveryUpdated);
  }, [id]);

  const togglePayment = async () => {
    const next = invoice.paymentStatus === 'paid' ? 'unpaid' : 'paid';
    setUpdatingPayment(true);
    try {
      await api.patch(`/invoices/${id}/payment-status`, { paymentStatus: next });
      setInvoice((p: any) => ({ ...p, paymentStatus: next }));
      toast.success(next === 'paid' ? t('invoice_marked_paid') : t('invoice_marked_unpaid'));
    } catch { toast.error(t('error_updating_payment')); }
    setUpdatingPayment(false);
  };

  const updateStatus = async (status: string) => {
    try {
      await api.put(`/invoices/${id}`, { status });
      setInvoice((p: any) => ({ ...p, status }));
      toast.success(t('status_updated'));
    } catch { toast.error(t('error_updating_status')); }
  };

  const updateDelivery = async (status: string) => {
    setUpdatingDelivery(true);
    try {
      await api.patch(`/invoices/${id}/delivery-status`, { status });
      // Rechargement : le statut est partagé avec la facture / le bon liés et la tâche du livreur.
      await load(true);
      toast.success(t('delivery_updated'));
    } catch (e: any) { toast.error(e?.response?.data?.message || t('error_updating_delivery')); }
    setUpdatingDelivery(false);
  };

  const handleTemplateChange = async (templateType: string) => {
    try {
      await api.put(`/invoices/${id}`, { templateType });
      setInvoice((p: any) => ({ ...p, templateType }));
      toast.success(t('template_saved'));
    } catch {
      toast.error(t('error_updating'));
    }
  };

  const handleDelete = async () => {
    if (user?.role === 'commercial' && !deleteReason.trim()) {
      toast.error(t('Le motif de suppression est obligatoire'));
      return;
    }
    setDeleting(true);
    try {
      if (user?.role === 'commercial') {
        await api.post(`/invoices/${id}/deletion-requests`, { reason: deleteReason.trim() });
        setInvoice((prev: any) => ({ ...prev, deletionRequestPending: true }));
        toast.success(t('Demande de suppression envoyée à l’administrateur'));
      } else {
        await api.delete(`/invoices/${id}`);
        toast.success(t('deleted'));
        router.push('/invoices');
      }
      setShowDeleteDialog(false);
      setDeleteReason('');
    } catch {
      toast.error(user?.role === 'commercial' ? 'Impossible d’envoyer la demande de suppression' : t('error_deleting'));
    }
    setDeleting(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;
  if (!invoice) return <div className="p-8 text-slate-500">{t('invoice_not_found')}</div>;

  const canManage = isManager(user?.role);
  const isUnpaid = invoice.type === 'facture' && invoice.paymentStatus !== 'paid';
  const { type: adjustmentType, percent: adjustmentPercent } = resolveInvoiceAdjustment(invoice);
  const invoiceCharges = Array.isArray(invoice.otherCharges) ? invoice.otherCharges : [];
  const adjustedSubtotal = roundMoney((invoice.items || []).reduce((sum: number, item: any) => sum + roundMoney(adjustedUnitPrice(Number(item.unitPrice), adjustmentType, adjustmentPercent) * Number(item.quantity || 0)), 0));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Link href="/invoices" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-display font-700 text-slate-900">{invoice.number}</h1>
              {invoice.type !== 'bon_livraison' && (
                <span className={clsx('badge', STATUS_COLORS[invoice.status])}>{t(invoice.status)}</span>
              )}
              {invoice.type === 'bon_livraison' && (
                <span className="badge bg-amber-100 text-amber-700">{t('Bon de livraison')}</span>
              )}
              {invoice.type !== 'proforma' && (
                <span className={clsx('badge', DELIVERY_COLORS[invoice.deliveryStatus])}>
                  {DELIVERY_LABELS[invoice.deliveryStatus] ? t(DELIVERY_LABELS[invoice.deliveryStatus]) : t(invoice.deliveryStatus?.replace('_', ' '))}
                </span>
              )}
              {invoice.type === 'facture' && (
                <button onClick={togglePayment} disabled={updatingPayment}
                  className={clsx(
                    'badge cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1',
                    invoice.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600',
                  )}>
                  {updatingPayment ? <Loader2 size={10} className="animate-spin" /> :
                    invoice.paymentStatus === 'paid' ? <CheckCircle size={11} /> : <XCircle size={11} />}
                  {invoice.paymentStatus === 'paid' ? t('paid_status') : t('unpaid_status')}
                </button>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-1">
              {invoice.clientName} · {new Date(invoice.createdAt).toLocaleDateString('fr-DZ')}
              {invoice.dueDate && ` · ${t('due_date')}: ${new Date(invoice.dueDate).toLocaleDateString('fr-DZ')}`}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {invoice.createdBy && (
                <span className={clsx(
                  'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium',
                  invoice.createdBy.role === 'admin' ? 'bg-blue-50 text-blue-600' : 'bg-violet-50 text-violet-600',
                )}>
                  {invoice.createdBy.role === 'admin' ? <ShieldCheck size={10} /> : <Briefcase size={10} />}
                  Créé par {invoice.createdBy.name}
                  <span className="text-slate-300"> · </span>
                  {invoice.createdBy.role === 'commercial' ? 'Commercial' : invoice.createdBy.role === 'admin' ? 'Administrateur' : invoice.createdBy.role}
                  · {new Date(invoice.createdAt).toLocaleDateString('fr-FR')} à {new Date(invoice.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {invoice.lastModifiedBy && invoice.lastModifiedBy.id !== invoice.createdBy?.id && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
                  Modifié par {invoice.lastModifiedBy.name}
                  {invoice.lastModifiedBy.role === 'commercial' && (
                    <span className="text-amber-500">· Commercial</span>
                  )}
                  · {new Date(invoice.updatedAt).toLocaleDateString('fr-FR')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowPreview(true)} className="btn-primary text-sm">
            <Eye size={15} /> {t('preview_pdf')}
          </button>
          {invoice.type === 'facture' && !invoice.deliveryNote && (
            <Link href={`/invoices/new?type=bon_livraison&sourceInvoiceId=${invoice.id}`} className="btn-secondary text-sm">
              <FileText size={15} /> {t('Créer un bon de livraison')}
            </Link>
          )}
          {invoice.type === 'facture' && invoice.deliveryNote && (
            <Link href={`/invoices/${invoice.deliveryNote.id}`} className="btn-secondary text-sm">
              <Truck size={15} /> Bon de livraison {invoice.deliveryNote.number}
            </Link>
          )}
          <button onClick={() => generateInvoiceWord(invoice, company)} className="btn-secondary text-sm">
            <FileText size={15} /> Word
          </button>
          <Link href={`/invoices/${id}/edit`} className="btn-secondary text-sm">
            <Edit size={15} /> {t('edit')}
          </Link>
          {canManage && (
            <button onClick={() => setShowDeleteDialog(true)} disabled={invoice.deletionRequestPending}
              className="btn-secondary text-sm text-red-600 hover:bg-red-50 hover:border-red-200 disabled:opacity-50">
              <Trash2 size={15} /> {invoice.deletionRequestPending ? 'Demande en attente' : user?.role === 'commercial' ? 'Demander la suppression' : t('delete')}
            </button>
          )}
        </div>
      </div>

      {invoice.type === 'bon_livraison' && (
        <div className="card p-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-sm font-600 text-slate-500">{t('Progression de la livraison')}</h3>
            {invoice.sourceInvoice && (
              <Link href={`/invoices/${invoice.sourceInvoice.id}`} className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline">
                <Link2 size={12} /> {t('Facture liée')} : <strong>{invoice.sourceInvoice.number}</strong>
                <span className={clsx('badge ml-1', invoice.sourceInvoice.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                  {invoice.sourceInvoice.paymentStatus === 'paid' ? t('paid_status') : t('unpaid_status')}
                </span>
              </Link>
            )}
          </div>
          <DeliveryWorkflow invoice={invoice} canEdit={canManage} busy={updatingDelivery} onChange={updateDelivery} />
          <p className="mt-3 text-xs text-slate-400">
            {t('Le statut de livraison est synchronisé avec l’interface du livreur et la facture liée. Il n’a aucun effet sur le paiement de la facture.')}
          </p>
        </div>
      )}

      {invoice.type === 'facture' && invoice.deliveryNote && (
        <div className="card p-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Truck size={16} className="text-brand-500" />
            <span>{t('Bon de livraison lié')} :</span>
            <Link href={`/invoices/${invoice.deliveryNote.id}`} className="font-mono font-semibold text-brand-600 hover:underline">{invoice.deliveryNote.number}</Link>
            <span className={clsx('badge', DELIVERY_COLORS[invoice.deliveryNote.deliveryStatus])}>{DELIVERY_LABELS[invoice.deliveryNote.deliveryStatus] ? t(DELIVERY_LABELS[invoice.deliveryNote.deliveryStatus]) : invoice.deliveryNote.deliveryStatus}</span>
          </div>
          <div className="text-xs text-slate-500">
            {invoice.deliveryNote.deliveryPersonName && <>{t('Livreur')} : <strong className="text-slate-700">{invoice.deliveryNote.deliveryPersonName}</strong> · </>}
            Prix de livraison : <strong className="text-slate-700">{formatMoneyDzd(invoice.deliveryNote.deliveryPrice || 0)}</strong>
          </div>
        </div>
      )}

      {invoice.type === 'facture' && invoice.workflowStep && (
        <div className="card p-5 mb-6">
          <h3 className="text-sm font-600 text-slate-500 mb-3">{t('workflow_progress')}</h3>
          <WorkflowStepper current={invoice.workflowStep} invoiceId={invoice.id} onUpdate={load} canEdit={canManage} t={t} />
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-5 mb-6">
        <div className="card p-5">
          <h3 className="font-display font-600 text-slate-900 mb-3">{t('client_information')}</h3>
          <div className="space-y-1.5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900 text-base">{invoice.clientName}</p>
            {invoice.clientAddress && <p className="text-slate-500">{invoice.clientAddress}</p>}
            {invoice.clientPhone && <p>📞 {invoice.clientPhone}</p>}
            {invoice.clientEmail && <p>📧 {invoice.clientEmail}</p>}
            {invoice.clientNif && <p className="font-mono text-xs">NIF: {invoice.clientNif}</p>}
            {invoice.clientNis && <p className="font-mono text-xs">NIS: {invoice.clientNis}</p>}
          </div>
          {invoice.clientId && (
            <Link href="/clients" className="mt-3 text-xs text-brand-600 hover:underline flex items-center gap-1">
              {t('view_all_client_docs')} <ChevronRight size={12} />
            </Link>
          )}
        </div>
        {canManage ? (
          <div className="card p-5 space-y-4">
            {invoice.type !== 'bon_livraison' && (
            <div>
              <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">{t('document_status')}</p>
              <div className="flex flex-wrap gap-1.5">
                {['brouillon', 'emise', 'payee', 'annulee'].map((s) => (
                  <button key={s} onClick={() => updateStatus(s)}
                    className={clsx(
                      'text-xs px-3 py-1.5 rounded-lg border transition-all capitalize',
                      invoice.status === s ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50',
                    )}>{t(s)}</button>
                ))}
              </div>
            </div>
            )}
            {invoice.type === 'facture' && (
              <div>
                <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">{t('delivery_status')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {['en_attente', 'en_cours', 'livree', 'non_livree'].map((s) => (
                    <button key={s} onClick={() => updateDelivery(s)} disabled={updatingDelivery}
                      className={clsx(
                        'text-xs px-3 py-1.5 rounded-lg border transition-all disabled:opacity-50',
                        invoice.deliveryStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'border-slate-200 text-slate-600 hover:border-brand-300 hover:bg-brand-50',
                      )}>{t(DELIVERY_LABELS[s])}</button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-400">{t('Indépendant du paiement')}{invoice.deliveryNote ? ` · ${t('partagé avec le bon de livraison lié')}` : ''}.</p>
              </div>
            )}
            {invoice.type === 'bon_livraison' && (
              <div className="text-sm text-slate-600 space-y-1">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{t('Livraison')}</p>
                <p>{t('Livreur')} : <strong>{invoice.deliveryPersonName || '—'}</strong></p>
                <p>{t('Prix de livraison')} : <strong>{formatMoneyDzd(invoice.deliveryPrice || 0)}</strong></p>
                {invoice.deliveryDate && <p>{t('Date prévue')} : <strong>{new Date(invoice.deliveryDate).toLocaleDateString('fr-FR')}</strong></p>}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {canManage && isUnpaid && <div className="mb-6"><ReminderPanel invoice={invoice} t={t} /></div>}

      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-display font-600 text-slate-900">{t('items')}</h3>
          <span className="text-sm text-slate-400">{invoice.items?.length} {t('items_count')}</span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50">
              <th className="text-left text-xs font-600 text-slate-500 px-5 py-3 uppercase">{t('description')}</th>
              <th className="text-center text-xs font-600 text-slate-500 px-4 py-3 uppercase">{t('quantity')}</th>
              <th className="text-right text-xs font-600 text-slate-500 px-4 py-3 uppercase">{t('unit_price')}</th>
              <th className="text-right text-xs font-600 text-slate-500 px-5 py-3 uppercase">{t('total_excl_tax')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoice.items?.map((item: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/50">
                <td className="px-5 py-3 text-sm text-slate-700">
                  {item.description}
                </td>
                <td className="px-4 py-3 text-sm text-center text-slate-500">{item.quantity}</td>
                <td className="px-4 py-3 text-sm text-right text-slate-600">{formatMoneyDzd(adjustedUnitPrice(Number(item.unitPrice), adjustmentType, adjustmentPercent))}</td>
                <td className="px-5 py-3 text-sm text-right font-semibold text-slate-900">{formatMoneyDzd(roundMoney(adjustedUnitPrice(Number(item.unitPrice), adjustmentType, adjustmentPercent) * Number(item.quantity || 0)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/50 space-y-1.5">
          <div className="flex justify-between text-sm text-slate-500">
            <span>{t('subtotal_excl_tax')}</span>
            <span>{formatMoneyDzd(adjustedSubtotal)}</span>
          </div>
          {canManage && invoiceCharges.map((charge: any, index: number) => (
            <div key={`${charge.description}-${index}`} className="flex justify-between text-sm text-slate-600">
              <span>Frais : {charge.description || 'Autre frais'}</span>
              <span>+{formatMoneyDzd(charge.amount)}</span>
            </div>
          ))}
          {invoice.hasTva && (
            <div className="flex justify-between text-sm text-slate-500">
              <span>TVA ({invoice.tvaRate}%)</span>
              <span>{formatMoneyDzd(invoice.tvaAmount)}</span>
            </div>
          )}
          <div className="flex justify-between font-display font-700 text-xl text-slate-900 pt-2 border-t border-slate-200">
            <span>{t('total_incl_tax')}</span>
            <span className="text-brand-600">{formatMoneyDzd(invoice.total)}</span>
          </div>
          {invoice.type !== 'bon_livraison' && adjustmentType === 'discount' && adjustmentPercent > 0 && (
            <p className="pt-2 text-right text-xs text-slate-500">
              Remise appliquée : {adjustmentPercent}% (incluse dans les prix unitaires)
            </p>
          )}
        </div>
      </div>

      {canManage && invoice.type === 'facture' && (
        <InternalMarginSection invoice={invoice} t={t} />
      )}

      {invoice.notes && (
        <div className="card p-5">
          <h3 className="font-display font-600 text-slate-700 mb-2 text-sm">{t('notes')}</h3>
          <p className="text-sm text-slate-600 whitespace-pre-line">{invoice.notes}</p>
        </div>
      )}

      {showPreview && (
        <PDFPreviewModal
          invoice={invoice}
          company={company}
          onClose={() => setShowPreview(false)}
          onDownload={generateInvoicePDF}
          onTemplateChange={handleTemplateChange}
        />
      )}
      <ConfirmDialog
        open={showDeleteDialog}
        title={user?.role === 'commercial' ? 'Demande de suppression' : 'Supprimer la facture'}
        confirmLabel={user?.role === 'commercial' ? 'Envoyer la demande' : 'Supprimer'}
        danger={user?.role !== 'commercial'}
        loading={deleting}
        onCancel={() => { setShowDeleteDialog(false); setDeleteReason(''); }}
        onConfirm={handleDelete}
      >
        {user?.role === 'commercial' ? (
          <>
            <p>{t('La facture ne sera supprimée qu’après validation par un administrateur.')}</p>
            <label className="block text-sm font-medium text-slate-700" htmlFor="deleteReason">{t('Motif de la suppression')} *</label>
            <textarea id="deleteReason" className="input min-h-24 resize-y" required value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)} placeholder={t('Expliquez pourquoi cette facture doit être supprimée.')} />
          </>
        ) : <p>{t('confirm_delete_invoice')}</p>}
      </ConfirmDialog>
    </div>
  );
}
