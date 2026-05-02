'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Bell, Mail, MessageCircle, Phone, Send, Loader2, Search,
  CheckCircle, XCircle, Settings, Eye, RotateCcw, Save,
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
    }).catch(() => {}); // fallback to defaults
  }, []);

  const insertVar = (v: string) => {
    setBody((prev) => prev + v);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/notifications/email-template', { subject, body });
      toast.success(t('template_saved'));
    } catch { toast.error(t('error_saving')); }
    setSaving(false);
  };

  const handleReset = () => {
    if (!confirm(t('reset_default_template_confirm'))) return;
    setSubject(DEFAULT_TEMPLATE.subject);
    setBody(DEFAULT_TEMPLATE.body);
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
  const [results, setResults] = useState<Record<string, any>>({});
  const [selectedChannels, setSelectedChannels] = useState<Record<string, { email: boolean; whatsapp: boolean; sms: boolean }>>({});
  const [showTemplateEditor, setShowTemplateEditor] = useState(false); // MOD 8b

  useEffect(() => {
    api.get('/invoices', { params: { paymentStatus: 'unpaid', type: 'facture' } })
      .then(({ data }) => { setInvoices(data.filter((i: any) => i.status !== 'annulee')); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const toggleChannel = (invoiceId: string, ch: 'email' | 'whatsapp' | 'sms') => {
    setSelectedChannels((prev) => {
      const current = prev[invoiceId] ?? { email: false, whatsapp: false, sms: false };
      return {
        ...prev,
        [invoiceId]: { ...current, [ch]: !current[ch] },
      };
    });
  };

  const sendReminder = async (invoice: any) => {
    const channels = selectedChannels[invoice.id] || { email: true, whatsapp: false, sms: false };
    if (!channels.email && !channels.whatsapp && !channels.sms) { toast.error(t('select_at_least_one_channel')); return; }
    setSending(invoice.id);
    try {
      const { data } = await api.post(`/notifications/send-reminder/${invoice.id}`, { channels });
      setResults((prev) => ({ ...prev, [invoice.id]: data }));
      const success = Object.values(data).some((r: any) => r.success);
      if (success) toast.success(t('reminder_sent_success'));
      else toast.error(t('all_sends_failed'));
    } catch { toast.error(t('error_sending_reminder')); }
    setSending(null);
  };

  const filtered = invoices.filter((inv) =>
    !search || inv.clientName?.toLowerCase().includes(search.toLowerCase()) || inv.number?.toLowerCase().includes(search.toLowerCase()),
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
        {/* MOD 8b: button to open template editor */}
        <button onClick={() => setShowTemplateEditor(true)} className="btn-secondary flex items-center gap-2">
          <Settings size={16} /> {t('edit_email_template')}
        </button>
      </div>

      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className="input pl-9 max-w-sm" placeholder={t('search_by_client_or_invoice_number')} value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

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
            const ch = selectedChannels[inv.id] || { email: true, whatsapp: false, sms: false };
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
                    {inv.clientPhone && <div className="text-xs text-slate-400 flex items-center gap-1"><Phone size={11} /> {inv.clientPhone}</div>}
                    {/* MOD 3: creator */}
                    {inv.createdBy && (
                      <div className={clsx('text-xs mt-1', inv.createdBy.role === 'admin' ? 'text-blue-500' : 'text-violet-500')}>
                        {inv.createdBy.role === 'admin' ? '🛡 Admin' : `💼 ${inv.createdBy.name}`}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-display font-700 text-red-600">{Number(inv.total).toLocaleString('fr-DZ')} DZD</div>
                    {inv.dueDate && <div className="text-xs text-slate-400 mt-1">Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}</div>}
                  </div>
                </div>

                {/* Channel selection */}
                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-100">
                  {[
                    { key: 'email' as const, label: 'Email', icon: Mail, disabled: !inv.clientEmail },
                    { key: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle, disabled: !inv.clientPhone },
                    { key: 'sms' as const, label: 'SMS', icon: Phone, disabled: !inv.clientPhone },
                  ].map(({ key, label, icon: Icon, disabled }) => (
                    <button key={key} onClick={() => !disabled && toggleChannel(inv.id, key)} disabled={disabled}
                      className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border',
                        disabled ? 'opacity-30 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200' :
                        ch[key] ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300')}>
                      <Icon size={13} /> {label}
                    </button>
                  ))}

                  <button onClick={() => sendReminder(inv)} disabled={sending === inv.id}
                    className="ml-auto btn-primary text-sm py-1.5">
                    {sending === inv.id ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> {t('send')}</>}
                  </button>
                </div>

                {/* Send results */}
                {res && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(res).map(([ch, r]: [string, any]) => (
                      <span key={ch} className={clsx('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                        r.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                        {r.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {ch}: {r.message}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
