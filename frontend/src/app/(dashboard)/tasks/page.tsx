'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getCachedTasks, cacheTasks } from '@/lib/offlineDB';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import {
  Plus, CheckCircle, XCircle, Clock, Loader2,
  Edit2, Save, X, MapPin, Calendar,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  en_attente:   { label: 'En attente',   color: 'bg-amber-100 text-amber-700',   icon: Clock },
  terminee:     { label: 'Terminée',     color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  non_terminee: { label: 'Non terminée', color: 'bg-red-100 text-red-600',        icon: XCircle },
};

// Resolve logo URL
function logoSrc(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

// Client logo or colored initial
function ClientLogo({ name, logoUrl, size = 'md' }: { name?: string; logoUrl?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const src = logoSrc(logoUrl);
  const sizeClass = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-16 h-16 text-lg' }[size];
  const colors = [
    'bg-blue-100 text-blue-700', 'bg-purple-100 text-purple-700',
    'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-700',
    'bg-red-100 text-red-700', 'bg-indigo-100 text-indigo-700',
  ];
  const color = colors[((name || '').charCodeAt(0) || 0) % colors.length];

  if (src) {
    return (
      <div className={clsx('rounded-xl overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center', sizeClass)}>
        <img src={src} alt={name || ''} className="w-full h-full object-contain"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      </div>
    );
  }
  if (!name) return null;
  return (
    <div className={clsx('rounded-xl flex items-center justify-center font-700 uppercase shrink-0', sizeClass, color)}>
      {name.charAt(0)}
    </div>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────
function TaskCard({ task, onUpdate, isLivreur }: any) {
  const [editing, setEditing] = useState(false);
  const [remarks, setRemarks] = useState(task.remarks || '');
  const [saving, setSaving] = useState(false);

  const updateStatus = async (status: string) => {
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, { status });
      onUpdate();
      toast.success('Statut mis à jour');
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const saveRemarks = async () => {
    setSaving(true);
    try {
      await api.put(`/tasks/${task.id}`, { remarks });
      setEditing(false);
      onUpdate();
      toast.success('Remarque enregistrée');
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const { icon: StatusIcon, color, label } = statusConfig[task.status] || statusConfig.en_attente;
  const hasClient = task.clientName || task.clientLogoUrl;

  return (
    <div className={clsx(
      'card overflow-hidden animate-slide-up transition-all',
      task.status === 'terminee' && 'opacity-75',
    )}>
      {/* Client logo banner — visible pour le livreur */}
      {isLivreur && hasClient && (
        <div className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-slate-100 bg-slate-50/60">
          <ClientLogo name={task.clientName} logoUrl={task.clientLogoUrl} size="md" />
          <div className="min-w-0">
            <p className="text-xs text-slate-400 uppercase tracking-wide font-600">Client</p>
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
        {/* Task header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* For admin: show client logo small next to task name */}
              {!isLivreur && hasClient && (
                <ClientLogo name={task.clientName} logoUrl={task.clientLogoUrl} size="sm" />
              )}
              <h3 className="font-display font-600 text-slate-900">{task.name}</h3>
            </div>
            {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
            {!isLivreur && task.clientName && (
              <p className="text-xs text-slate-400 mt-1">🏢 {task.clientName}</p>
            )}
            {!isLivreur && task.assignedTo && (
              <p className="text-xs text-slate-400 mt-0.5">👤 {task.assignedTo.name}</p>
            )}
          </div>

          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={clsx('badge flex items-center gap-1', color)}>
              <StatusIcon size={11} />{label}
            </span>
            <span className="font-display font-700 text-brand-600 text-sm">
              {Number(task.price).toLocaleString('fr-FR')} DZD
            </span>
          </div>
        </div>

        {/* Dates */}
        {(task.dueDate || task.deliveryDate) && (
          <div className="flex flex-wrap gap-3 mb-3 text-xs text-slate-500">
            {task.dueDate && (
              <span className="flex items-center gap-1">
                <Calendar size={11} /> Limite : {new Date(task.dueDate).toLocaleDateString('fr-FR')}
              </span>
            )}
            {task.deliveryDate && (
              <span className="flex items-center gap-1">
                <Calendar size={11} className="text-brand-400" /> Livraison : {new Date(task.deliveryDate).toLocaleDateString('fr-FR')}
              </span>
            )}
          </div>
        )}

        {/* Status buttons — livreur only */}
        {isLivreur && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => updateStatus('terminee')}
              disabled={task.status === 'terminee' || saving}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                task.status === 'terminee'
                  ? 'bg-emerald-500 text-white cursor-default shadow-sm'
                  : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200',
              )}
            >
              <CheckCircle size={15} /> Terminée
            </button>
            <button
              onClick={() => updateStatus('non_terminee')}
              disabled={task.status === 'non_terminee' || saving}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all',
                task.status === 'non_terminee'
                  ? 'bg-red-500 text-white cursor-default shadow-sm'
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200',
              )}
            >
              <XCircle size={15} /> Non terminée
            </button>
          </div>
        )}

        {/* Remarks */}
        <div className="pt-3 border-t border-slate-100">
          {editing ? (
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Ajouter une remarque…"
                autoFocus
              />
              <button onClick={saveRemarks} disabled={saving}
                className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700">
                <Save size={15} />
              </button>
              <button onClick={() => setEditing(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-slate-500 flex-1 italic">
                {task.remarks || 'Aucune remarque'}
              </p>
              <button onClick={() => setEditing(true)}
                className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 rounded">
                <Edit2 size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
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

  const load = async () => {
    try {
      const t = await api.get('/tasks');
      setTasks(t.data);
      await cacheTasks(t.data);
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
      if (cached.length) { setTasks(cached); toast('Mode hors-ligne', { icon: '📶' }); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // When admin picks a client in task form
  const pickClient = (c: any) => {
    setNewTask((p) => ({
      ...p,
      clientName: c.clientName || '',
      clientLogoUrl: c.clientLogoUrl || '',
      clientAddress: c.clientAddress || '',
    }));
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tasks', newTask);
      toast.success('Tâche créée');
      setShowNew(false);
      setNewTask({ name: '', description: '', price: 0, assignedToId: '', dueDate: '', deliveryDate: '', clientName: '', clientLogoUrl: '', clientAddress: '' });
      load();
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const filtered = tasks.filter((t) => !filterStatus || t.status === filterStatus);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">
            {isLivreur ? 'Mes Tâches' : 'Tâches de livraison'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''}
          </p>
        </div>
        {!isLivreur && (
          <button onClick={() => setShowNew(!showNew)} className="btn-primary">
            <Plus size={18} /> Nouvelle tâche
          </button>
        )}
      </div>

      {/* Livreur stats */}
      {isLivreur && stats && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 text-center">
            <div className="text-2xl font-display font-700 text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-500 mt-1">Total</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-2xl font-display font-700 text-emerald-600">{stats.completed}</div>
            <div className="text-xs text-slate-500 mt-1">Terminées</div>
          </div>
          <div className="card p-4 text-center">
            <div className="text-lg font-display font-700 text-brand-600">
              {Number(stats.totalEarned).toLocaleString('fr-FR')}
            </div>
            <div className="text-xs text-slate-500 mt-1">DZD gagné</div>
          </div>
        </div>
      )}

      {/* New task form (admin) */}
      {showNew && (
        <div className="card p-6 mb-6 animate-slide-up border-2 border-brand-100">
          <h3 className="font-display font-600 text-slate-900 mb-4">Nouvelle tâche</h3>
          <form onSubmit={createTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Client picker with logo */}
            <div className="md:col-span-2">
              <label className="label">Client (optionnel)</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {/* Selected client display */}
                {newTask.clientName && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-lg">
                    <ClientLogo name={newTask.clientName} logoUrl={newTask.clientLogoUrl} size="sm" />
                    <span className="text-sm font-medium text-brand-700">{newTask.clientName}</span>
                    <button type="button" onClick={() => setNewTask((p) => ({ ...p, clientName: '', clientLogoUrl: '', clientAddress: '' }))}
                      className="text-brand-400 hover:text-brand-600 ml-1">
                      <X size={13} />
                    </button>
                  </div>
                )}
              </div>
              {!newTask.clientName && clients.length > 0 && (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
                  {clients.map((c: any) => (
                    <button key={c.clientId || c.clientName} type="button"
                      onClick={() => pickClient(c)}
                      className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 hover:border-brand-300 hover:bg-brand-50 rounded-lg transition-all text-sm">
                      <ClientLogo name={c.clientName} logoUrl={c.clientLogoUrl} size="sm" />
                      <span className="text-slate-700 font-medium">{c.clientName}</span>
                    </button>
                  ))}
                </div>
              )}
              {!newTask.clientName && (
                <input
                  className="input mt-2"
                  value={newTask.clientName}
                  onChange={(e) => setNewTask((p) => ({ ...p, clientName: e.target.value }))}
                  placeholder="Ou saisissez un nom de client manuellement"
                />
              )}
            </div>

            <div className="md:col-span-2">
              <label className="label">Nom de la tâche <span className="text-red-500">*</span></label>
              <input className="input" required value={newTask.name}
                onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                placeholder="Ex: Livraison RAM, Dépôt document…" />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Prix (DZD) <span className="text-red-500">*</span></label>
              <input className="input" type="number" min={0} required value={newTask.price}
                onChange={(e) => setNewTask({ ...newTask, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Assigner à <span className="text-red-500">*</span></label>
              <select className="input" required value={newTask.assignedToId}
                onChange={(e) => setNewTask({ ...newTask, assignedToId: e.target.value })}>
                <option value="">Choisir un livreur</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date limite</label>
              <input type="date" className="input" value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </div>
            <div>
              <label className="label">Date de livraison <span className="text-slate-400 font-normal">(optionnelle)</span></label>
              <input type="date" className="input" value={newTask.deliveryDate}
                onChange={(e) => setNewTask({ ...newTask, deliveryDate: e.target.value })} />
            </div>
            <div className="md:col-span-2 flex gap-3 justify-end">
              <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <><Plus size={16} /> Créer</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'en_attente', 'terminee', 'non_terminee'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filterStatus === s
                ? 'bg-brand-600 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-300',
            )}>
            {s === '' ? 'Toutes' : statusConfig[s]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 && (
            <div className="card p-12 text-center text-slate-400">Aucune tâche</div>
          )}
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={load} isLivreur={isLivreur} />
          ))}
        </div>
      )}
    </div>
  );
}