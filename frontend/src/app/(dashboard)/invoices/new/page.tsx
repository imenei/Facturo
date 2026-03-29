'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, Save, ArrowLeft, LayoutTemplate, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

interface Item { description: string; quantity: number; unitPrice: number; }

const TYPE_OPTIONS = [
  { value: 'facture', label: '📄 Facture' },
  { value: 'proforma', label: '📋 Proforma' },
  { value: 'bon_livraison', label: '📦 Bon de livraison' },
];

const TEMPLATE_LABELS: Record<string, string> = {
  classic: '📄 Classic', compact: '📋 Compact', detailed: '📑 Détaillé',
  corporate: '🏢 Corporate', table_focus: '📊 Tableau Focus',
};

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState<number | null>(null);

  const [form, setForm] = useState({
    type: params.get('type') || 'facture',
    clientName: '', clientEmail: '', clientPhone: '',
    clientAddress: '', clientNif: '', clientNis: '',
    hasTva: false, tvaRate: 19,
    notes: '', dueDate: '',
    deliveryDate: '',     // mod #7 — optionnelle
    templateType: '',     // mod #12
  });

  const [items, setItems] = useState<Item[]>([{ description: '', quantity: 1, unitPrice: 0 }]);

  useEffect(() => {
    // Load templates and products
    Promise.all([
      api.get('/templates').catch(() => ({ data: [] })),
      api.get('/products').catch(() => ({ data: [] })),
    ]).then(([tmpl, prod]) => {
      setTemplates(tmpl.data);
      setProducts(prod.data);
      // Set default template
      const def = tmpl.data.find((t: any) => t.isDefault);
      if (def) setForm((p) => ({ ...p, templateType: def.type }));
    });
  }, []);

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const tvaAmount = form.hasTva ? (subtotal * form.tvaRate) / 100 : 0;
  const total = subtotal + tvaAmount;

  const updateItem = (i: number, field: keyof Item, val: any) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const addItem = () => setItems((p) => [...p, { description: '', quantity: 1, unitPrice: 0 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const pickProduct = (itemIdx: number, product: any) => {
    updateItem(itemIdx, 'description', product.name);
    updateItem(itemIdx, 'unitPrice', Number(product.salePrice));
    setShowProductPicker(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.some((i) => !i.description)) { toast.error('Remplissez toutes les désignations'); return; }
    setSaving(true);
    try {
      const payload: any = { ...form, items };
      if (!payload.deliveryDate) delete payload.deliveryDate;  // mod #7 — nullable
      if (!payload.dueDate) delete payload.dueDate;
      await api.post('/invoices', payload);
      toast.success('Document créé avec succès !');
      router.push('/invoices');
    } catch (err: any) {
      if (err.message === 'OFFLINE_QUEUED') toast('Document mis en file hors-ligne', { icon: '📶' });
      else toast.error(err?.response?.data?.message || 'Erreur');
    }
    setSaving(false);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/invoices" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">Nouveau document</h1>
          <p className="text-slate-500 text-sm mt-0.5">Remplissez les informations ci-dessous</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Type + TVA + Template (mod #12) */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Type de document</h2>
          <div className="grid grid-cols-3 gap-3 mb-5">
            {TYPE_OPTIONS.map((opt) => (
              <label key={opt.value} className={clsx(
                'flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium',
                form.type === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:border-slate-300'
              )}>
                <input type="radio" name="type" value={opt.value} checked={form.type === opt.value}
                  onChange={(e) => setForm({ ...form, type: e.target.value })} className="hidden" />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Template selection (mod #12) */}
          {templates.length > 0 && (
            <div className="mb-4">
              <label className="label flex items-center gap-1.5"><LayoutTemplate size={14} /> Template de mise en page</label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button key={t.id} type="button"
                    onClick={() => setForm({ ...form, templateType: t.type })}
                    className={clsx(
                      'text-sm px-3 py-1.5 rounded-lg border transition-all',
                      form.templateType === t.type ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    )}>
                    {TEMPLATE_LABELS[t.type] || t.name}
                    {t.isDefault && <span className="ml-1 text-xs text-slate-400">(défaut)</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TVA */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hasTva}
                onChange={(e) => setForm({ ...form, hasTva: e.target.checked })}
                className="w-4 h-4 accent-brand-600" />
              <span className="text-sm font-medium text-slate-700">Appliquer la TVA</span>
            </label>
            {form.hasTva && (
              <div className="flex items-center gap-2">
                <input type="number" className="input w-20" value={form.tvaRate}
                  onChange={(e) => setForm({ ...form, tvaRate: Number(e.target.value) })} min={0} max={100} />
                <span className="text-sm text-slate-500">%</span>
              </div>
            )}
          </div>
        </div>

        {/* Client */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Informations client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nom / Raison sociale <span className="text-red-500">*</span></label>
              <input className="input" required value={form.clientName}
                onChange={(e) => setForm({ ...form, clientName: e.target.value })} placeholder="Nom du client" />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder="client@exemple.com" />
            </div>
            <div>
              <label className="label">Téléphone</label>
              <input className="input" value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder="+213 5XX XXX XXX" />
            </div>
            <div className="md:col-span-2">
              <label className="label">Adresse</label>
              <input className="input" value={form.clientAddress}
                onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} placeholder="Adresse complète" />
            </div>
            <div>
              <label className="label">NIF</label>
              <input className="input" value={form.clientNif}
                onChange={(e) => setForm({ ...form, clientNif: e.target.value })} />
            </div>
            <div>
              <label className="label">NIS</label>
              <input className="input" value={form.clientNis}
                onChange={(e) => setForm({ ...form, clientNis: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-600 text-slate-900">Articles / Prestations</h2>
            <button type="button" onClick={addItem} className="btn-secondary text-sm py-1.5">
              <Plus size={15} /> Ajouter une ligne
            </button>
          </div>

          {/* Header */}
          <div className="hidden md:grid grid-cols-12 gap-2 text-xs font-600 text-slate-400 uppercase tracking-wide px-1 mb-1">
            <div className="col-span-6">Désignation</div>
            <div className="col-span-2 text-center">Qté</div>
            <div className="col-span-3 text-right">Prix Unitaire</div>
            <div className="col-span-1"></div>
          </div>

          <div className="space-y-2">
            {items.map((item, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-50 rounded-lg p-2 group">
                <div className="col-span-12 md:col-span-6 relative">
                  <input className="input bg-white pr-8" placeholder="Description de l'article ou prestation"
                    value={item.description}
                    onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                  {/* Product picker button (mod #1) */}
                  {products.length > 0 && (
                    <button type="button"
                      onClick={() => setShowProductPicker(showProductPicker === i ? null : i)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-brand-500 rounded"
                      title="Choisir un produit">
                      <ShoppingBag size={14} />
                    </button>
                  )}
                  {/* Product picker dropdown */}
                  {showProductPicker === i && (
                    <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {products.map((p) => (
                        <button key={p.id} type="button" onClick={() => pickProduct(i, p)}
                          className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm flex items-center justify-between">
                          <div>
                            <div className="font-medium text-slate-900">{p.name}</div>
                            {p.reference && <div className="text-xs text-slate-400">{p.reference}</div>}
                          </div>
                          <div className="text-brand-600 font-medium text-xs shrink-0 ml-3">
                            {Number(p.salePrice).toLocaleString('fr-DZ')} DZD
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="col-span-4 md:col-span-2">
                  <input className="input bg-white text-center" type="number" min={1} value={item.quantity}
                    onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                </div>
                <div className="col-span-7 md:col-span-3">
                  <div className="relative">
                    <input className="input bg-white text-right pr-12" type="number" min={0} step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">DZD</span>
                  </div>
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(i)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
                {/* Line total hint */}
                {item.quantity > 0 && item.unitPrice > 0 && (
                  <div className="col-span-12 text-right text-xs text-slate-400 -mt-1 pr-8">
                    = {(item.quantity * item.unitPrice).toLocaleString('fr-DZ')} DZD
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Sous-total HT</span>
              <span className="font-medium">{subtotal.toLocaleString('fr-DZ')} DZD</span>
            </div>
            {form.hasTva && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>TVA ({form.tvaRate}%)</span>
                <span className="font-medium">{tvaAmount.toLocaleString('fr-DZ')} DZD</span>
              </div>
            )}
            <div className="flex justify-between text-xl font-display font-700 text-slate-900 pt-2 border-t">
              <span>TOTAL TTC</span>
              <span className="text-brand-600">{total.toLocaleString('fr-DZ')} DZD</span>
            </div>
          </div>
        </div>

        {/* Dates + Notes */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Dates & remarques</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Date d'échéance</label>
              <input type="date" className="input" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            {/* mod #7 — delivery date optional */}
            <div>
              <label className="label">Date de livraison <span className="text-slate-400 font-normal">(optionnelle)</span></label>
              <input type="date" className="input" value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes / Remarques</label>
              <textarea className="input resize-none" rows={1} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes optionnelles…" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link href="/invoices" className="btn-secondary">Annuler</Link>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> Enregistrement…</>
              : <><Save size={16} /> Enregistrer</>}
          </button>
        </div>

      </form>
    </div>
  );
}
