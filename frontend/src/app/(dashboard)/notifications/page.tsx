'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Bell, Mail, MessageCircle, Phone, Send, Loader2, Search, CheckCircle, XCircle } from 'lucide-react';

export default function NotificationsPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, any>>({});
  const [selectedChannels, setSelectedChannels] = useState<Record<string, { email: boolean; whatsapp: boolean; sms: boolean }>>({});

  useEffect(() => {
    api.get('/invoices', { params: { paymentStatus: 'unpaid', type: 'facture' } })
      .then(({ data }) => {
        setInvoices(data.filter((i: any) => i.status !== 'annulee'));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleChannel = (invoiceId: string, ch: 'email' | 'whatsapp' | 'sms') => {
    setSelectedChannels((prev) => ({
      ...prev,
      [invoiceId]: { email: false, whatsapp: false, sms: false, ...prev[invoiceId], [ch]: !prev[invoiceId]?.[ch] },
    }));
  };

  const sendReminder = async (invoice: any) => {
    const channels = selectedChannels[invoice.id] || { email: true, whatsapp: false, sms: false };
    if (!channels.email && !channels.whatsapp && !channels.sms) {
      toast.error('Sélectionnez au moins un canal');
      return;
    }
    setSending(invoice.id);
    try {
      const { data } = await api.post(`/notifications/send-reminder/${invoice.id}`, { channels });
      setResults((prev) => ({ ...prev, [invoice.id]: data }));
      const success = Object.values(data).some((r: any) => r.success);
      if (success) toast.success('Rappel envoyé');
      else toast.error('Tous les envois ont échoué');
    } catch { toast.error('Erreur lors de l\'envoi'); }
    setSending(null);
  };

  const filtered = invoices.filter((inv) =>
    inv.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    inv.number?.toLowerCase().includes(search.toLowerCase())
  );

  const daysOverdue = (dueDate: string) => {
    if (!dueDate) return null;
    const diff = Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000);
    return diff > 0 ? diff : null;
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Bell size={20} className="text-amber-600" /></div>
          <div>
            <h1 className="text-3xl font-display font-700 text-slate-900">Rappels de paiement</h1>
            <p className="text-slate-500 text-sm">{filtered.length} facture{filtered.length > 1 ? 's' : ''} impayée{filtered.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher une facture ou un client…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><Mail size={12} className="text-brand-500" /> Email</div>
        <div className="flex items-center gap-1.5"><MessageCircle size={12} className="text-emerald-500" /> WhatsApp</div>
        <div className="flex items-center gap-1.5"><Phone size={12} className="text-amber-500" /> SMS</div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="card p-12 text-center">
              <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3" />
              <p className="text-slate-500">Aucune facture impayée — tout est à jour !</p>
            </div>
          )}
          {filtered.map((inv) => {
            const overdue = daysOverdue(inv.dueDate);
            const chs = selectedChannels[inv.id] || { email: false, whatsapp: false, sms: false };
            const res = results[inv.id];
            const isSending = sending === inv.id;

            return (
              <div key={inv.id} className={clsx('card p-5', overdue && overdue > 0 && 'border-red-200 bg-red-50/30')}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm font-600 text-slate-900">{inv.number}</span>
                      {overdue && overdue > 0 && (
                        <span className="badge bg-red-100 text-red-700 text-xs">En retard de {overdue}j</span>
                      )}
                    </div>
                    <div className="font-display font-600 text-slate-900">{inv.clientName}</div>
                    <div className="text-sm text-slate-500 mt-0.5 space-x-2">
                      {inv.clientEmail && <span>{inv.clientEmail}</span>}
                      {inv.clientPhone && <span>· {inv.clientPhone}</span>}
                    </div>
                    <div className="text-sm font-700 text-brand-600 mt-1">{Number(inv.total).toLocaleString('fr-DZ')} DZD</div>
                    {inv.dueDate && <div className="text-xs text-slate-400 mt-0.5">Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-DZ')}</div>}
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Channel toggles */}
                    <div className="flex items-center gap-1.5">
                      {[
                        { key: 'email', icon: Mail, color: 'text-brand-500 border-brand-300 bg-brand-50', label: 'Email', disabled: !inv.clientEmail },
                        { key: 'whatsapp', icon: MessageCircle, color: 'text-emerald-600 border-emerald-300 bg-emerald-50', label: 'WA', disabled: !inv.clientPhone },
                        { key: 'sms', icon: Phone, color: 'text-amber-600 border-amber-300 bg-amber-50', label: 'SMS', disabled: !inv.clientPhone },
                      ].map(({ key, icon: Icon, color, label, disabled }) => (
                        <button key={key} disabled={disabled}
                          onClick={() => toggleChannel(inv.id, key as any)}
                          title={disabled ? 'Contact manquant' : label}
                          className={clsx('flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                            disabled ? 'opacity-30 cursor-not-allowed bg-slate-50 border-slate-200 text-slate-400' :
                            chs[key as keyof typeof chs] ? color + ' font-700 ring-1' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          )}>
                          <Icon size={12} />{label}
                        </button>
                      ))}
                    </div>

                    <button onClick={() => sendReminder(inv)} disabled={isSending}
                      className="btn-primary text-sm py-2 px-4">
                      {isSending ? <Loader2 size={14} className="animate-spin" /> : <><Send size={14} /> Envoyer</>}
                    </button>
                  </div>
                </div>

                {/* Results */}
                {res && (
                  <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                    {Object.entries(res).map(([ch, r]: any) => (
                      <div key={ch} className={clsx('flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full',
                        r.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600')}>
                        {r.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                        {ch}: {r.message}
                      </div>
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
