'use client';
// frontend/src/app/(dashboard)/interventions/[id]/page.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  ArrowLeft, Play, Pause, CheckCircle, XCircle, Clock,
  Loader2, Camera, PenLine, Plus, Trash2, Save,
  Timer, Wrench, User, Monitor, CalendarDays, FileText,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import Link from 'next/link';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  en_attente:   { label: 'En attente',   color: 'bg-amber-100 text-amber-700',    icon: Clock },
  en_cours:     { label: 'En cours',     color: 'bg-blue-100 text-blue-700',      icon: Play },
  en_pause:     { label: 'En pause',     color: 'bg-slate-100 text-slate-600',    icon: Pause },
  terminee:     { label: 'Terminée',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  non_reparee:  { label: 'Non réparée',  color: 'bg-red-100 text-red-600',        icon: XCircle },
};

// Format seconds → "1h 23m 45s"
function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

// ─── Signature pad component ──────────────────────────────────────────────────

function SignaturePad({ onSave, onCancel }: { onSave: (b64: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getPos = (e: any, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const start = (e: any) => {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e, canvas);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasStrokes(true);
  };

  const stop = (e: any) => { e.preventDefault(); drawing.current = false; };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  };

  const save = () => {
    const b64 = canvasRef.current!.toDataURL('image/png');
    onSave(b64);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-display font-700 text-slate-900">Signature du client</h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600"><XCircle size={20} /></button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500 mb-3 text-center">Le client signe ici pour confirmer la réparation</p>
          <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50">
            <canvas
              ref={canvasRef}
              width={400}
              height={160}
              className="w-full touch-none cursor-crosshair"
              onMouseDown={start}
              onMouseMove={draw}
              onMouseUp={stop}
              onMouseLeave={stop}
              onTouchStart={start}
              onTouchMove={draw}
              onTouchEnd={stop}
            />
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={clear} className="btn-secondary flex-1 justify-center">Effacer</button>
            <button onClick={save} disabled={!hasStrokes} className="btn-primary flex-1 justify-center">
              <PenLine size={15} /> Valider la signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Timer component ──────────────────────────────────────────────────────────

function InterventionTimer({
  isRunning,
  savedMinutes,
  startedAt,
  onStart,
  onPause,
}: {
  isRunning: boolean;
  savedMinutes: number;
  startedAt?: string;
  onStart: () => void;
  onPause: (minutes: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isRunning && startedAt) {
      const base = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsed(base);
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, startedAt]);

  const totalSeconds = elapsed + savedMinutes * 60;

  const handlePause = () => {
    const sessionMinutes = Math.ceil(elapsed / 60);
    onPause(sessionMinutes);
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <Timer size={18} className="text-brand-500" />
        <h3 className="font-display font-600 text-slate-900">Temps de travail</h3>
      </div>

      <div className="text-4xl font-mono font-700 text-slate-900 text-center py-4">
        {formatTime(totalSeconds)}
      </div>
      <div className="text-xs text-center text-slate-400 mb-4">
        Déjà enregistré : {savedMinutes} min · Cette session : {Math.ceil(elapsed / 60)} min
      </div>

      {isRunning ? (
        <button onClick={handlePause} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 transition-colors">
          <Pause size={18} /> Mettre en pause
        </button>
      ) : (
        <button onClick={onStart} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand-600 text-white font-medium hover:bg-brand-700 transition-colors">
          <Play size={18} /> Démarrer / Reprendre
        </button>
      )}
    </div>
  );
}

// ─── Photo gallery ────────────────────────────────────────────────────────────

function PhotoGallery({
  photos,
  onAdd,
  onRemove,
  readonly,
}: {
  photos: string[];
  onAdd: (b64: string) => void;
  onRemove: (i: number) => void;
  readonly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onAdd(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 mb-2">
        {photos.map((p, i) => (
          <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200">
            <img src={p} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            {!readonly && (
              <button onClick={() => onRemove(i)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
        {!readonly && (
          <button onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-slate-300 hover:border-brand-400 hover:bg-brand-50 flex flex-col items-center justify-center gap-1 transition-all text-slate-400 hover:text-brand-500">
            <Camera size={20} />
            <span className="text-xs">Photo</span>
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
    </div>
  );
}

// ─── Materials editor ─────────────────────────────────────────────────────────

function MaterialsEditor({ materials, onChange }: { materials: any[]; onChange: (m: any[]) => void }) {
  const add = () => onChange([...materials, { name: '', quantity: 1, unitPrice: 0, total: 0 }]);
  const remove = (i: number) => onChange(materials.filter((_, idx) => idx !== i));
  const update = (i: number, field: string, val: any) => {
    const updated = materials.map((m, idx) => {
      if (idx !== i) return m;
      const nm = { ...m, [field]: val };
      nm.total = Number(nm.quantity) * Number(nm.unitPrice);
      return nm;
    });
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {materials.map((m, i) => (
        <div key={i} className="grid grid-cols-12 gap-1.5 items-center bg-slate-50 rounded-lg p-2">
          <div className="col-span-5"><input className="input bg-white text-sm" placeholder="Pièce…" value={m.name} onChange={e => update(i, 'name', e.target.value)} /></div>
          <div className="col-span-2"><input className="input bg-white text-sm text-center" type="number" min={1} value={m.quantity} onChange={e => update(i, 'quantity', Number(e.target.value))} /></div>
          <div className="col-span-3"><input className="input bg-white text-sm text-right" type="number" min={0} step="0.01" value={m.unitPrice} onChange={e => update(i, 'unitPrice', Number(e.target.value))} /></div>
          <div className="col-span-1 text-xs text-slate-400 text-right">{(Number(m.quantity) * Number(m.unitPrice)).toLocaleString('fr-FR')}</div>
          <div className="col-span-1 flex justify-center">
            <button type="button" onClick={() => remove(i)} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs flex items-center gap-1 text-brand-600 hover:underline mt-1">
        <Plus size={12} /> Ajouter une pièce
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function InterventionWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isTech = user?.role === 'technicien';
  const isAdmin = user?.role === 'admin';

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  // Report state
  const [diagnosis, setDiagnosis] = useState('');
  const [actions, setActions] = useState('');
  const [remarks, setRemarks] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [laborCost, setLaborCost] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [showReport, setShowReport] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/interventions/${id}`);
      setItem(data);
      setDiagnosis(data.technicalDiagnosis || '');
      setActions(data.actionsPerformed || '');
      setRemarks(data.remarks || '');
      setMaterials(data.materialsUsed || []);
      setLaborCost(Number(data.laborCost) || 0);
      setPhotos(data.photos || []);
      // Auto-open report if in progress
      if (['en_cours', 'en_pause'].includes(data.status)) setShowReport(true);
    } catch { toast.error('Erreur chargement'); }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Timer actions
  const handleStart = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/interventions/${id}/start`);
      setItem(data);
      setShowReport(true);
      toast.success('Intervention démarrée !');
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const handlePause = async (sessionMinutes: number) => {
    setSaving(true);
    try {
      // Auto-save report when pausing
      await api.put(`/interventions/${id}`, {
        technicalDiagnosis: diagnosis,
        actionsPerformed: actions,
        remarks,
        materialsUsed: materials,
        laborCost,
        photos,
      });
      const { data } = await api.patch(`/interventions/${id}/pause`, { workedMinutes: sessionMinutes });
      setItem(data);
      toast('Mis en pause — rapport sauvegardé', { icon: '⏸️' });
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  // Save report draft
  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await api.put(`/interventions/${id}`, {
        technicalDiagnosis: diagnosis,
        actionsPerformed: actions,
        remarks,
        materialsUsed: materials,
        laborCost,
        photos,
      });
      toast.success('Rapport sauvegardé');
      load();
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  // Finish intervention
  const handleFinish = async (signature?: string) => {
    setSaving(true);
    try {
      await api.patch(`/interventions/${id}/finish`, {
        technicalDiagnosis: diagnosis,
        actionsPerformed: actions,
        remarks,
        materialsUsed: materials,
        laborCost,
        photos,
        clientSignature: signature,
        workedMinutes: 0,
      });
      toast.success('Intervention terminée ! ✅');
      router.push('/interventions');
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const handleMarkNonRepaired = async () => {
    if (!confirm('Marquer comme non réparée ?')) return;
    setSaving(true);
    try {
      await api.put(`/interventions/${id}`, { status: 'non_reparee' });
      toast('Marquée non réparée', { icon: '❌' });
      router.push('/interventions');
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const addPhoto = async (b64: string) => {
    const newPhotos = [...photos, b64];
    setPhotos(newPhotos);
    try { await api.patch(`/interventions/${id}/photo`, { photo: b64 }); }
    catch { toast.error('Erreur sauvegarde photo'); }
  };

  const removePhoto = (i: number) => setPhotos(p => p.filter((_, idx) => idx !== i));

  const saveSignature = async (b64: string) => {
    setShowSignature(false);
    try {
      await api.patch(`/interventions/${id}/signature`, { signature: b64 });
      toast.success('Signature enregistrée');
      handleFinish(b64);
    } catch { toast.error('Erreur signature'); }
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>;
  if (!item) return <div className="p-8 text-slate-500">Intervention introuvable</div>;

  const { icon: StatusIcon, color: statusColor, label: statusLabel } = STATUS_CONFIG[item.status] || STATUS_CONFIG.en_attente;
  const isRunning = item.status === 'en_cours';
  const isEditable = isTech && ['en_attente', 'en_cours', 'en_pause'].includes(item.status);
  const isDone = item.status === 'terminee' || item.status === 'non_reparee';

  const partsCost = materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unitPrice), 0);
  const totalPrice = laborCost + partsCost;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto animate-fade-in">

      {showSignature && <SignaturePad onSave={saveSignature} onCancel={() => setShowSignature(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/interventions" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-display font-700 text-slate-900">{item.ticketNumber}</h1>
              <span className={clsx('badge flex items-center gap-1', statusColor)}>
                <StatusIcon size={11} />{statusLabel}
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">
              {item.machineName} {item.machineBrand && `· ${item.machineBrand}`}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Link href={`/interventions/${id}/edit`} className="btn-secondary text-sm">Modifier</Link>
        )}
      </div>

      <div className="space-y-4">

        {/* Client + Machine info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <User size={14} className="text-slate-400" />
              <span className="text-xs font-600 text-slate-500 uppercase tracking-wide">Client</span>
            </div>
            <p className="font-display font-700 text-slate-900">{item.clientName}</p>
            {item.clientPhone && <p className="text-sm text-slate-500 mt-1">📞 {item.clientPhone}</p>}
            {item.clientAddress && <p className="text-sm text-slate-500">📍 {item.clientAddress}</p>}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <Monitor size={14} className="text-slate-400" />
              <span className="text-xs font-600 text-slate-500 uppercase tracking-wide">Machine</span>
            </div>
            <p className="font-display font-700 text-slate-900">{item.machineName}</p>
            {item.machineBrand && <p className="text-sm text-slate-500 mt-0.5">{item.machineBrand} {item.machineModel}</p>}
            {item.serialNumber && (
              <p className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded mt-1 w-fit">
                SN : {item.serialNumber}
              </p>
            )}
          </div>
        </div>

        {/* Client description of problem */}
        {item.clientDescription && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={14} className="text-amber-500" />
              <span className="text-xs font-600 text-slate-500 uppercase tracking-wide">Panne décrite par le client</span>
            </div>
            <p className="text-sm text-slate-700 bg-amber-50 border border-amber-100 rounded-lg p-3 leading-relaxed">
              {item.clientDescription}
            </p>
          </div>
        )}

        {/* Timer — technicien only, not done */}
        {isTech && !isDone && (
          <InterventionTimer
            isRunning={isRunning}
            savedMinutes={item.workedMinutes || 0}
            startedAt={item.startedAt}
            onStart={handleStart}
            onPause={handlePause}
          />
        )}

        {/* Time summary if done */}
        {isDone && item.workedMinutes > 0 && (
          <div className="card p-4 bg-slate-50">
            <div className="flex items-center gap-2 text-slate-600">
              <Timer size={16} />
              <span className="text-sm font-medium">
                Temps total : {Math.floor(item.workedMinutes / 60)}h {item.workedMinutes % 60}m
              </span>
              {item.startedAt && <span className="text-xs text-slate-400">· Démarré le {new Date(item.startedAt).toLocaleDateString('fr-FR')}</span>}
              {item.finishedAt && <span className="text-xs text-slate-400">· Terminé le {new Date(item.finishedAt).toLocaleDateString('fr-FR')}</span>}
            </div>
          </div>
        )}

        {/* Technical report — collapsible */}
        {(isTech || isAdmin) && (
          <div className="card overflow-hidden">
            <button
              onClick={() => setShowReport(!showReport)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Wrench size={16} className="text-brand-500" />
                <span className="font-display font-600 text-slate-900">Rapport technique</span>
                {(diagnosis || actions) && (
                  <span className="badge bg-brand-100 text-brand-600 text-xs">Renseigné</span>
                )}
              </div>
              {showReport ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
            </button>

            {showReport && (
              <div className="px-5 pb-5 space-y-4 border-t border-slate-100">

                <div className="pt-4">
                  <label className="label">Diagnostic technique</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={diagnosis}
                    onChange={e => setDiagnosis(e.target.value)}
                    readOnly={!isEditable && isDone}
                    placeholder="Cause réelle de la panne, analyse technique…"
                  />
                </div>

                <div>
                  <label className="label">Actions réalisées</label>
                  <textarea
                    className="input resize-none"
                    rows={3}
                    value={actions}
                    onChange={e => setActions(e.target.value)}
                    readOnly={!isEditable && isDone}
                    placeholder="Pièces remplacées, réglages effectués, tests réalisés…"
                  />
                </div>

                <div>
                  <label className="label">Remarques</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    readOnly={!isEditable && isDone}
                    placeholder="Recommandations, observations…"
                  />
                </div>

                {/* Materials */}
                <div>
                  <label className="label">Matériel utilisé</label>
                  {isEditable
                    ? <MaterialsEditor materials={materials} onChange={setMaterials} />
                    : materials.length > 0
                      ? (
                        <div className="space-y-1">
                          {materials.map((m, i) => (
                            <div key={i} className="flex justify-between text-sm text-slate-600 py-1 border-b border-slate-100">
                              <span>{m.name} × {m.quantity}</span>
                              <span className="font-medium">{Number(m.total).toLocaleString('fr-FR')} DZD</span>
                            </div>
                          ))}
                        </div>
                      )
                      : <p className="text-sm text-slate-400 italic">Aucun matériel</p>
                  }
                </div>

                {/* Pricing */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                  <div>
                    <label className="label">Main d'œuvre</label>
                    {isEditable
                      ? <div className="relative">
                          <input type="number" min={0} className="input pr-12" value={laborCost}
                            onChange={e => setLaborCost(Number(e.target.value))} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">DZD</span>
                        </div>
                      : <div className="input bg-slate-50 cursor-default">{Number(item.laborCost).toLocaleString('fr-FR')} DZD</div>
                    }
                  </div>
                  <div>
                    <label className="label text-slate-400">Pièces</label>
                    <div className="input bg-slate-50 text-slate-500 cursor-default">{partsCost.toLocaleString('fr-FR')} DZD</div>
                  </div>
                  <div className="card p-3 bg-brand-50 border-brand-200 flex flex-col justify-center">
                    <div className="text-xs text-brand-500 font-medium">TOTAL</div>
                    <div className="text-lg font-display font-700 text-brand-700">{totalPrice.toLocaleString('fr-FR')} DZD</div>
                  </div>
                </div>

                {/* Save draft */}
                {isEditable && (
                  <button onClick={handleSaveDraft} disabled={saving} className="btn-secondary w-full justify-center">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Sauvegarder le rapport</>}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Photos */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Camera size={16} className="text-slate-500" />
            <h3 className="font-display font-600 text-slate-900">Photos</h3>
            <span className="text-xs text-slate-400">({photos.length})</span>
          </div>
          <PhotoGallery
            photos={photos}
            onAdd={addPhoto}
            onRemove={removePhoto}
            readonly={isDone && !isTech}
          />
        </div>

        {/* Client signature */}
        {item.clientSignature && (
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <PenLine size={16} className="text-emerald-500" />
              <h3 className="font-display font-600 text-slate-900">Signature client</h3>
              {item.signedAt && (
                <span className="text-xs text-slate-400">le {new Date(item.signedAt).toLocaleDateString('fr-FR')}</span>
              )}
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <img src={item.clientSignature} alt="Signature client" className="max-h-24 mx-auto" />
            </div>
          </div>
        )}

        {/* Action buttons — technicien */}
        {isTech && !isDone && (
          <div className="space-y-3">
            {/* Finish with signature */}
            <button
              onClick={() => setShowSignature(true)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-emerald-600 text-white font-display font-600 text-base hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <><PenLine size={18} /> Terminer & Signature client</>}
            </button>

            {/* Finish without signature */}
            <button
              onClick={() => handleFinish()}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-700 text-white font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              <CheckCircle size={16} /> Terminer sans signature
            </button>

            {/* Mark non repaired */}
            <button
              onClick={handleMarkNonRepaired}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 transition-colors text-sm"
            >
              <XCircle size={15} /> Non réparable
            </button>
          </div>
        )}

        {/* Done summary */}
        {isDone && (
          <div className={clsx('card p-5 border-2', item.status === 'terminee' ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50')}>
            <div className="flex items-center gap-2">
              {item.status === 'terminee'
                ? <CheckCircle size={20} className="text-emerald-600" />
                : <XCircle size={20} className="text-red-500" />}
              <span className={clsx('font-display font-700', item.status === 'terminee' ? 'text-emerald-700' : 'text-red-600')}>
                {item.status === 'terminee' ? 'Intervention terminée' : 'Non réparée'}
              </span>
            </div>
            {item.actualExitDate && (
              <p className="text-sm text-slate-500 mt-1">
                Date de clôture : {new Date(item.actualExitDate).toLocaleDateString('fr-FR')}
              </p>
            )}
            <p className="text-lg font-700 text-slate-900 mt-2">
              Total : {Number(item.totalPrice).toLocaleString('fr-FR')} DZD
            </p>
          </div>
        )}
      </div>
    </div>
  );
}