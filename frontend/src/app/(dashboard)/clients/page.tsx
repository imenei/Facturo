'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Search, FileText, Package, FileStack, ChevronRight,
  Loader2, ArrowLeft, Upload, Trash2, Building2, Camera,
} from 'lucide-react';
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
function LogoUploader({ clientId, currentLogo, onUpdated, t }: {
  clientId: string;
  currentLogo?: string | null;
  onUpdated: (url: string | null) => void;
  t: (key: string) => string;
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
      toast.success(t('logo_updated'));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error_uploading_logo'));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleRemove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t('confirm_remove_logo'))) return;
    setUploading(true);
    try {
      await api.patch(`/clients/${clientId}/logo-remove`);
      onUpdated(null);
      toast.success(t('logo_removed'));
    } catch { toast.error(t('error_removing_logo')); }
    setUploading(false);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
        title={t('change_logo')}
      >
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
        {currentLogo ? t('change') : t('add_logo')}
      </button>
      {currentLogo && (
        <button
          onClick={handleRemove}
          disabled={uploading}
          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          title={t('remove_logo')}
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
    } catch { toast.error(t('error_loading_clients')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectClient = async (client: any) => {
    setSelected(client);
    setLoadingDocs(true);
    try {
      const { data } = await api.get(`/clients/${client.clientId}/documents`);
      setDocs(data);
    } catch { toast.error(t('error_loading_documents')); }
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
        {/* Back + header */}
        <div className="flex items-start gap-4 mb-6">
          <button
            onClick={() => { setSelected(null); setDocs(null); }}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 mt-1 shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-4 flex-1 flex-wrap">
            {/* Client logo — large */}
            <div className="relative group">
              <ClientAvatar name={docs.clientName} logoUrl={docs.clientLogoUrl} size="lg" />
              {/* Upload overlay on hover */}
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Upload size={16} className="text-white" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const form = new FormData();
                    form.append('file', file);
                    try {
                      const { data } = await api.patch(`/clients/${selected.clientId}/logo`, form, {
                        headers: { 'Content-Type': 'multipart/form-data' },
                      });
                      updateClientLogo(selected.clientId, data.clientLogoUrl);
                      toast.success(t('logo_updated'));
                    } catch { toast.error(t('error_uploading_logo')); }
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-display font-700 text-slate-900">{docs.clientName}</h1>
                <LogoUploader
                  clientId={selected.clientId}
                  currentLogo={docs.clientLogoUrl}
                  onUpdated={(url) => updateClientLogo(selected.clientId, url)}
                  t={t}
                />
              </div>
              <p className="text-slate-500 text-sm mt-1">
                {[docs.clientPhone, docs.clientEmail, docs.clientAddress].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: t('documents'), value: docs.summary.totalDocuments, color: 'text-slate-900' },
            { label: t('invoices'), value: docs.summary.facturesCount, color: 'text-brand-600' },
            { label: t('paid'), value: `${Number(docs.summary.totalPaid).toLocaleString('fr-FR')} DZD`, color: 'text-emerald-600' },
            { label: t('unpaid'), value: `${Number(docs.summary.totalUnpaid).toLocaleString('fr-FR')} DZD`, color: 'text-red-600' },
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
          <div className="space-y-5">
            {/* Factures */}
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
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">{t('view')} →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Proformas */}
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
                        <td className="px-5 py-3 font-mono text-sm font-medium">{inv.number}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-3 text-sm font-medium">{Number(inv.total).toLocaleString('fr-FR')} DZD</td>
                        <td className="px-4 py-3">
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">{t('view')} →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bons de livraison */}
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
                          <Link href={`/invoices/${inv.id}`} className="text-brand-600 hover:underline text-xs">{t('view')} →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {docs.summary.totalDocuments === 0 && (
              <div className="card p-12 text-center text-slate-400">{t('no_documents_for_client')}</div>
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
            <div className="card p-12 text-center text-slate-400">
              <Building2 size={36} className="mx-auto mb-3 opacity-30" />
              {t('no_clients_found')}
            </div>
          )}

          {clients.map((c: any) => (
            <div key={c.clientId || c.clientName} className="card hover:shadow-md hover:border-brand-200 transition-all">
              <div className="flex items-center p-4 gap-4">

                {/* Client logo / avatar */}
                <div className="relative group shrink-0">
                  <ClientAvatar name={c.clientName} logoUrl={c.clientLogoUrl} size="md" />
                  {/* Upload overlay */}
                  <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title={t('change_logo')}>
                    <Upload size={12} className="text-white" />
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        e.stopPropagation();
                        const file = e.target.files?.[0];
                        if (!file || !c.clientId) return;
                        const form = new FormData();
                        form.append('file', file);
                        try {
                          const { data } = await api.patch(`/clients/${c.clientId}/logo`, form, {
                            headers: { 'Content-Type': 'multipart/form-data' },
                          });
                          updateClientLogo(c.clientId, data.clientLogoUrl);
                          toast.success(t('logo_updated'));
                        } catch { toast.error(t('error_uploading_logo')); }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>

                {/* Info */}
                <button
                  onClick={() => selectClient(c)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="font-600 text-slate-900 truncate">{c.clientName}</div>
                  <div className="text-xs text-slate-400 mt-0.5 truncate">
                    {[c.clientEmail, c.clientPhone].filter(Boolean).join(' · ') || t('no_contact')}
                  </div>
                </button>

                {/* Stats + arrow */}
                <button onClick={() => selectClient(c)} className="flex items-center gap-4 shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-600 text-slate-900">
                      {Number(c.documentCount)} {Number(c.documentCount) > 1 ? t('docs_plural') : t('docs_singular')}
                    </div>
                    <div className="text-xs text-slate-400">
                      {Number(c.totalAmount || 0).toLocaleString('fr-FR')} DZD
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 text-center mt-6">
        {t('logo_hover_tip')}
      </p>
    </div>
  );
}