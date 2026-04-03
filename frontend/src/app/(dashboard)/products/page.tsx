'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Edit2, Trash2, Loader2, X, Save, TrendingUp, Search } from 'lucide-react';

const emptyForm = { name: '', description: '', reference: '', unit: '', purchasePrice: 0, salePrice: 0 };

export default function ProductsPage() {
  const { t } = useI18nStore();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [priceError, setPriceError] = useState('');

  const load = async (q?: string) => {
    try {
      const { data } = await api.get('/products', { params: q ? { search: q } : {} });
      setProducts(data);
    } catch {
      toast.error(t('error_loading_products'));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditProduct(null); setForm({ ...emptyForm }); setPriceError(''); setShowForm(true); };
  const openEdit = (p: any) => {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description || '', reference: p.reference || '', unit: p.unit || '', purchasePrice: Number(p.purchasePrice), salePrice: Number(p.salePrice) });
    setPriceError('');
    setShowForm(true);
  };

  const validatePrices = () => {
    if (form.salePrice <= form.purchasePrice) {
      setPriceError(t('sale_price_error'));
      return false;
    }
    setPriceError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePrices()) return;
    setSaving(true);
    try {
      if (editProduct) await api.put(`/products/${editProduct.id}`, form);
      else await api.post('/products', form);
      toast.success(editProduct ? t('product_updated') : t('product_created'));
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error_saving_product'));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('archive_product')} "${name}" ?`)) return;
    try { await api.delete(`/products/${id}`); toast.success(t('product_archived')); load(); }
    catch { toast.error(t('error_deleting_product')); }
  };

  const margin = (p: any) => {
    const m = Number(p.salePrice) - Number(p.purchasePrice);
    const pct = Number(p.purchasePrice) > 0 ? ((m / Number(p.purchasePrice)) * 100).toFixed(0) : 0;
    return { m, pct };
  };

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('products')}</h1>
          <p className="text-slate-500 text-sm mt-1">{products.length} {t('products_count')}</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> {t('new_product')}</button>
      </div>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={t('search_products')} value={search}
            onChange={(e) => { setSearch(e.target.value); load(e.target.value); }} />
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-display font-700 text-slate-900">{editProduct ? t('edit') : t('new')} {t('product')}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">{t('name')} *</label>
                  <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('product_name_placeholder')} />
                </div>
                <div>
                  <label className="label">{t('reference')}</label>
                  <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="REF-001" />
                </div>
                <div>
                  <label className="label">{t('unit')}</label>
                  <input className="input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder={t('unit_placeholder')} />
                </div>
                <div>
                  <label className="label">{t('purchase_price')} (DZD) *</label>
                  <input className="input" type="number" min={0} step="0.01" required value={form.purchasePrice}
                    onChange={(e) => { setForm({ ...form, purchasePrice: Number(e.target.value) }); setPriceError(''); }} />
                </div>
                <div>
                  <label className="label">{t('sale_price')} (DZD) *</label>
                  <input className={clsx('input', priceError && 'border-red-400 ring-red-200')} type="number" min={0} step="0.01" required value={form.salePrice}
                    onChange={(e) => { setForm({ ...form, salePrice: Number(e.target.value) }); setPriceError(''); }} />
                </div>
                {priceError && (
                  <div className="col-span-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{priceError}</div>
                )}
                {form.salePrice > form.purchasePrice && form.purchasePrice > 0 && (
                  <div className="col-span-2 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2 text-sm text-emerald-700">
                    <TrendingUp size={14} />
                    {t('margin')} : {(Number(form.salePrice) - Number(form.purchasePrice)).toLocaleString('fr-DZ')} DZD
                    ({(((form.salePrice - form.purchasePrice) / form.purchasePrice) * 100).toFixed(1)}%)
                  </div>
                )}
                <div className="col-span-2">
                  <label className="label">{t('description')}</label>
                  <textarea className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">{t('cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {editProduct ? t('save') : t('create')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {[t('product'), t('reference'), t('unit'), t('purchase_price'), t('sale_price'), t('margin'), t('actions')].map((h) => (
                  <th key={h} className="text-left text-xs font-600 text-slate-500 px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {products.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-slate-400">{t('no_products')}</td></tr>
              )}
              {products.map((p) => {
                const { m, pct } = margin(p);
                return (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 text-sm">{p.name}</div>
                      {p.description && <div className="text-xs text-slate-400 truncate max-w-40">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.reference || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{p.unit || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{Number(p.purchasePrice).toLocaleString('fr-DZ')} DZD</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{Number(p.salePrice).toLocaleString('fr-DZ')} DZD</td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-emerald-600 font-medium">{m.toLocaleString('fr-DZ')} DZD</div>
                      <div className="text-xs text-slate-400">{pct}%</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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
