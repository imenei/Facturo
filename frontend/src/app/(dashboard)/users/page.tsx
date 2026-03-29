'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Edit2, Trash2, Loader2, User, Mail, Phone, Shield, X, Save } from 'lucide-react';

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  commercial: 'bg-blue-100 text-blue-700',
  livreur: 'bg-emerald-100 text-emerald-700',
};

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'commercial' as string };

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get('/users');
      setUsers(data);
    } catch { toast.error('Erreur chargement'); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditUser(null); setForm({ ...emptyForm }); setShowForm(true); };
  const openEdit = (u: any) => { setEditUser(u); setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role }); setShowForm(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editUser && !payload.password) delete (payload as any).password;
      if (editUser) await api.put(`/users/${editUser.id}`, payload);
      else await api.post('/users', payload);
      toast.success(editUser ? 'Utilisateur modifié' : 'Utilisateur créé');
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Erreur');
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Désactiver ${name} ?`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('Utilisateur désactivé');
      load();
    } catch { toast.error('Erreur'); }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">Utilisateurs</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} compte{users.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> Nouvel utilisateur</button>
      </div>

      {/* Modal form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-display font-700 text-slate-900">{editUser ? 'Modifier' : 'Nouvel'} utilisateur</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">Nom complet <span className="text-red-500">*</span></label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prénom Nom" />
              </div>
              <div>
                <label className="label">Email <span className="text-red-500">*</span></label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="label">{editUser ? 'Nouveau mot de passe (laisser vide = inchangé)' : 'Mot de passe *'}</label>
                <input className="input" type="password" required={!editUser} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
              </div>
              <div>
                <label className="label">Téléphone</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+213 5XX XXX XXX" />
              </div>
              <div>
                <label className="label">Rôle <span className="text-red-500">*</span></label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="commercial">Commercial</option>
                  <option value="livreur">Livreur</option>
                  <option value="admin">Admin / Gérant</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {editUser ? 'Enregistrer' : 'Créer'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users grid */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-brand-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => (
            <div key={u.id} className={clsx('card p-5 transition-all hover:shadow-md', !u.isActive && 'opacity-50')}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center font-700 text-brand-700 uppercase text-sm">
                    {u.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-600 text-slate-900 text-sm">{u.name}</p>
                    <span className={clsx('badge text-xs', roleColors[u.role])}>{u.role}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-2"><Mail size={12} />{u.email}</div>
                {u.phone && <div className="flex items-center gap-2"><Phone size={12} />{u.phone}</div>}
                <div className="flex items-center gap-2">
                  <div className={clsx('w-1.5 h-1.5 rounded-full', u.isActive ? 'bg-emerald-400' : 'bg-slate-300')} />
                  {u.isActive ? 'Actif' : 'Désactivé'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
