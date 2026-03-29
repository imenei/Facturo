'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { getCachedTasks, cacheTasks } from '@/lib/offlineDB';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, CheckCircle, XCircle, Clock, Loader2, DollarSign, Edit2, Save, X } from 'lucide-react';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  en_attente: { label: 'En attente', color: 'bg-amber-100 text-amber-700', icon: Clock },
  terminee: { label: 'Terminée', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  non_terminee: { label: 'Non terminée', color: 'bg-red-100 text-red-600', icon: XCircle },
};

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

  return (
    <div className="card p-5 animate-slide-up">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="font-display font-600 text-slate-900">{task.name}</h3>
          {task.description && <p className="text-sm text-slate-500 mt-0.5">{task.description}</p>}
          {task.assignedTo && !isLivreur && (
            <p className="text-xs text-slate-400 mt-1">👤 {task.assignedTo.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="font-display font-700 text-brand-600">{Number(task.price).toLocaleString('fr-DZ')} DZD</div>
          </div>
          <span className={clsx('badge', color)}><StatusIcon size={12} className="mr-1" />{label}</span>
        </div>
      </div>

      {/* Status actions for livreur */}
      {isLivreur && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => updateStatus('terminee')} disabled={task.status === 'terminee' || saving} className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all', task.status === 'terminee' ? 'bg-emerald-100 text-emerald-700 cursor-default' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100')}>
            <CheckCircle size={15} /> Terminée
          </button>
          <button onClick={() => updateStatus('non_terminee')} disabled={task.status === 'non_terminee' || saving} className={clsx('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all', task.status === 'non_terminee' ? 'bg-red-100 text-red-700 cursor-default' : 'bg-red-50 text-red-600 hover:bg-red-100')}>
            <XCircle size={15} /> Non terminée
          </button>
        </div>
      )}

      {/* Remarks */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {editing ? (
          <div className="flex gap-2">
            <input className="input flex-1 text-sm" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Ajouter une remarque…" autoFocus />
            <button onClick={saveRemarks} disabled={saving} className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700"><Save size={15} /></button>
            <button onClick={() => setEditing(false)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"><X size={15} /></button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-sm text-slate-500 flex-1 italic">{task.remarks || 'Aucune remarque'}</p>
            <button onClick={() => setEditing(true)} className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-slate-100 rounded"><Edit2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [newTask, setNewTask] = useState({ name: '', description: '', price: 0, assignedToId: '', dueDate: '' });
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
        const u = await api.get('/users?role=livreur');
        setUsers(u.data);
      }
    } catch {
      const cached = await getCachedTasks();
      if (cached.length) { setTasks(cached); toast('Mode hors-ligne', { icon: '📶' }); }
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/tasks', newTask);
      toast.success('Tâche créée');
      setShowNew(false);
      setNewTask({ name: '', description: '', price: 0, assignedToId: '', dueDate: '' });
      load();
    } catch { toast.error('Erreur'); }
    setSaving(false);
  };

  const filtered = tasks.filter((t) => !filterStatus || t.status === filterStatus);

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{isLivreur ? 'Mes Tâches' : 'Tâches de livraison'}</h1>
          <p className="text-slate-500 text-sm mt-1">{tasks.length} tâche{tasks.length > 1 ? 's' : ''}</p>
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
            <div className="text-lg font-display font-700 text-brand-600">{Number(stats.totalEarned).toLocaleString('fr-DZ')}</div>
            <div className="text-xs text-slate-500 mt-1">DZD gagné</div>
          </div>
        </div>
      )}

      {/* New task form */}
      {showNew && (
        <div className="card p-6 mb-6 animate-slide-up border-2 border-brand-100">
          <h3 className="font-display font-600 text-slate-900 mb-4">Nouvelle tâche</h3>
          <form onSubmit={createTask} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nom de la tâche <span className="text-red-500">*</span></label>
              <input className="input" required value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="Ex: Livraison RAM, Dépôt document…" />
            </div>
            <div>
              <label className="label">Description</label>
              <input className="input" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} />
            </div>
            <div>
              <label className="label">Prix (DZD) <span className="text-red-500">*</span></label>
              <input className="input" type="number" min={0} required value={newTask.price} onChange={(e) => setNewTask({ ...newTask, price: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Assigner à <span className="text-red-500">*</span></label>
              <select className="input" required value={newTask.assignedToId} onChange={(e) => setNewTask({ ...newTask, assignedToId: e.target.value })}>
                <option value="">Choisir un livreur</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date limite</label>
              <input type="date" className="input" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
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

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'en_attente', 'terminee', 'non_terminee'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)} className={clsx('px-3 py-1.5 rounded-lg text-sm font-medium transition-all', filterStatus === s ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-brand-300')}>
            {s === '' ? 'Toutes' : statusConfig[s]?.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="space-y-4">
          {filtered.length === 0 && <div className="card p-12 text-center text-slate-400">Aucune tâche</div>}
          {filtered.map((task) => (
            <TaskCard key={task.id} task={task} onUpdate={load} isLivreur={isLivreur} />
          ))}
        </div>
      )}
    </div>
  );
}
