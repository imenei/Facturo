'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Truck, Package, CheckCircle, XCircle, Clock, Loader2, Search } from 'lucide-react';

const deliveryConfig: Record<string, any> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  livree: { label: 'Livrée', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  non_livree: { label: 'Non livrée', color: 'bg-red-100 text-red-600', icon: XCircle },
};

export default function DeliveriesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [updating, setUpdating] = useState<string | null>(null);

  const load = async () => {
    try {
      const { data } = await api.get('/invoices');
      // Only invoices that have a delivery aspect (facture or bon_livraison)
      setInvoices(data.filter((i: any) => i.type !== 'proforma'));
    } catch { toast.error('Erreur chargement'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const updateDelivery = async (id: string, status: string) => {
    setUpdating(id);
    try {
      await api.patch(`/invoices/${id}/delivery-status`, { status });
      setInvoices((prev) => prev.map((inv) => inv.id === id ? { ...inv, deliveryStatus: status } : inv));
      toast.success('Statut mis à jour');
    } catch { toast.error('Erreur'); }
    setUpdating(null);
  };

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.number?.toLowerCase().includes(search.toLowerCase()) || inv.clientName?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = !filter || inv.deliveryStatus === filter;
    return matchSearch && matchFilter;
  });

  const stats = {
    total: invoices.length,
    livree: invoices.filter((i) => i.deliveryStatus === 'livree').length,
    en_attente: invoices.filter((i) => i.deliveryStatus === 'en_attente').length,
    non_livree: invoices.filter((i) => i.deliveryStatus === 'non_livree').length,
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-700 text-slate-900">Suivi des livraisons</h1>
        <p className="text-slate-500 text-sm mt-1">Gérez le statut de livraison de vos documents</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { key: 'total', label: 'Total', color: 'text-slate-900', bg: 'bg-slate-100' },
          { key: 'en_attente', label: 'En attente', color: 'text-amber-700', bg: 'bg-amber-50' },
          { key: 'livree', label: 'Livrées', color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { key: 'non_livree', label: 'Non livrées', color: 'text-red-700', bg: 'bg-red-50' },
        ].map(({ key, label, color, bg }) => (
          <div key={key} className={`card p-4 ${bg}`}>
            <div className={`text-2xl font-display font-700 ${color}`}>{stats[key as keyof typeof stats]}</div>
            <div className="text-xs text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'en_attente', 'livree', 'non_livree'].map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={clsx('px-3 py-2 rounded-lg text-sm font-medium transition-all', filter === s ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              {s === '' ? 'Toutes' : deliveryConfig[s]?.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase">Document</th>
                <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase">Client</th>
                <th className="text-right text-xs font-600 text-slate-500 px-4 py-3 uppercase">Montant</th>
                <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase">Statut</th>
                <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase">Date</th>
                <th className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12 text-slate-400">Aucun document</td></tr>
              )}
              {filtered.map((inv) => {
                const cfg = deliveryConfig[inv.deliveryStatus] || deliveryConfig.en_attente;
                const Icon = cfg.icon;
                return (
                  <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm font-medium text-slate-900">{inv.number}</div>
                      <div className="text-xs text-slate-400 capitalize">{inv.type.replace('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{inv.clientName}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right">{Number(inv.total).toLocaleString('fr-DZ')} DZD</td>
                    <td className="px-4 py-3">
                      <span className={clsx('badge', cfg.color)}><Icon size={11} className="mr-1" />{cfg.label}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('fr-DZ')}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {['en_attente', 'livree', 'non_livree'].filter((s) => s !== inv.deliveryStatus).map((s) => {
                          const c = deliveryConfig[s];
                          return (
                            <button key={s} onClick={() => updateDelivery(inv.id, s)} disabled={updating === inv.id} className={clsx('text-xs px-2 py-1 rounded border transition-all', c.color.replace('bg-', 'border-').replace('100', '200'), 'hover:opacity-80 bg-white')}>
                              {updating === inv.id ? <Loader2 size={10} className="animate-spin" /> : c.label}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
