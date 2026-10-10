'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Loader2, Save } from 'lucide-react';
import Link from 'next/link';
import { adjustedUnitPrice, formatMoneyDzd, lineAdjustmentAmount, lineGrossMargin, roundMoney } from '@/lib/formatMoney';

interface Item { description: string; quantity: number; unitPrice: number; purchasePrice: number; }

export default function EditInvoicePage() {
  const { id } = useParams();
  const router = useRouter();
  const { t } = useI18nStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [items, setItems] = useState<Item[]>([]);
  const [otherCharges, setOtherCharges] = useState<{ description: string; amount: number }[]>([]);
  const [deliveryPeople, setDeliveryPeople] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/invoices/${id}`).then(({ data }) => {
      setForm({
        type: data.type, clientName: data.clientName, clientEmail: data.clientEmail || '',
        clientPhone: data.clientPhone || '', clientAddress: data.clientAddress || '',
        clientNif: data.clientNif || '', clientNis: data.clientNis || '',
        hasTva: data.hasTva, tvaRate: data.tvaRate, notes: data.notes || '',
        status: data.status, dueDate: data.dueDate ? String(data.dueDate).slice(0, 10) : '',
        invoiceDate: data.createdAt ? String(data.createdAt).slice(0, 10) : new Date().toISOString().slice(0, 10),
        deliveryDate: data.deliveryDate ? String(data.deliveryDate).slice(0, 10) : '',
        issuerName: data.issuerName || '', issuerNameSize: Number(data.issuerNameSize) || 16,
        adjustmentType: data.adjustmentType || 'discount',
        adjustmentPercent: Number(data.adjustmentPercent ?? data.discountPercent) || 0,
        deliveryPrice: Number(data.deliveryPrice) || 0,
        deliveryPersonId: data.deliveryPersonId || '',
      });
      setOtherCharges(data.otherCharges?.length
        ? data.otherCharges.map((charge: any) => ({ description: charge.description || '', amount: Number(charge.amount) || 0 }))
        : []);
      setItems(data.items.map((i: any) => ({
        description: i.description,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        purchasePrice: Number(i.purchasePrice) || 0,
      })));
      setLoading(false);
    }).catch(() => { toast.error(t('error_loading_invoice')); router.push('/invoices'); });
  }, [id, router, t]);

  useEffect(() => {
    api.get('/users/livreurs').then(({ data }) => setDeliveryPeople(data)).catch(() => setDeliveryPeople([]));
  }, []);

  const updateItem = (i: number, field: keyof Item, val: any) =>
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  const addItem = () => setItems((p) => [...p, { description: '', quantity: 1, unitPrice: 0, purchasePrice: 0 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));

  const lineAmounts = items.map((item) => roundMoney(item.quantity * item.unitPrice));
  const subtotal = roundMoney(lineAmounts.reduce((sum, amount) => sum + amount, 0));
  const adjustmentAmount = roundMoney(items.reduce((sum, item) => sum + lineAdjustmentAmount(item.unitPrice, item.quantity, form.adjustmentType, Number(form.adjustmentPercent)), 0));
  const adjustedSubtotal = roundMoney(items.reduce((sum, item) => sum + roundMoney(adjustedUnitPrice(item.unitPrice, form.adjustmentType, Number(form.adjustmentPercent)) * item.quantity), 0));
  const otherChargeTotal = roundMoney(otherCharges.reduce((sum, charge) => sum + (Number(charge.amount) || 0), 0));
  const subtotalWithCharges = roundMoney(adjustedSubtotal + otherChargeTotal);
  const tvaAmount = form.hasTva ? roundMoney((subtotalWithCharges * form.tvaRate) / 100) : 0;
  const total = roundMoney(subtotalWithCharges + tvaAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const referenceDate = form.invoiceDate || new Date().toISOString().slice(0, 10);
      if (form.deliveryDate && form.deliveryDate < referenceDate) {
        toast.error('La date de livraison ne peut pas être antérieure à la date de facturation.');
        setSaving(false);
        return;
      }

      const payload = {
        type: form.type,
        status: form.status,
        clientName: form.clientName.trim(),
        clientEmail: form.clientEmail?.trim() || undefined,
        clientPhone: form.clientPhone?.trim() || undefined,
        clientAddress: form.clientAddress?.trim() || undefined,
        clientNif: form.clientNif?.trim() || undefined,
        clientNis: form.clientNis?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
        dueDate: form.dueDate || null,
        issuerNameSize: Number(form.issuerNameSize) || 16,
        adjustmentType: form.adjustmentType,
        adjustmentPercent: Number(form.adjustmentPercent) || 0,
        otherCharges: otherCharges.filter((charge) => charge.description.trim() || Number(charge.amount) > 0),
        deliveryPrice: Number(form.deliveryPrice) || 0,
        deliveryPersonId: form.deliveryPersonId || null,
        hasTva: Boolean(form.hasTva),
        tvaRate: form.hasTva ? Number(form.tvaRate) || 19 : 0,
        issuerName: form.type !== 'bon_livraison' ? form.issuerName || undefined : undefined,
        items: items.map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          purchasePrice: Number(item.purchasePrice) || 0,
        })),
      };
      await api.put(`/invoices/${id}`, payload);
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
          {form.type !== 'bon_livraison' && (
            <div className="mt-4">
              <label className="label">Émis au nom de</label>
              <div className="flex gap-2 flex-wrap">
                {['Lm company', 'Louassaa Nabil', 'Helping Hands company'].map((name) => (
                  <label key={name} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm ${form.issuerName === name ? 'border-brand-500 bg-brand-50 font-medium' : 'border-slate-200 hover:border-slate-300'}`}>
                    <input type="radio" name="issuerName" value={name} checked={form.issuerName === name} onChange={(e) => setForm({ ...form, issuerName: e.target.value })} className="hidden" />
                    {name}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="label" htmlFor="issuerName">Nom affiché sur la facture</label>
                  <input id="issuerName" className="input" value={form.issuerName || ''}
                    onChange={(e) => setForm({ ...form, issuerName: e.target.value })} maxLength={120} />
                </div>
                <div>
                  <label className="label" htmlFor="issuerNameSize">Taille du nom ({form.issuerNameSize} pt)</label>
                  <input id="issuerNameSize" className="input" type="range" min={12} max={24} step={1}
                    value={form.issuerNameSize} onChange={(e) => setForm({ ...form, issuerNameSize: Number(e.target.value) })} />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <label className="label" htmlFor="dueDate">{t('due_date')}</label>
          <input id="dueDate" className="input max-w-xs" type="date" value={form.dueDate || ''}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
        </div>

        <div className="card p-6">
          <label className="label" htmlFor="deliveryDate">Date de livraison</label>
          <input id="deliveryDate" className="input max-w-xs" type="date" min={form.invoiceDate} value={form.deliveryDate || ''}
            onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
        </div>

        <div className="card p-6">
          <h2 className="font-display font-600 text-slate-900 mb-4">Livraison et autres charges</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label" htmlFor="deliveryPersonId">Livreur</label>
              <select id="deliveryPersonId" className="input" value={form.deliveryPersonId || ''}
                onChange={(e) => setForm({ ...form, deliveryPersonId: e.target.value })}>
                <option value="">Non assigné</option>
                {deliveryPeople.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="deliveryPrice">Prix de livraison (DZD)</label>
              <input id="deliveryPrice" className="input" type="number" min={0} step="0.01" value={form.deliveryPrice ?? 0}
                onChange={(e) => setForm({ ...form, deliveryPrice: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Frais supplémentaires facturés</label>
                <button type="button" className="btn-secondary text-xs py-1" onClick={() => setOtherCharges((current) => [...current, { description: '', amount: 0 }])}>
                  <Plus size={13} /> Ajouter un frais
                </button>
              </div>
              {otherCharges.map((charge, index) => (
                <div key={index} className="grid grid-cols-[1fr_150px_auto] gap-2 mb-2">
                  <input className="input" aria-label="Description du frais" placeholder="Description"
                    value={charge.description} onChange={(e) => setOtherCharges((current) => current.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} />
                  <input className="input text-right" aria-label="Montant du frais" type="number" min={0} step="0.01" value={charge.amount}
                    onChange={(e) => setOtherCharges((current) => current.map((item, i) => i === index ? { ...item, amount: Number(e.target.value) } : item))} />
                  <button type="button" aria-label="Supprimer ce frais"
                    onClick={() => setOtherCharges((current) => current.filter((_, i) => i !== index))} className="btn-secondary text-red-600 px-2"><Trash2 size={15} /></button>
                </div>
              ))}
              <p className="text-right text-xs text-slate-500">Total des frais : {formatMoneyDzd(otherChargeTotal)}</p>
            </div>
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
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.hasTva} onChange={(e) => setForm({ ...form, hasTva: e.target.checked })} className="w-4 h-4 accent-brand-600" />
              <span className="text-sm font-medium">TVA</span>
            </label>
            {form.hasTva && <input type="number" className="input w-20" value={form.tvaRate} onChange={(e) => setForm({ ...form, tvaRate: Number(e.target.value) })} />}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm font-medium">Ajustement</label>
            <select className="input w-32 py-1" value={form.adjustmentType || 'discount'}
              onChange={(e) => setForm({ ...form, adjustmentType: e.target.value })}>
              <option value="discount">Remise (-)</option>
              <option value="addition">Ajout (+)</option>
            </select>
            <input aria-label="Pourcentage d'ajustement" type="number" min={0} max={100} step={0.01} className="input w-20 text-right" value={form.adjustmentPercent ?? 0}
              onChange={(e) => setForm({ ...form, adjustmentPercent: Number(e.target.value) || 0 })} />
            <span className="text-sm text-slate-500">%</span>
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
                <div className="col-span-12 md:col-span-5">
                  <input className="input bg-white" value={item.description} onChange={(e) => updateItem(i, 'description', e.target.value)} required placeholder={t('description')} />
                </div>
                <div className="col-span-3 md:col-span-1">
                  <label className="block text-xs text-slate-500 mb-1">Qté</label>
                  <input aria-label="Quantité" className="input bg-white text-center" type="number" min={1} value={item.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} />
                </div>
                <div className="col-span-4 md:col-span-2">
                  <label className="block text-xs text-amber-700 mb-1">Prix d'achat</label>
                  <input aria-label="Prix d'achat" className="input bg-amber-50 border-amber-200 text-right" type="number" min={0} step="0.01" value={item.purchasePrice} onChange={(e) => updateItem(i, 'purchasePrice', Number(e.target.value))} />
                </div>
                <div className="col-span-4 md:col-span-3">
                  <label className="block text-xs text-slate-500 mb-1">Prix de vente</label>
                  <input aria-label="Prix de vente" className="input bg-white text-right" type="number" min={0} step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} />
                </div>
                <div className="col-span-1 flex justify-center">
                  {items.length > 1 && <button type="button" onClick={() => removeItem(i)} className="p-1.5 text-red-400 hover:text-red-600 rounded"><Trash2 size={14} /></button>}
                </div>
                {lineAdjustmentAmount(item.unitPrice, item.quantity, form.adjustmentType, Number(form.adjustmentPercent)) > 0 && (
                  <div className="col-span-12 text-right text-xs">
                    <span className={form.adjustmentType === 'addition' ? 'text-amber-700' : 'text-emerald-600'}>
                      {form.adjustmentType === 'addition' ? 'Ajout' : 'Remise'} sur cette ligne : {form.adjustmentType === 'addition' ? '+' : '-'}{formatMoneyDzd(lineAdjustmentAmount(item.unitPrice, item.quantity, form.adjustmentType, Number(form.adjustmentPercent)))}
                    </span>
                  </div>
                )}
                {item.purchasePrice > 0 && <div className="col-span-12 text-right text-xs text-emerald-700">Marge : {formatMoneyDzd(lineGrossMargin(item.unitPrice, item.purchasePrice, item.quantity))}</div>}
              </div>
            ))}
          </div>
          <div className="mt-4 border-t pt-4 space-y-1.5 text-right">
            <div className="text-sm text-slate-600">{t('excl_tax')}: <span className="font-medium">{formatMoneyDzd(subtotal)}</span></div>
            {Number(form.adjustmentPercent) > 0 && (
              <div className={`text-sm ${form.adjustmentType === 'addition' ? 'text-amber-700' : 'text-emerald-600'}`}>
                {form.adjustmentType === 'addition' ? 'Ajout' : 'Remise'} ({form.adjustmentPercent}%): <span className="font-medium">{form.adjustmentType === 'addition' ? '+' : '-'}{formatMoneyDzd(adjustmentAmount)}</span>
              </div>
            )}
            {otherChargeTotal > 0 && (
              <div className="text-sm text-slate-600">Frais supplémentaires : <span className="font-medium">+{formatMoneyDzd(otherChargeTotal)}</span></div>
            )}
            {form.hasTva && <div className="text-sm text-slate-600">TVA: <span className="font-medium">{formatMoneyDzd(tvaAmount)}</span></div>}
            <div className="text-lg font-display font-700 text-brand-600">{t('total')}: {formatMoneyDzd(total)}</div>
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
