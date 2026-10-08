'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Loader2, RefreshCw, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function InvoiceDeletionRequestsPage() {
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/invoices/deletion-requests');
      setRequests(data);
    } catch {
      toast.error('Impossible de charger les demandes de suppression');
    }
    setLoading(false);
  }, []);

  useEffect(() => { if (user?.role === 'admin') void load(); }, [load, user?.role]);

  const review = async (requestId: string, action: 'approve' | 'reject') => {
    setReviewing(requestId);
    try {
      await api.patch(`/invoices/deletion-requests/${requestId}`, { action });
      toast.success(action === 'approve' ? 'Facture supprimée' : 'Demande rejetée');
      await load();
    } catch {
      toast.error('Impossible de traiter cette demande');
    }
    setReviewing(null);
  };

  const removeRequest = async (requestId: string) => {
    if (!window.confirm('Supprimer cette demande de suppression ? Cette action ne supprime pas la facture concernée.')) return;
    setReviewing(requestId);
    try {
      await api.delete(`/invoices/deletion-requests/${requestId}`);
      toast.success('Demande de suppression supprimée');
      await load();
    } catch {
      toast.error('Impossible de supprimer cette demande');
    }
    setReviewing(null);
  };

  if (user?.role !== 'admin') return <div className="p-8 text-slate-500">Accès réservé aux administrateurs.</div>;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display font-700 text-slate-900">Demandes de suppression</h1>
          <p className="text-sm text-slate-500 mt-1">{requests.length} demande(s)</p>
        </div>
        <button type="button" onClick={() => { setLoading(true); void load(); }} className="btn-secondary" title="Actualiser" aria-label="Actualiser">
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
      ) : requests.length === 0 ? (
        <div className="py-12 text-center text-slate-500">Aucune demande de suppression.</div>
      ) : (
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {requests.map((request) => (
            <article key={request.id} className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr_2fr_auto] gap-4 py-5 items-start">
              <div>
                <p className="font-mono font-semibold text-slate-900">{request.invoiceNumber}</p>
                <p className="text-sm text-slate-500">{request.clientName || 'Client non renseigné'}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Demandée par {request.requestedBy?.name || 'Utilisateur'} · {new Date(request.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${request.status === 'pending' ? 'bg-amber-100 text-amber-800' : request.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
                  {request.status === 'pending' ? 'En attente' : request.status === 'approved' ? 'Approuvée' : 'Rejetée'}
                </span>
                {request.reviewedAt && <p className="text-xs text-slate-400 mt-2">Traitée le {new Date(request.reviewedAt).toLocaleString('fr-FR')}</p>}
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{request.reason}</p>
              {request.status === 'pending' && (
                <div className="flex gap-2 flex-wrap">
                  <button type="button" disabled={reviewing === request.id} onClick={() => void review(request.id, 'approve')}
                    className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700">
                    {reviewing === request.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approuver
                  </button>
                  <button type="button" disabled={reviewing === request.id} onClick={() => void review(request.id, 'reject')} className="btn-secondary text-sm text-red-600">
                    <X size={14} /> Rejeter
                  </button>
                  <button type="button" disabled={reviewing === request.id} onClick={() => void removeRequest(request.id)} className="btn-secondary text-sm text-slate-600">
                    Supprimer la demande
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}