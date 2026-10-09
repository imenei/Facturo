'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import ConfirmDialog from '@/components/ConfirmDialog';
import { formatMoneyDzd } from '@/lib/formatMoney';
import clsx from 'clsx';
import {
  Bell, Mail, Send, Loader2, Search,
  CheckCircle, XCircle, Settings, RotateCcw, Save, ChevronDown, History,
} from 'lucide-react';

// MOD 8b: default email template
const DEFAULT_TEMPLATE = {
  subject: 'Rappel de paiement — Facture {{invoiceNumber}}',
  body: `Bonjour {{clientName}},

Nous vous rappelons que la facture <strong>{{invoiceNumber}}</strong> d'un montant de <strong>{{amount}}</strong> est en attente de règlement.

<table style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #1a54ff;width:100%">
  <tr><td style="color:#6b7280">N° Facture</td><td><strong>{{invoiceNumber}}</strong></td></tr>
  <tr><td style="color:#6b7280">Montant</td><td><strong style="color:#1a54ff">{{amount}}</strong></td></tr>
  <tr><td style="color:#6b7280">Date d'échéance</td><td><strong>{{dueDate}}</strong></td></tr>
</table>

Merci de bien vouloir procéder au règlement dans les meilleurs délais.

Cordialement,
<strong>{{companyName}}</strong>`,
};

const VARIABLES = [
  { key: '{{clientName}}', desc: 'Nom du client' },
  { key: '{{invoiceNumber}}', desc: 'N° de facture' },
  { key: '{{amount}}', desc: 'Montant total' },
  { key: '{{dueDate}}', desc: "Date d'échéance" },
  { key: '{{companyName}}', desc: "Nom de l'entreprise" },
];

const historyRowsForInvoice = (history: Record<string, any[]>, invoiceId: string) => history[invoiceId] || [];

// MOD 8b: Email Template Editor
function EmailTemplateEditor({ onClose }: { onClose: () => void }) {
  const { t } = useI18nStore();
  const [subject, setSubject] = useState(DEFAULT_TEMPLATE.subject);
  const [body, setBody] = useState(DEFAULT_TEMPLATE.body);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load saved template if exists
    api.get('/notifications/email-template').then(({ data }) => {
      if (data?.subject) setSubject(data.subject);
      if (data?.body) setBody(data.body);
    }).catch(() => toast.error('Impossible de charger le modèle. Vérifie que la migration des notifications a été appliquée.'));
  }, []);

  const insertVar = (v: string) => {
    setBody((prev) => prev + v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/notifications/email-template', { subject, body });
      toast.success(t('template_saved'));
    } catch { toast.error('Impossible d’enregistrer le modèle. Vérifie la migration de la base de production.'); }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!confirm(t('reset_default_template_confirm'))) return;
    setSaving(true);
    try {
      await api.delete('/notifications/email-template');
      setSubject(DEFAULT_TEMPLATE.subject);
      setBody(DEFAULT_TEMPLATE.body);
      toast.success(t('template_saved'));
    } catch { toast.error('Impossible de réinitialiser le modèle. Vérifie la migration de la base de production.'); }
    setSaving(false);
  };

  // Build preview HTML with sample data
  const previewHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="font-family:Arial,sans-serif;background:#f5f5f5;margin:0;padding:20px">
  <div style="max-width:600px;margin:0 auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
    <div style="background:#1a54ff;padding:30px;text-align:center">
      <h1 style="color:white;margin:0;font-size:22px">Mon Entreprise</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0">Rappel de paiement</p>
    </div>
    <div style="padding:30px;white-space:pre-line">
      ${body
        .replace(/{{clientName}}/g, 'Ahmed Benali')
        .replace(/{{invoiceNumber}}/g, 'FAC-2025-0042')
        .replace(/{{amount}}/g, '150 000 DZD')
        .replace(/{{dueDate}}/g, '31/01/2025')
        .replace(/{{companyName}}/g, 'Mon Entreprise')}
    </div>
  </div>
  </body></html>`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-display font-700 text-slate-900 flex items-center gap-2">
            <Settings size={18} className="text-brand-500" /> Modèle d'email de rappel
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-slate-100">
          {(['edit', 'preview'] as const).map((tabKey) => (
            <button key={tabKey} onClick={() => setTab(tabKey)}
              className={clsx('px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === tabKey ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700')}>
              {tabKey === 'edit' ? `✏️ ${t('edit')}` : `👁 ${t('preview')}`}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'edit' ? (
            <div className="space-y-4">
              <div>
                <label className="label">Objet de l'email</label>
                <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet..." />
              </div>
              <div className="flex gap-3 items-start">
                <div className="flex-1">
                  <label className="label">Corps de l'email <span className="text-slate-400 text-xs">(HTML supporté)</span></label>
                  <textarea className="input font-mono text-xs" rows={14} value={body}
                    onChange={(e) => setBody(e.target.value)} />
                </div>
                <div className="w-44 shrink-0">
                  <label className="label">Variables disponibles</label>
                  <div className="space-y-1">
                    {VARIABLES.map((v) => (
                      <button key={v.key} onClick={() => insertVar(v.key)}
                        className="w-full text-left px-2 py-1.5 rounded-lg bg-slate-50 hover:bg-brand-50 hover:text-brand-700 text-xs font-mono transition-colors border border-slate-200">
                        {v.key}
                        <span className="block text-slate-400 font-sans text-xs">{v.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 bg-slate-50 p-3 rounded-lg">
                💡 Cliquez sur une variable pour l'insérer à la fin du corps. Vous pouvez la déplacer manuellement dans le texte.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                Prévisualisation avec des données fictives. Les vraies données seront utilisées lors de l'envoi.
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs text-slate-600">
                  <strong>Objet :</strong> {subject.replace(/{{invoiceNumber}}/g, 'FAC-2025-0042').replace(/{{clientName}}/g, 'Ahmed Benali')}
                </div>
                <iframe srcDoc={previewHtml} className="w-full h-80 border-0" title="preview" />
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={handleReset} className="btn-secondary flex items-center gap-2">
            <RotateCcw size={14} /> Réinitialiser
          </button>
          <div className="flex-1" />
          <button onClick={onClose} className="btn-secondary">Fermer</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <><Save size={15} /> Enregistrer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const { t } = useI18nStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<any>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [reminderHistory, setReminderHistory] = useState<Record<string, any[]>>({});
  const [historyError, setHistoryError] = useState(false);
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null);
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [showTemplateEditor, setShowTemplateEditor] = useState(false); // MOD 8b

  useEffect(() => {
    api.get('/invoices', { params: { paymentStatus: 'unpaid', type: 'facture' } })
      .then(({ data }) => { setInvoices(data.filter((i: any) => i.status !== 'annulee')); setLoading(false); })
      .catch(() => setLoading(false));
    api.get('/notifications/reminder-history').then(({ data }) => {
      const grouped = (data as any[]).reduce((result, row) => {
        (result[row.invoiceId] ||= []).push(row);
        return result;
      }, {} as Record<string, any[]>);
      setReminderHistory(grouped);
    }).catch(() => setHistoryError(true));
  }, []);

  const sendReminder = async (invoice: any) => {
    if (!recipientEmail.trim()) { toast.error('Saisissez l’adresse e-mail du destinataire.'); return; }
    setReminderTarget(null);
    setSending(invoice.id);
    try {
      const { data } = await api.post(`/notifications/send-reminder/${invoice.id}`, { recipientEmail });
      setResults((prev) => ({ ...prev, [invoice.id]: data }));
      if (data.email?.success) toast.success(t('reminder_sent_success'));
      else toast.error(data.email?.message || t('all_sends_failed'));
      const historyResponse = await api.get('/notifications/reminder-history').catch(() => {
        setHistoryError(true);
        return null;
      });
      if (historyResponse) {
        const groupedHistory = (historyResponse.data as any[]).reduce((result, row) => {
          (result[row.invoiceId] ||= []).push(row);
          return result;
        }, {} as Record<string, any[]>);
        setReminderHistory(groupedHistory);
        setHistoryError(false);
      }
    } catch (error: any) { toast.error(error?.response?.data?.message || t('error_sending_reminder')); }
    setSending(null);
  };

  const filtered = invoices.filter((inv) =>
    !search || inv.clientName?.toLowerCase().includes(search.toLowerCase()) || inv.number?.toLowerCase().includes(search.toLowerCase()),
  );
  const fullHistory = Object.values(reminderHistory).flat().filter((row: any) =>
    !search || row.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) || row.recipientEmail?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      {/* MOD 8b: email template editor modal */}
      {showTemplateEditor && <EmailTemplateEditor onClose={() => setShowTemplateEditor(false)} />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('notifications')}</h1>
          <p className="text-slate-500 text-sm mt-1">{filtered.length} {t('unpaid_invoices_count')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowFullHistory((open) => !open)} className="btn-secondary flex items-center gap-2">
            <History size={16} /> Historique des rappels
          </button>
          <button onClick={() => setShowTemplateEditor(true)} className="btn-secondary flex items-center gap-2">
            <Settings size={16} /> {t('edit_email_template')}
          </button>
        </div>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9 max-w-sm" placeholder={t('search_by_client_or_invoice_number')} value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      {historyError && (
        <div className="mb-5 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Historique et modèle indisponibles : applique la migration `backend/scripts/migration-add-columns.sql` sur la base de production, puis redémarre le backend.
        </div>
      )}

      {showFullHistory && (
        <section className="mb-6 border-y border-slate-200">
          <h2 className="py-3 text-sm font-semibold text-slate-700">Historique conservé pendant un an</h2>
          {fullHistory.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">Aucun rappel enregistré.</p>
          ) : fullHistory.map((row: any) => (
            <div key={row.id} className="flex flex-wrap justify-between gap-2 border-t border-slate-100 py-3 text-sm">
              <div>
                <strong className="font-mono text-slate-800">{row.invoiceNumber}</strong>
                <span className="ml-3 text-slate-500">{row.recipientEmail}</span>
                <span className={clsx('ml-3', row.success ? 'text-emerald-700' : 'text-red-600')}>{row.success ? 'Envoyé' : 'Échec'}</span>
              </div>
              <time className="text-xs text-slate-500">{new Date(row.createdAt).toLocaleString('fr-FR')}</time>
            </div>
          ))}
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell size={36} className="mx-auto mb-3 opacity-30 text-slate-400" />
          <p className="text-slate-400">{search ? t('no_results') : t('no_unpaid_invoices')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inv) => {
            const res = results[inv.id];
            const daysSince = Math.floor((Date.now() - new Date(inv.createdAt).getTime()) / 86400000);
            return (
              <div key={inv.id} className={clsx('card p-5', daysSince > 30 && 'border-l-4 border-red-400')}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-sm font-semibold text-slate-900">{inv.number}</span>
                      {daysSince > 30 && (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-600 rounded-full font-medium">{daysSince}j de retard</span>
                      )}
                    </div>
                    <div className="text-slate-700 font-medium mt-0.5">{inv.clientName}</div>
                    {inv.clientEmail && <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Mail size={11} /> {inv.clientEmail}</div>}
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                      <span>{(historyRowsForInvoice(reminderHistory, inv.id).filter((row: any) => row.success)).length} rappel(s) envoyé(s)</span>
                      {historyRowsForInvoice(reminderHistory, inv.id).length > 0 && (
                        <button type="button" onClick={() => setHistoryOpenId(historyOpenId === inv.id ? null : inv.id)} className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700">
                          Historique <ChevronDown size={13} className={clsx(historyOpenId === inv.id && 'rotate-180')} />
                        </button>
                      )}
                    </div>
                    {/* MOD 3: creator */}
                    {inv.createdBy && (
                      <div className={clsx('text-xs mt-1', inv.createdBy.role === 'admin' ? 'text-blue-500' : 'text-violet-500')}>
                        {inv.createdBy.role === 'admin' ? '🛡 Admin' : inv.createdBy.role === 'commercial' ? `💼 ${inv.createdBy.name} · Commercial` : inv.createdBy.name}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-display font-700 text-red-600">{formatMoneyDzd(inv.total)}</div>
                    {inv.dueDate && <div className="text-xs text-slate-400 mt-1">Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}</div>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-100">
                  {!inv.clientEmail && (
                    <span className="text-xs text-slate-400">{t('no_contact_for_reminder')}</span>
                  )}
                  <button
                    onClick={() => { setRecipientEmail(inv.clientEmail || ''); setReminderTarget(inv); }}
                    disabled={sending === inv.id}
                    className="ml-auto btn-primary text-sm py-1.5"
                  >
                    {sending === inv.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <><Mail size={14} /> {t('send_email_reminder')}</>}
                  </button>
                </div>

                {res?.email && (
                  <div className="mt-2">
                    <span className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                      res.email.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                      {res.email.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                      {res.email.message}
                    </span>
                  </div>
                )}
                {historyOpenId === inv.id && (
                  <div className="mt-3 border-t border-slate-100 pt-3 space-y-2">
                    {historyRowsForInvoice(reminderHistory, inv.id).map((row: any) => (
                      <div key={row.id} className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                        <span className={row.success ? 'text-emerald-700' : 'text-red-600'}>{row.success ? 'Envoyé' : 'Échec'} · {row.recipientEmail}</span>
                        <span>{new Date(row.createdAt).toLocaleString('fr-FR')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(reminderTarget)}
        title="Confirmer l'envoi du rappel"
        confirmLabel="Envoyer"
        loading={Boolean(sending)}
        onCancel={() => setReminderTarget(null)}
        onConfirm={() => reminderTarget && void sendReminder(reminderTarget)}
      >
        <label className="label" htmlFor="reminderRecipient">Adresse e-mail du destinataire</label>
        <input id="reminderRecipient" className="input" type="email" required value={recipientEmail}
          onChange={(e) => setRecipientEmail(e.target.value)} />
        <p>Un email de rappel sera envoyé au client {reminderTarget?.clientName}.</p>
      </ConfirmDialog>
    </div>
  );
}
