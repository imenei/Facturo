'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import { formatMoneyDzd } from '@/lib/formatMoney';

export default function TrashPage() {
  const { user } = useAuthStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/invoices/trash');
      setInvoices(data);
    } catch {
      toast.error('Impossible de charger la corbeille');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (user?.role === 'admin') void load();
  }, [load, user?.role]);

  const restoreInvoice = async (id: string) => {
    setRestoringId(id);
    try {
      await api.patch(`/invoices/${id}/restore`);
      toast.success('Facture restaurée');
      setInvoices((current) => current.filter((invoice) => invoice.id !== id));
    } catch {
      toast.error('Impossible de restaurer cette facture');
    }
    setRestoringId(null);
  };

  if (user?.role !== 'admin') {
    return <div className="p-8 text-slate-500">Accès réservé aux administrateurs.</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/invoices" className="inline-flex items-center gap-1 hover:text-brand-600">
              <ArrowLeft size={14} /> Retour aux factures
            </Link>
          </div>
          <h1 className="text-2xl font-display font-700 text-slate-900 mt-2">Corbeille</h1>
          <p className="text-sm text-slate-500 mt-1">{invoices.length} document(s) supprimé(s)</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="btn-secondary" title="Actualiser" aria-label="Actualiser">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
      ) : invoices.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">
          <Trash2 size={36} className="mx-auto mb-3 opacity-30" />
          <p>Aucune facture dans la corbeille.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">N°</th>
                  <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">Client</th>
                  <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">Type</th>
                  <th className="text-right text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">Montant</th>
                  <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">Supprimé le</th>
                  <th className="text-right text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-900">{invoice.number}</td>
                    <td className="px-4 py-3 text-sm text-slate-700">{invoice.clientName}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-slate-100 text-slate-700 uppercase text-[10px]">
                        {invoice.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      {formatMoneyDzd(invoice.total)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {invoice.deletedAt ? new Date(invoice.deletedAt).toLocaleString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void restoreInvoice(invoice.id)}
                        disabled={restoringId === invoice.id}
                        className="btn-secondary text-sm inline-flex items-center gap-2"
                      >
                        {restoringId === invoice.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                        Restaurer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
