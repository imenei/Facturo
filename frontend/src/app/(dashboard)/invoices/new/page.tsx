'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import {
  Plus, Trash2, Loader2, Save, ArrowLeft,
  LayoutTemplate, ShoppingBag, Upload, X, Building2,
  Lock, TrendingUp, ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

// MOD 7: item includes purchasePrice (internal)
interface Item {
  description: string;
  quantity: number;
  unitPrice: number;
  purchasePrice: number; // MOD 7: internal, not shown on PDF
}

const TYPE_OPTIONS = [
  { value: 'facture', label: '📄 Facture' },
  { value: 'proforma', label: '📋 Proforma' },
  { value: 'bon_livraison', label: '📦 Bon de livraison' },
];

const TEMPLATE_LABELS: Record<string, string> = {
  classic: '📄 Classic', compact: '📋 Compact', detailed: '📑 Détaillé',
  corporate: '🏢 Corporate', table_focus: '📊 Tableau Focus',
};

function ClientLogoPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Fichier image requis'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Taille max : 5 Mo'); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '';
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) processFile(f);
  };

  if (value) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-xl border-2 border-slate-200 overflow-hidden bg-white flex items-center justify-center shrink-0">
          <img src={value} alt="Logo client" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col gap-1.5">
          <button type="button" onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg">
            <Upload size={12} /> Changer
          </button>
          <button type="button" onClick={() => onChange('')}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg">
            <X size={12} /> Supprimer
          </button>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)} onDrop={handleDrop}
      className={clsx(
        'flex flex-col items-center justify-center gap-2 w-full h-24 rounded-xl border-2 border-dashed cursor-pointer transition-all',
        dragging ? 'border-brand-400 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50',
      )}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
        <Building2 size={16} className="text-slate-400" />
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-slate-600">Logo de l'entreprise cliente</p>
        <p className="text-xs text-slate-400">Cliquez ou glissez une image (PNG, JPG, SVG)</p>
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

export default function NewInvoicePage() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useI18nStore();
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductPicker, setShowProductPicker] = useState<number | null>(null);
  const [existingClients, setExistingClients] = useState<any[]>([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [showInternalCosts, setShowInternalCosts] = useState(false); // MOD 7: toggle

  const [form, setForm] = useState({
    type: params.get('type') || 'facture',
    clientName: '', clientEmail: '', clientPhone: '',
    clientAddress: '', clientNif: '', clientNis: '',
    clientLogoUrl: '', hasTva: false, tvaRate: 19,
    notes: '', dueDate: '', deliveryDate: '', templateType: '',
  });

  // MOD 7: items include purchasePrice
  const [items, setItems] = useState<Item[]>([
    { description: '', quantity: 1, unitPrice: 0, purchasePrice: 0 },
  ]);

  useEffect(() => {
    Promise.all([
      api.get('/templates').catch(() => ({ data: [] })),
      api.get('/products').catch(() => ({ data: [] })),
      api.get('/clients').catch(() => ({ data: [] })),
    ]).then(([tmpl, prod, clients]) => {
      setTemplates(tmpl.data);
      setProducts(prod.data);
      setExistingClients(clients.data);
      const def = tmpl.data.find((t: any) => t.isDefault);
      if (def) setForm((p) => ({ ...p, templateType: def.type }));
    });
  }, []);

  const clientSuggestions = form.clientName.length >= 1
    ? existingClients.filter((c) =>
        c.clientName?.toLowerCase().includes(form.clientName.toLowerCase()),
      ).slice(0, 6)
    : [];

  const pickExistingClient = (c: any) => {
    const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';
    let logoUrl = c.clientLogoUrl || '';
    if (logoUrl && !logoUrl.startsWith('data:') && !logoUrl.startsWith('http')) {
      logoUrl = `${API_BASE}${logoUrl}`;
    }
    setForm((p) => ({
      ...p, clientName: c.clientName || '',
      clientEmail: c.clientEmail || '', clientPhone: c.clientPhone || '',
      clientAddress: c.clientAddress || '', clientLogoUrl: logoUrl,
    }));
    setShowClientSuggestions(false);
  };

  const addItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0, purchasePrice: 0 }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof Item, value: any) =>
    setItems(items.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  // MOD 7: when picking a product, also fill purchasePrice
  const pickProduct = (i: number, product: any) => {
    setItems(items.map((item, idx) =>
      idx === i ? {
        ...item,
        description: product.name,
        unitPrice: Number(product.salePrice) || 0,
        purchasePrice: Number(product.purchasePrice) || 0, // MOD 7
      } : item,
    ));
    setShowProductPicker(null);
  };

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tvaAmount = form.hasTva ? (subtotal * form.tvaRate) / 100 : 0;
  const total = subtotal + tvaAmount;

  // MOD 7: internal margin calculation
  const totalMargin = items.reduce((sum, item) =>
    sum + (item.unitPrice - item.purchasePrice) * item.quantity, 0);
  const marginRate = total > 0 ? ((totalMargin / total) * 100).toFixed(1) : '0';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        // MOD 7: send purchasePrice per item so backend can store it
        items: items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          purchasePrice: item.purchasePrice, // MOD 7: internal, stored in jsonb
        })),
      };
      const { data } = await api.post('/invoices', payload);
      toast.success(t('invoice_created_successfully'));
      router.push(`/invoices/${data.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error_during_creation'));
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
          <h1 className="text-2xl font-display font-700 text-slate-900">{t('new_document')}</h1>
          <p className="text-slate-500 text-sm">{t('create_invoice_proforma_or_delivery_note')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Type + template */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('document_type')}</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            {TYPE_OPTIONS.map((opt) => (
              <button key={opt.value} type="button" onClick={() => setForm({ ...form, type: opt.value })}
                className={clsx('px-4 py-2 rounded-xl border-2 font-medium text-sm transition-all',
                  form.type === opt.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300')}>
                {opt.label}
              </button>
            ))}
          </div>
          {templates.length > 0 && (
            <div>
              <label className="label flex items-center gap-1.5"><LayoutTemplate size={14} /> {t('print_template')}</label>
              <div className="flex flex-wrap gap-2">
                {templates.map((tmpl) => (
                  <button key={tmpl.type || tmpl.id} type="button"
                    onClick={() => setForm({ ...form, templateType: tmpl.type || tmpl.id })}
                    className={clsx('px-3 py-1.5 rounded-lg border text-sm transition-all',
                      form.templateType === (tmpl.type || tmpl.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-300')}>
                    {TEMPLATE_LABELS[tmpl.type] || tmpl.name || tmpl.type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Client */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('client_information')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Logo de l'entreprise cliente <span className="text-slate-400 font-normal">(optionnel)</span></label>
              <ClientLogoPicker value={form.clientLogoUrl} onChange={(v) => setForm({ ...form, clientLogoUrl: v })} />
            </div>

            <div className="md:col-span-2 relative">
              <label className="label">Nom / Raison sociale <span className="text-red-500">*</span></label>
              <input className="input" required value={form.clientName}
                placeholder="Nom ou raison sociale du client"
                onChange={(e) => { setForm({ ...form, clientName: e.target.value }); setShowClientSuggestions(true); }}
                onFocus={() => setShowClientSuggestions(true)}
                onBlur={() => setTimeout(() => setShowClientSuggestions(false), 150)}
                autoComplete="off"
              />
              {showClientSuggestions && clientSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-xl shadow-xl mt-1 overflow-hidden">
                  <div className="px-3 py-1.5 text-xs text-slate-400 bg-slate-50 border-b border-slate-100">Clients existants</div>
                  {clientSuggestions.map((c) => (
                    <button key={c.clientId || c.clientName} type="button" onMouseDown={() => pickExistingClient(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-brand-50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white overflow-hidden shrink-0 flex items-center justify-center">
                        {c.clientLogoUrl
                          ? <img src={c.clientLogoUrl.startsWith('data:') || c.clientLogoUrl.startsWith('http') ? c.clientLogoUrl : `${process.env.NEXT_PUBLIC_API_URL?.replace('/api', '')}${c.clientLogoUrl}`} alt="" className="w-full h-full object-contain" />
                          : <span className="text-xs font-700 text-slate-500 uppercase">{c.clientName?.charAt(0)}</span>
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{c.clientName}</div>
                        <div className="text-xs text-slate-400 truncate">{[c.clientPhone, c.clientEmail].filter(Boolean).join(' · ')}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="label">{t('email')}</label>
              <input className="input" type="email" value={form.clientEmail}
                onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} placeholder={t('client_email_placeholder')} />
            </div>
            <div>
              <label className="label">{t('phone')}</label>
              <input className="input" value={form.clientPhone}
                onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} placeholder={t('phone_placeholder')} />
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('address')}</label>
              <input className="input" value={form.clientAddress}
                onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} placeholder={t('full_address')} />
            </div>
            <div>
              <label className="label">NIF</label>
              <input className="input" value={form.clientNif} onChange={(e) => setForm({ ...form, clientNif: e.target.value })} />
            </div>
            <div>
              <label className="label">NIS</label>
              <input className="input" value={form.clientNis} onChange={(e) => setForm({ ...form, clientNis: e.target.value })} />
            </div>
          </div>
        </div>

        {/* Articles */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-display font-600 text-slate-900">{t('items_services')}</h2>
            <div className="flex gap-2">
              {/* MOD 7: toggle to show/hide purchase price column */}
              <button type="button" onClick={() => setShowInternalCosts(!showInternalCosts)}
                className={clsx('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all',
                  showInternalCosts ? 'bg-slate-100 border-slate-300 text-slate-700' : 'border-slate-200 text-slate-500 hover:border-slate-300')}>
                <Lock size={12} /> {showInternalCosts ? 'Masquer prix achat' : 'Prix achat (interne)'}
              </button>
              <button type="button" onClick={addItem} className="btn-secondary text-sm py-1.5">
                <Plus size={15} /> {t('add_line')}
              </button>
            </div>
          </div>

          {/* Column headers */}
          <div className={clsx(
            'hidden md:grid gap-2 text-xs font-600 text-slate-400 uppercase tracking-wide px-1 mb-1',
            showInternalCosts ? 'grid-cols-13' : 'grid-cols-12',
          )}>
            <div className={showInternalCosts ? 'col-span-5' : 'col-span-6'}>Désignation</div>
            <div className="col-span-2 text-center">Qté</div>
            {showInternalCosts && (
              <div className="col-span-2 text-right text-amber-600 flex items-center justify-end gap-1">
                <Lock size={10} /> P. Achat
              </div>
            )}
            <div className="col-span-3 text-right">Prix Vente</div>
            <div className="col-span-1" />
          </div>

          <div className="space-y-2">
            {items.map((item, i) => {
              const margin = (item.unitPrice - item.purchasePrice) * item.quantity;
              const marginPct = item.unitPrice > 0 ? (((item.unitPrice - item.purchasePrice) / item.unitPrice) * 100).toFixed(0) : '0';
              return (
                <div key={i} className="bg-slate-50 rounded-lg p-2">
                  <div className={clsx(
                    'grid gap-2 items-center',
                    showInternalCosts ? 'grid-cols-13' : 'grid-cols-12',
                  )}>
                    {/* Description */}
                    <div className={clsx('relative', showInternalCosts ? 'col-span-5' : 'col-span-6')}>
                      <input className="input bg-white pr-8" placeholder="Description de l'article"
                        value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} required />
                      {products.length > 0 && (
                        <button type="button" onClick={() => setShowProductPicker(showProductPicker === i ? null : i)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-brand-500 rounded" title="Choisir un produit">
                          <ShoppingBag size={14} />
                        </button>
                      )}
                      {showProductPicker === i && (
                        <div className="absolute top-full left-0 right-0 z-20 bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                          {products.map((p) => (
                            <button key={p.id} type="button" onClick={() => pickProduct(i, p)}
                              className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm flex items-center justify-between">
                              <div>
                                <div className="font-medium text-slate-900">{p.name}</div>
                                {p.reference && <div className="text-xs text-slate-400">{p.reference}</div>}
                              </div>
                              <div className="text-right ml-3 shrink-0">
                                <div className="text-brand-600 font-medium text-xs">{Number(p.salePrice).toLocaleString('fr-FR')} DZD</div>
                                {/* MOD 7: show purchase price in picker */}
                                {p.purchasePrice > 0 && (
                                  <div className="text-slate-400 text-xs">Achat: {Number(p.purchasePrice).toLocaleString('fr-FR')} DZD</div>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Qty */}
                    <div className="col-span-2">
                      <input className="input bg-white text-center" type="number" min={1}
                        value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                    </div>

                    {/* MOD 7: Purchase price column (internal) */}
                    {showInternalCosts && (
                      <div className="col-span-2">
                        <div className="relative">
                          <input className="input bg-amber-50 border-amber-200 text-right pr-10 text-sm" type="number" min={0} step="0.01"
                            value={item.purchasePrice} onChange={(e) => updateItem(i, 'purchasePrice', Number(e.target.value))}
                            placeholder="0" />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-amber-400">DZD</span>
                        </div>
                      </div>
                    )}

                    {/* Sale price */}
                    <div className="col-span-3">
                      <div className="relative">
                        <input className="input bg-white text-right pr-12" type="number" min={0} step="0.01"
                          value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">DZD</span>
                      </div>
                    </div>

                    {/* Remove */}
                    <div className="col-span-1 flex justify-center">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(i)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row total + margin (MOD 7) */}
                  <div className="flex items-center justify-between mt-1 px-1">
                    {item.quantity > 0 && item.unitPrice > 0 && (
                      <span className="text-xs text-slate-400">
                        = {(item.quantity * item.unitPrice).toLocaleString('fr-FR')} DZD
                      </span>
                    )}
                    {/* MOD 7: show margin hint when internal costs visible */}
                    {showInternalCosts && item.purchasePrice > 0 && item.unitPrice > 0 && (
                      <span className={clsx(
                        'text-xs font-medium flex items-center gap-1',
                        margin >= 0 ? 'text-emerald-600' : 'text-red-500',
                      )}>
                        <TrendingUp size={10} />
                        Marge: {margin.toLocaleString('fr-FR')} DZD ({marginPct}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals */}
          <div className="mt-6 border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>{t('subtotal_excl_tax')}</span>
              <span className="font-medium">{subtotal.toLocaleString('fr-FR')} DZD</span>
            </div>

            {/* TVA toggle */}
            <div className="flex items-center gap-3 py-1">
              <button type="button" onClick={() => setForm({ ...form, hasTva: !form.hasTva })}
                className={clsx('relative w-10 h-5 rounded-full transition-colors', form.hasTva ? 'bg-brand-500' : 'bg-slate-200')}>
                <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', form.hasTva ? 'left-5' : 'left-0.5')} />
              </button>
              <span className="text-sm text-slate-600">{t('vat')}</span>
              {form.hasTva && (
                <div className="flex items-center gap-2">
                  <input type="number" className="input w-20 text-sm text-center py-1" value={form.tvaRate}
                    onChange={(e) => setForm({ ...form, tvaRate: Number(e.target.value) })} min={0} max={100} />
                  <span className="text-sm text-slate-500">%</span>
                </div>
              )}
            </div>

            {form.hasTva && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>TVA ({form.tvaRate}%)</span>
                <span className="font-medium">{tvaAmount.toLocaleString('fr-FR')} DZD</span>
              </div>
            )}

            <div className="flex justify-between text-xl font-display font-700 text-slate-900 pt-2 border-t">
              <span>{t('total_incl_tax')}</span>
              <span className="text-brand-600">{total.toLocaleString('fr-FR')} DZD</span>
            </div>

            {/* MOD 7: internal margin summary when costs shown */}
            {showInternalCosts && (
              <div className={clsx(
                'flex justify-between text-sm font-medium pt-1 border-t border-dashed border-slate-200 items-center gap-2',
                totalMargin >= 0 ? 'text-emerald-600' : 'text-red-500',
              )}>
                <span className="flex items-center gap-1"><Lock size={11} /> Marge brute (interne)</span>
                <span>{totalMargin.toLocaleString('fr-FR')} DZD ({marginRate}%)</span>
              </div>
            )}
          </div>
        </div>

        {/* Dates + notes */}
        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">{t('dates_remarks')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Date d'échéance</label>
              <input type="date" className="input" value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de livraison <span className="text-slate-400 font-normal">(optionnelle)</span></label>
              <input type="date" className="input" value={form.deliveryDate}
                onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Notes / Remarques</label>
              <textarea className="input resize-none" rows={1} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes optionnelles…" />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <Link href="/invoices" className="btn-secondary">{t('cancel')}</Link>
          <button type="submit" disabled={saving} className="btn-primary px-8">
            {saving
              ? <><Loader2 size={16} className="animate-spin" /> {t('saving')}</>
              : <><Save size={16} /> {t('save')}</>
            }
          </button>
        </div>
      </form>
    </div>
  );
}
