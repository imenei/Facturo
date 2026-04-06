'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Search, FileText, Package, FileStack, ChevronRight, Loader2, ArrowLeft , Camera , Trash2} from 'lucide-react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

// Resolve logo URL (handles /uploads/... paths and base64)
function resolveLogoUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

// Client avatar: logo image or colored initial
function ClientAvatar({ name, logoUrl, size = 'md' }: { name: string; logoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const resolved = resolveLogoUrl(logoUrl);
  const sizes = { sm: 'w-9 h-9 text-sm', md: 'w-12 h-12 text-base', lg: 'w-16 h-16 text-xl' };

  if (resolved) {
    return (
      <div className={clsx('rounded-xl overflow-hidden shrink-0 bg-white border border-slate-200', sizes[size])}>
        <img
          src={resolved}
          alt={name}
          className="w-full h-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>
    );
  }

  // Colored initial fallback
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700', 'bg-indigo-100 text-indigo-700',
  ];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];

  return (
    <div className={clsx('rounded-xl flex items-center justify-center font-700 shrink-0 uppercase', sizes[size], color)}>
      {name?.charAt(0) || '?'}
    </div>
  );
}

// Logo upload button for a client
function LogoUploader({ clientId, currentLogo, onUpdated }: {
  clientId: string;
  currentLogo?: string | null;
  onUpdated: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.patch(`/clients/${clientId}/logo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onUpdated(data.clientLogoUrl);
      toast.success('Logo mis à jour');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur upload');
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Supprimer le logo de ce client ?')) return;
    setUploading(true);
    try {
      await api.patch(`/clients/${clientId}/logo-remove`);
      onUpdated(null);
      toast.success('Logo supprimé');
    } catch { toast.error('Erreur'); }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
        title="Changer le logo"
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        {currentLogo ? 'Changer' : 'Ajouter logo'}
      </button>
      {currentLogo && (
        <button
          onClick={handleRemove}
          disabled={uploading}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title="Supprimer le logo"
        >
          <Trash2 size={13} />
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function ClientsPage() {
  const { t } = useI18nStore();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [docs, setDocs] = useState<any>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const load = async (q?: string) => {
    try {
      const { data } = await api.get('/clients', { params: q ? { name: q } : {} });
      setClients(data);
    } catch {
      toast.error(t('error_loading_clients'));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectClient = async (client: any) => {
    setSelected(client);
    setLoadingDocs(true);
    try {
      const { data } = await api.get(`/clients/${client.clientId}/documents`);
      setDocs(data);
    } catch {
      toast.error(t('error_loading_documents'));
    }
    setLoadingDocs(false);
  };

  const updateClientLogo = (clientId: string, logoUrl: string | null) => {
    setClients((prev) => prev.map((c) => c.clientId === clientId ? { ...c, clientLogoUrl: logoUrl } : c));
    if (selected?.clientId === clientId) {
      setSelected((p: any) => ({ ...p, clientLogoUrl: logoUrl }));
      setDocs((p: any) => p ? { ...p, clientLogoUrl: logoUrl } : p);
    }
  };

  const paymentBadge = (status: string) =>
    status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600';

  // ── Client detail view ──────────────────────────────────────────────────────
  if (selected && docs) {
    return (
      <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => { setSelected(null); setDocs(null); }} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-display font-700 text-slate-900">{docs.clientName}</h1>
            <p className="text-slate-500 text-sm">{docs.clientPhone} · {docs.clientEmail}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('documents'), value: docs.summary.totalDocuments, color: 'text-slate-900' },
            { label: t('invoices'), value: docs.summary.facturesCount, color: 'text-brand-600' },
            { label: t('paid'), value: `${Number(docs.summary.totalPaid).toLocaleString('fr-DZ')} DZD`, color: 'text-emerald-600' },
            { label: t('unpaid'), value: `${Number(docs.summary.totalUnpaid).toLocaleString('fr-DZ')} DZD`, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4">
              <div className={`text-xl font-display font-700 ${color} truncate`}>{value}</div>
              <div className="text-xs text-slate-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {loadingDocs ? (
          <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-brand-500" /></div>
        ) : (
          <div className="space-y-6">
            {docs.factures.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <FileText size={16} className="text-brand-500" />
                  <span className="font-600 text-slate-900">{t('invoices')} ({docs.factures.length})</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-slate-50">
                    {docs.factures.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm font-medium">{inv.number}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{Number(inv.total).toLocaleString('fr-FR')} DZD</td>
                        <td className="px-4 py-3">
                          <span className={clsx('badge', paymentBadge(inv.paymentStatus))}>
                            {inv.paymentStatus === 'paid' ? t('paid_status') : t('unpaid_status')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">
                            {t('view')} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {docs.proformas.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <FileStack size={16} className="text-purple-500" />
                  <span className="font-600 text-slate-900">{t('proformas')} ({docs.proformas.length})</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-slate-50">
                    {docs.proformas.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm">{inv.number}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('fr-DZ')}</td>
                        <td className="px-4 py-3 text-sm font-medium">{Number(inv.total).toLocaleString('fr-DZ')} DZD</td>
                        <td className="px-4 py-3">
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">
                            {t('view')} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {docs.bonsLivraison.length > 0 && (
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b bg-slate-50 flex items-center gap-2">
                  <Package size={16} className="text-amber-500" />
                  <span className="font-600 text-slate-900">{t('delivery_notes')} ({docs.bonsLivraison.length})</span>
                </div>
                <table className="w-full">
                  <tbody className="divide-y divide-slate-50">
                    {docs.bonsLivraison.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-mono text-sm font-medium">{inv.number}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 text-sm font-medium">{Number(inv.total).toLocaleString('fr-FR')} DZD</td>
                        <td className="px-4 py-3">
                          <span className={clsx('badge', inv.deliveryStatus === 'livree' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                            {inv.deliveryStatus === 'livree' ? t('delivered') : t('not_delivered')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">
                            {t('view')} →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {docs.summary.totalDocuments === 0 && (
              <div className="card p-12 text-center text-slate-400">Aucun document pour ce client</div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Client list ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-700 text-slate-900">{t('clients')}</h1>
        <p className="text-slate-500 text-sm mt-1">{t('clients_description')}</p>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            className="input pl-9" 
            placeholder={t('search_clients_placeholder')} 
            value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} 
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-2">
          {clients.length === 0 && (
            <div className="card p-12 text-center text-slate-400">{t('no_clients_found')}</div>
          )}
          {clients.map((c: any) => (
            <button 
              key={c.clientId || c.clientName} 
              onClick={() => selectClient(c)}
              className="card p-4 w-full text-left hover:shadow-md hover:border-brand-200 transition-all flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-700 text-brand-700 uppercase text-sm">
                  {c.clientName?.charAt(0)}
                </div>
                <div>
                  <div className="font-600 text-slate-900">{c.clientName}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.clientEmail || c.clientPhone || t('no_contact')}</div>
                </div>

                {/* Info */}
                <button
                  onClick={() => selectClient(c)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-600 text-slate-900 truncate">{c.clientName}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {[c.clientEmail, c.clientPhone].filter(Boolean).join(' · ') || 'Pas de contact'}
                  </div>
                </button>

                {/* Stats + arrow */}
                <button onClick={() => selectClient(c)} className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-600 text-slate-900">
                      {Number(c.documentCount)} doc{Number(c.documentCount) > 1 ? 's' : ''}
                    </div>
                    <div className="text-xs text-slate-400">
                      {Number(c.totalAmount || 0).toLocaleString('fr-FR')} DZD
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div>
                  <div className="text-sm font-600 text-slate-900">{Number(c.documentCount)} {t('docs')}</div>
                  <div className="text-xs text-slate-400">{Number(c.totalAmount || 0).toLocaleString('fr-DZ')} DZD</div>
                </div>
                <ChevronRight size={18} className="text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-6">
        Survolez un logo pour le changer · Cliquez sur le nom pour voir les documents
      </p>
    </div>
  );
}