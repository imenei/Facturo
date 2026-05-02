'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import { getCachedTasks, cacheTasks } from '@/lib/offlineDB';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, CheckCircle, XCircle, Clock, Loader2, Edit2, Save, X,
  MapPin, Calendar, Play, Square, Printer, DollarSign, AlertTriangle,
  Timer,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

function logoSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function getStatusConfig(t: (key: string) => string) {
  return {
    en_attente: { label: t('task_status_pending'), color: 'bg-amber-100 text-amber-700', icon: Clock },
    terminee: { label: t('task_status_completed'), color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
    non_terminee: { label: t('task_status_not_completed'), color: 'bg-red-100 text-red-600', icon: XCircle },
  } as const;
}

type StatusKey = keyof ReturnType<typeof getStatusConfig>;

function ClientLogo({ name, logoUrl, size = 'md' }: { name?: string; logoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const src = logoSrc(logoUrl);
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-xl' }[size];
  const COLORS = ['bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700', 'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700', 'bg-red-100 text-red-700', 'bg-indigo-100 text-indigo-700'];
  const color = COLORS[((name || '').charCodeAt(0) || 0) % COLORS.length];
  if (src) return (
    <div className={clsx('rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center', sizeClass)}>
      <img src={src} alt={name || ''} className="w-full h-full object-contain"
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
    </div>
  );
  if (!name) return null;
  return (
    <div className={clsx('rounded-xl flex items-center justify-center font-700 uppercase shrink-0', sizeClass, color)}>
      {name.charAt(0)}
    </div>
  );
}

// MOD 8a: Print bon de livraison
function printBonDeLivraison(task: any, companyName: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  const id = task.id?.slice(-6).toUpperCase() || '------';
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Bon de Livraison - ${id}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 32px; color: #1e293b; max-width: 700px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1a54ff; padding-bottom: 16px; margin-bottom: 24px; }
    .company { font-size: 20px; font-weight: bold; color: #1a54ff; }
    .doc-title { font-size: 14px; font-weight: bold; color: #64748b; text-align: right; }
    .doc-num { font-size: 22px; font-weight: bold; color: #1e293b; }
    h3 { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .info-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .label { color: #64748b; font-size: 13px; }
    .value { font-weight: bold; font-size: 13px; }
    .signature-zone { margin-top: 40px; display: flex; gap: 32px; }
    .sig-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; min-height: 80px; }
    .sig-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style></head><body>
  <div class="header">
    <div><div class="company">${companyName}</div><div style="font-size:12px;color:#64748b">Bon de livraison</div></div>
    <div class="doc-title"><div>BON DE LIVRAISON</div><div class="doc-num">N° ${id}</div></div>
  </div>
  <div class="info-box">
    <h3>Client</h3>
    <div style="font-size:16px;font-weight:bold">${task.clientName || '—'}</div>
    ${task.clientAddress ? `<div style="color:#64748b;font-size:13px;margin-top:4px">${task.clientAddress}</div>` : ''}
  </div>
  <div class="info-box">
    <h3>Tâche / Description</h3>
    <div style="font-weight:bold">${task.name}</div>
    ${task.description ? `<div style="color:#64748b;font-size:13px;margin-top:4px">${task.description}</div>` : ''}
  </div>
  <div class="row"><span class="label">Date de livraison prévue</span><span class="value">${task.deliveryDate ? new Date(task.deliveryDate).toLocaleDateString('fr-FR') : '___/___/______'}</span></div>
  <div class="row"><span class="label">Prix final</span><span class="value">${Number(task.finalPrice || task.price).toLocaleString('fr-FR')} DZD</span></div>
  ${task.extraFees > 0 ? `<div class="row"><span class="label">Frais imprévus</span><span class="value">+${Number(task.extraFees).toLocaleString('fr-FR')} DZD${task.extraFeesNote ? ' (' + task.extraFeesNote + ')' : ''}</span></div>` : ''}
  <div class="row"><span class="label">Livré le</span><span class="value">___/___/______</span></div>
  <div class="signature-zone">
    <div class="sig-box"><div class="sig-label">Signature du client</div></div>
    <div class="sig-box">
      <div class="sig-label">Livreur : ${task.assignedTo?.name || ''}</div>
    </div>
  </div>
  <div class="footer">Document généré le ${new Date().toLocaleDateString('fr-FR')} — ${companyName}</div>
  </body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

// MOD 8a: Print tasks summary for admin (by livreur + period)
function PrintRecapModal({ users, onClose }: { users: any[]; onClose: () => void }) {
  const [livreurId, setLivreurId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePrint = async () => {
    if (!livreurId) { toast.error('Sélectionnez un livreur'); return; }
    setLoading(true);
    try {
      const params: any = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const { data: tasks } = await api.get(`/tasks/by-livreur/${livreurId}`, { params });
      const livreur = users.find((u) => u.id === livreurId);
      const w = window.open('', '_blank');
      if (!w) return;
      const totalFinal = tasks.reduce((s: number, t: any) => s + Number(t.finalPrice || t.price), 0);
      const rows = tasks.map((t: any) => `
        <tr>
          <td>${new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
          <td>${t.clientName || '—'}</td>
          <td>${t.clientAddress || '—'}</td>
          <td><span class="${t.status === 'terminee' ? 'ok' : t.status === 'non_terminee' ? 'ko' : 'wait'}">${t.status === 'terminee' ? 'Terminé' : t.status === 'non_terminee' ? 'Non terminé' : 'En attente'}</span></td>
          <td class="r">${Number(t.price).toLocaleString('fr-FR')} DZD</td>
          <td class="r">${Number(t.extraFees || 0).toLocaleString('fr-FR')} DZD</td>
          <td class="r"><strong>${Number(t.finalPrice || t.price).toLocaleString('fr-FR')} DZD</strong></td>
        </tr>`).join('');
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Récap tâches</title>
      <style>body{font-family:Arial;padding:24px;color:#1e293b} h1{color:#1a54ff;font-size:20px} h2{font-size:14px;color:#64748b;font-weight:normal}
      table{width:100%;border-collapse:collapse;margin-top:16px} th{background:#1a54ff;color:white;padding:8px;text-align:left;font-size:12px}
      td{padding:7px 8px;font-size:12px;border-bottom:1px solid #e2e8f0} .r{text-align:right}
      .ok{color:#059669;font-weight:bold} .ko{color:#dc2626;font-weight:bold} .wait{color:#d97706;font-weight:bold}
      .total{background:#f8fafc;font-weight:bold} @media print{body{padding:8px}}</style></head><body>
      <h1>Récapitulatif des tâches</h1>
      <h2>Livreur : <strong>${livreur?.name || livreurId}</strong> · Période : ${from || '—'} → ${to || '—'}</h2>
      <table><thead><tr><th>Date</th><th>Client</th><th>Adresse</th><th>Statut</th><th class="r">Prix base</th><th class="r">Frais imprévus</th><th class="r">Prix final</th></tr></thead>
      <tbody>${rows}<tr class="total"><td colspan="6">TOTAL</td><td class="r">${totalFinal.toLocaleString('fr-FR')} DZD</td></tr></tbody></table>
      </body></html>`);
      w.document.close();
      setTimeout(() => w.print(), 500);
    } catch { toast.error('Erreur chargement tâches'); }
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-slide-up">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-600 text-slate-900">Imprimer récap livreur</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Livreur *</label>
            <select className="input" value={livreurId} onChange={(e) => setLivreurId(e.target.value)}>
              <option value="">Choisir un livreur</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">Du</label>
              <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <label className="label">Au</label>
              <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Annuler</button>
          <button onClick={handlePrint} disabled={loading} className="btn-primary flex-1">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <><Printer size={15} /> Imprimer</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// MOD 6: Delivery timer
function DeliveryTimer({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${h > 0 ? h + 'h ' : ''}${m}m ${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-mono text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
      <Timer size={10} /> {elapsed}
    </span>
  );
}

function TaskCard({ task, onUpdate, isLivreur, isAdmin, t, companyName }: {
  task: any; onUpdate: () => void; isLivreur: boolean; isAdmin: boolean; t: (k: string) => string; companyName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || '');
  const [saving, setSaving] = useState(false);
  // MOD 6: extra fees modal for admin
  const [showExtraFees, setShowExtraFees] = useState(false);
  const [extraFees, setExtraFees] = useState(String(task.extraFees || 0));
  const [extraFeesNote, setExtraFeesNote] = useState(task.extraFeesNote || '');
  const statusConfig = getStatusConfig(t);
  const statusKey: StatusKey = task.status === 'terminee' || task.status === 'non_terminee' ? task.status : 'en_attente';
  const { icon: StatusIcon, color, label } = statusConfig[statusKey];
  const hasClient = !!(task.clientName || task.clientLogoUrl);

  const updateStatus = async (status: StatusKey) => {
    setSaving(true);
    try { await api.put(`/tasks/${task.id}`, { status }); onUpdate(); toast.success(t('task_status_updated')); }
    catch { toast.error(t('error_updating_task')); }
    setSaving(false);
  };

  const saveRemarks = async () => {
    setSaving(true);
    try { await api.put(`/tasks/${task.id}`, { remarks }); setEditing(false); onUpdate(); toast.success(t('remark_saved')); }
    catch { toast.error(t('error_saving_remark')); }
    setSaving(false);
  };

  // MOD 6: start delivery
  const startDelivery = async () => {
    setSaving(true);
    try { await api.patch(`/tasks/${task.id}/start-delivery`); onUpdate(); toast.success('Livraison démarrée !'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erreur'); }
    setSaving(false);
  };

  // MOD 6: finish delivery
  const finishDelivery = async () => {
    setSaving(true);
    try { await api.patch(`/tasks/${task.id}/finish-delivery`); onUpdate(); toast.success('Livraison terminée !'); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Erreur'); }
    setSaving(false);
  };

  // MOD 6: admin saves extra fees
  const saveExtraFees = async () => {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}/extra-fees`, { extraFees: Number(extraFees), extraFeesNote });
      setShowExtraFees(false); onUpdate(); toast.success('Frais imprévus enregistrés');
    } catch { toast.error('Erreur enregistrement frais'); }
    setSaving(false);
  };

  const finalPrice = Number(task.finalPrice || task.price);
  const basePrice = Number(task.price);
  const extra = Number(task.extraFees || 0);

  return (
    <div className={clsx('card overflow-hidden animate-slide-up', task.status === 'terminee' && 'opacity-75')}>
      {isLivreur && hasClient && (
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/60">
          <ClientLogo name={task.clientName} logoUrl={task.clientLogoUrl} size="md" />
          <div className="min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-600">{t('client')}</p>
            <p className="font-display font-700 text-slate-900 text-base truncate">{task.clientName}</p>
            {task.clientAddress && (
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5 truncate">
                <MapPin size={10} /> {task.clientAddress}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {!isLivreur && hasClient && <ClientLogo name={task.clientName} logoUrl={task.clientLogoUrl} size="sm" />}
              <h3 className="font-display font-600 text-slate-900">{task.name}</h3>
            </div>
            {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
            {!isLivreur && task.clientName && <p className="text-xs text-slate-400 mt-1">🏢 {task.clientName}</p>}
            {!isLivreur && task.assignedTo && <p className="text-xs text-slate-400 mt-0.5">👤 {task.assignedTo.name}</p>}
            {/* MOD 3: created by */}
            {task.createdBy && (
              <p className="text-xs text-slate-400 mt-0.5">
                {task.createdBy.role === 'admin' ? '🛡 Admin' : `💼 ${task.createdBy.name}`}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={clsx('badge flex items-center gap-1', color)}><StatusIcon size={11} />{label}</span>
            {/* MOD 6: show price breakdown */}
            <span className="font-display font-700 text-brand-600 text-sm">{finalPrice.toLocaleString('fr-FR')} DZD</span>
            {extra > 0 && (
              <span className="text-xs text-orange-500">(base {basePrice.toLocaleString('fr-FR')} + {extra.toLocaleString('fr-FR')} imprévus)</span>
            )}
          </div>
        </div>

        {/* MOD 6: delivery tracking info */}
        {task.startedDeliveryAt && !task.finishedDeliveryAt && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-blue-600 font-medium">🚚 Livraison en cours</span>
            <DeliveryTimer startedAt={task.startedDeliveryAt} />
          </div>
        )}
        {task.finishedDeliveryAt && task.deliveryDurationMinutes != null && (
          <div className="mb-3 text-xs text-emerald-600">
            ✅ Livré en {task.deliveryDurationMinutes} min
          </div>
        )}

        {(task.dueDate || task.deliveryDate) && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-slate-500">
            {task.dueDate && <span className="flex items-center gap-1"><Calendar size={11} />{t('due_date_limit')} : {new Date(task.dueDate).toLocaleDateString('fr-FR')}</span>}
            {task.deliveryDate && <span className="flex items-center gap-1 text-brand-500"><Calendar size={11} />{t('delivery_date')} : {new Date(task.deliveryDate).toLocaleDateString('fr-FR')}</span>}
          </div>
        )}

        {/* MOD 6: livreur delivery buttons */}
        {isLivreur && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {!task.startedDeliveryAt && task.status !== 'terminee' && (
              <button onClick={startDelivery} disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-xl text-sm font-medium transition-all">
                <Play size={14} /> Démarrer la livraison
              </button>
            )}
            {task.startedDeliveryAt && !task.finishedDeliveryAt && (
              <button onClick={finishDelivery} disabled={saving}
                className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-sm font-medium transition-all">
                <Square size={14} /> Terminer la livraison
              </button>
            )}
            {/* MOD 8a: livreur prints bon de livraison */}
            <button onClick={() => printBonDeLivraison(task, 'Mon Entreprise')}
              className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-medium transition-all">
              <Printer size={14} /> Bon de livraison
            </button>
          </div>
        )}

        {/* Classic status buttons for livreur (when not using delivery flow) */}
        {isLivreur && task.finishedDeliveryAt && (
          <div className="flex gap-2 mb-3">
            <button onClick={() => updateStatus('terminee')} disabled={task.status === 'terminee' || saving}
              className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                task.status === 'terminee' ? 'bg-emerald-500 text-white cursor-default shadow-sm' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200')}>
              <CheckCircle size={15} /> {t('task_status_completed')}
            </button>
            <button onClick={() => updateStatus('non_terminee')} disabled={task.status === 'non_terminee' || saving}
              className={clsx('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                task.status === 'non_terminee' ? 'bg-red-500 text-white cursor-default shadow-sm' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200')}>
              <XCircle size={15} /> {t('task_status_not_completed')}
            </button>
          </div>
        )}

        {/* MOD 6: Admin — extra fees section */}
        {isAdmin && (
          <div className="mb-3">
            {showExtraFees ? (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-2">
                <p className="text-xs font-medium text-orange-700 flex items-center gap-1"><AlertTriangle size={12} /> Frais imprévus</p>
                <div className="flex gap-2">
                  <input type="number" min={0} className="input text-sm flex-1" placeholder="Montant (DZD)" value={extraFees}
                    onChange={(e) => setExtraFees(e.target.value)} />
                  <input className="input text-sm flex-1" placeholder="Note (ex: péage)" value={extraFeesNote}
                    onChange={(e) => setExtraFeesNote(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveExtraFees} disabled={saving} className="btn-primary text-xs py-1.5">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <><Save size={12} /> Enregistrer</>}
                  </button>
                  <button onClick={() => setShowExtraFees(false)} className="btn-secondary text-xs py-1.5"><X size={12} /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowExtraFees(true)}
                className="text-xs text-orange-500 hover:text-orange-700 flex items-center gap-1 py-1">
                <DollarSign size={12} /> Ajouter frais imprévus {extra > 0 && `(actuel: +${extra.toLocaleString('fr-FR')} DZD)`}
              </button>
            )}
          </div>
        )}

        {/* Remarks */}
        <div className="pt-3 border-t border-slate-100">
          {editing ? (
            <div className="flex gap-2">
              <input className="input flex-1 text-sm" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                placeholder={t('add_remark_placeholder')} autoFocus />
              <button onClick={saveRemarks} disabled={saving} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                <Save size={15} />
              </button>
              <button onClick={() => setEditing(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500 flex-1 italic">{task.remarks || t('no_remarks')}</p>
              <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 rounded">
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuthStore();
  const { t } = useI18nStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [showPrintRecap, setShowPrintRecap] = useState(false); // MOD 8a
  const [users, setUsers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({
    name: '', description: '', price: 0,
    assignedToId: '', dueDate: '', deliveryDate: '',
    clientName: '', clientLogoUrl: '', clientAddress: '',
  });
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');

  const isLivreur = user?.role === 'livreur';
  const isAdmin = user?.role === 'admin';
  const statusConfig = getStatusConfig(t);

  const load = async () => {
    try {
      const tRes = await api.get('/tasks');
      setTasks(tRes.data);
      await cacheTasks(tRes.data);
      if (isLivreur) {
        const s = await api.get('/tasks/my-stats');
        setStats(s.data);
      }
      if (!isLivreur) {
        const [u, c] = await Promise.all([
          api.get('/users?role=livreur'),
          api.get('/clients').catch(() => ({ data: [] })),
        ]);
        setUsers(u.data);
        setClients(c.data);
      }
    } catch {
      const cached = await getCachedTasks();
      if (cached.length) { setTasks(cached); toast(t('offline_mode'), { icon: '📶' }); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pickClient = (c: any) => setNewTask((p) => ({ ...p, clientName: c.clientName || '', clientLogoUrl: c.clientLogoUrl || '', clientAddress: c.clientAddress || '' }));
  const clearClient = () => setNewTask((p) => ({ ...p, clientName: '', clientLogoUrl: '', clientAddress: '' }));

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tasks', newTask);
      toast.success(t('task_created'));
      setShowNew(false);
      setNewTask({ name: '', description: '', price: 0, assignedToId: '', dueDate: '', deliveryDate: '', clientName: '', clientLogoUrl: '', clientAddress: '' });
      load();
    } catch { toast.error(t('error_creating_task')); }
    setSaving(false);
  };

  const filtered = tasks.filter((t) => !filterStatus || t.status === filterStatus);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      {/* MOD 8a: print recap modal */}
      {showPrintRecap && <PrintRecapModal users={users} onClose={() => setShowPrintRecap(false)} />}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">
            {isLivreur ? t('my_tasks') : t('delivery_tasks')}
          </h1>
          <p className="text-slate-500 text-sm mt-1">{tasks.length} {t('tasks_count')}</p>
        </div>
        <div className="flex gap-2">
          {/* MOD 8a: admin print recap button */}
          {isAdmin && (
            <button onClick={() => setShowPrintRecap(true)} className="btn-secondary">
              <Printer size={16} /> Imprimer récap livreur
            </button>
          )}
          {!isLivreur && (
            <button onClick={() => setShowNew(!showNew)} className="btn-primary">
              <Plus size={18} /> {t('new_task')}
            </button>
          )}
        </div>
      </div>

      {/* Livreur stats */}
      {isLivreur && stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 text-center"><div className="text-2xl font-display font-700 text-slate-900">{stats.total}</div><div className="text-xs text-slate-500 mt-1">{t('total')}</div></div>
          <div className="card p-4 text-center"><div className="text-2xl font-display font-700 text-emerald-600">{stats.completed}</div><div className="text-xs text-slate-500 mt-1">{t('completed_tasks')}</div></div>
          <div className="card p-4 text-center"><div className="text-lg font-display font-700 text-brand-600">{Number(stats.totalEarned).toLocaleString('fr-FR')}</div><div className="text-xs text-slate-500 mt-1">DZD {t('earned')}</div></div>
        </div>
      )}

      {/* New task form */}
      {showNew && (
        <div className="card p-6 mb-6 animate-slide-up border-2 border-brand-100">
          <h3 className="font-display font-600 text-slate-900 mb-4">{t('new_task')}</h3>
          <form onSubmit={createTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">{t('client')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
              {newTask.clientName ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg w-fit">
                  <ClientLogo name={newTask.clientName} logoUrl={newTask.clientLogoUrl} size="sm" />
                  <span className="text-sm font-medium text-brand-700">{newTask.clientName}</span>
                  <button type="button" onClick={clearClient} className="text-brand-400 hover:text-brand-600 ml-1"><X size={13} /></button>
                </div>
              ) : (
                <>
                  {clients.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2 max-h-32 overflow-y-auto p-1">
                      {clients.map((c: any) => (
                        <button key={c.clientId || c.clientName} type="button" onClick={() => pickClient(c)}
                          className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 rounded-lg transition-all text-sm">
                          <ClientLogo name={c.clientName} logoUrl={c.clientLogoUrl} size="sm" />
                          <span className="text-slate-700 font-medium">{c.clientName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <input className="input" value={newTask.clientName} onChange={(e) => setNewTask((p) => ({ ...p, clientName: e.target.value }))} placeholder={t('client_name_placeholder')} />
                </>
              )}
            </div>
            <div className="md:col-span-2">
              <label className="label">{t('task_name')} <span className="text-red-500">*</span></label>
              <input className="input" required value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder={t('task_name_placeholder')} />
            </div>
            <div>
              <label className="label">{t('description')}</label>
              <input className="input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('price')} (DZD) <span className="text-red-500">*</span></label>
              <input className="input" type="number" min={0} required value={newTask.price} onChange={(e) => setNewTask({ ...newTask, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">{t('assign_to')} <span className="text-red-500">*</span></label>
              <select className="input" required value={newTask.assignedToId} onChange={(e) => setNewTask({ ...newTask, assignedToId: e.target.value })}>
                <option value="">{t('choose_delivery_person')}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">{t('due_date')}</label>
              <input type="date" className="input" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">{t('delivery_date')} <span className="text-slate-400 font-normal">({t('optional')})</span></label>
              <input type="date" className="input" value={newTask.deliveryDate} onChange={(e) => setNewTask({ ...newTask, deliveryDate: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">{t('cancel')}</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> {t('create')}</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {(['', 'en_attente', 'terminee', 'non_terminee'] as const).map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filterStatus === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-300')}>
            {s === '' ? t('all_tasks') : statusConfig[s].label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 && <div className="card p-12 text-center text-slate-400">{t('no_tasks')}</div>}
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={load} isLivreur={isLivreur} isAdmin={isAdmin} t={t} companyName="Mon Entreprise" />
          ))}
        </div>
      )}
    </div>
  );
}
