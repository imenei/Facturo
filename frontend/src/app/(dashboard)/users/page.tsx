'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Edit2, Trash2, Loader2, X, Save } from 'lucide-react';

const roleColors: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  commercial: 'bg-blue-100 text-blue-700',
  livreur: 'bg-emerald-100 text-emerald-700',
};

const emptyForm = { name: '', email: '', password: '', phone: '', role: 'commercial' as string };

export default function UsersPage() {
  const { t } = useI18nStore();
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
    } catch { toast.error(t('error_loading_users')); }
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
      toast.success(editUser ? t('user_updated') : t('user_created'));
      setShowForm(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('error_saving_user'));
    }
    setSaving(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${t('deactivate_user')} ${name} ?`)) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success(t('user_deactivated'));
      load();
    } catch { toast.error(t('error_deactivating_user')); }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">{t('users')}</h1>
          <p className="text-slate-500 text-sm mt-1">{users.length} {t('accounts_count')}</p>
        </div>
        <button onClick={openNew} className="btn-primary"><Plus size={18} /> {t('new_user')}</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-display font-700 text-slate-900">{editUser ? t('edit') : t('new')} {t('user')}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">{t('full_name')} <span className="text-red-500">*</span></label>
                <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('full_name_placeholder')} />
              </div>
              <div>
                <label className="label">{t('email')} <span className="text-red-500">*</span></label>
                <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="label">{editUser ? t('new_password_optional') : `${t('password')} *`}</label>
                <input className="input" type="password" required={!editUser} minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="........" />
              </div>
              <div>
                <label className="label">{t('phone')}</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+213 5XX XXX XXX" />
              </div>
              <div>
                <label className="label">{t('role')} <span className="text-red-500">*</span></label>
                <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="commercial">{t('commercial')}</option>
                  <option value="livreur">{t('delivery_person')}</option>
                  <option value="admin">{t('admin_manager')}</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">{t('cancel')}</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={16} /> {editUser ? t('save') : t('create')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <span className={clsx('badge text-xs', roleColors[u.role])}>{t(u.role)}</span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div>{u.email}</div>
                {u.phone && <div>{u.phone}</div>}
                <div className="flex items-center gap-2">
                  <div className={clsx('w-1.5 h-1.5 rounded-full', u.isActive ? 'bg-emerald-400' : 'bg-slate-300')} />
                  {u.isActive ? t('active') : t('deactivated')}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}