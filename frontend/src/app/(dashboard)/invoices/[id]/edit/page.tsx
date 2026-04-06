'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';
import Link from 'next/link';

interface Item { description: string; quantity: number; unitPrice: number; }

export default function EditInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18nStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    api.get(`/invoices/${id}`).then(({ data }) => {
      setForm({
        type: data.type, clientName: data.clientName, clientEmail: data.clientEmail || '',
        clientPhone: data.clientPhone || '', clientAddress: data.clientAddress || '',
        clientNif: data.clientNif || '', clientNis: data.clientNis || '',
        hasTva: data.hasTva, tvaRate: data.tvaRate, notes: data.notes || '',
        status: data.status,
      });
      setItems(data.items.map((i: any) => ({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice })));
      setLoading(false);
    }).catch(() => { toast.error(t('error_loading_invoice')); router.push('/invoices'); });
  }, [id, router, t]);

  const updateItem = (i: number, field: keyof Item, val: any) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addItem = () => setItems((p) => [...p, { description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tvaAmount = form.hasTva ? (subtotal * form.tvaRate) / 100 : 0;
  const total = subtotal + tvaAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put(`/invoices/${id}`, { ...form, items });
      toast.success(t('document_updated'));
      router.push(`/invoices/${id}`);
    } catch (err: any) { toast.error(err?.response?.data?.message || t('error_updating_document')); }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/invoices/${id}`} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500"><ArrowLeft size={20} /></Link>
        <h1 className="text-3xl font-display font-700 text-slate-900">{t('edit_document')}</h1>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('status')}</h2>
          <div className="flex gap-2 flex-wrap">
            {['brouillon', 'emise', 'payee', 'annulee'].map((s) => (
              <label key={s} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all capitalize text-sm ${form.status === s ? 'border-brand-500 bg-brand-50 font-medium' : 'border-slate-200 hover:border-slate-300'}`}>
                <input type="radio" name="status" value={s} checked={form.status === s} onChange={(e) => setForm({ ...form, status: e.target.value })} className="hidden" />
                {t(s)}
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('client')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">{t('name')} *</label>
              <input className="input" required value={form.clientName||''} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" value={form.clientEmail||''} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('phone')}</label>
              <input className="input" value={form.clientPhone||''} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('address')}</label>
              <input className="input" value={form.clientAddress||''} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} />
            </div>
            <div>
              <label className="label">NIF</label>
              <input className="input" value={form.clientNif||''} onChange={(e) => setForm({ ...form, clientNif: e.target.value })} />
            </div>
            <div>
              <label className="label">NIS</label>
              <input className="input" value={form.clientNis||''} onChange={(e) => setForm({ ...form, clientNis: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hasTva} onChange={(e) => setForm({ ...form, hasTva: e.target.checked })} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm font-medium">TVA</span>
            </label>
            {form.hasTva && <input type="number" className="input w-20" value={form.tvaRate} onChange={(e) => setForm({ ...form, tvaRate: Number(e.target.value) })} />}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-600 text-slate-900">{t('items')}</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-sm py-1.5"><Plus size={15} /> {t('add_item')}</button>
          </div>
          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2">
                <div className="col-span-12 md:col-span-6">
                  <input className="input bg-white" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} required placeholder={t('description')} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input className="input bg-white text-center" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                </div>
                <div className="col-span-7 md:col-span-3">
                  <input className="input bg-white text-right" type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4 space-y-1.5 text-right">
            <div className="text-sm text-slate-600">{t('excl_tax')}: <span className="font-medium">{subtotal.toLocaleString('fr-DZ')} DZD</span></div>
            {form.hasTva && <div className="text-sm text-slate-600">TVA: <span className="font-medium">{tvaAmount.toLocaleString('fr-DZ')} DZD</span></div>}
            <div className="text-lg font-display font-700 text-brand-600">{t('total')}: {total.toLocaleString('fr-DZ')} DZD</div>
          </div>
        </div>

        <div className="card p-5">
          <label className="label">{t('notes')}</label>
          <textarea className="input resize-none" rows={2} value={form.notes||''} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder={t('notes_placeholder')} />
        </div>

        <div className="flex gap-3 justify-end">
          <Link href={`/invoices/${id}`} className="btn-secondary">{t('cancel')}</Link>
          <button type="submit" disabled={saving} className="btn-primary px-6">
            {saving ? <><Loader2 size={16} className="animate-spin" /> {t('saving')}</> : <><Save size={16} /> {t('save_changes')}</>}
          </button>
        </div>
      </form>
    </div>
  );
}