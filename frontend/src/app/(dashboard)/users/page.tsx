'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useI18nStore } from '@/store/i18nStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { Plus, Edit2, Trash2, Loader2, X, Save, Eye, EyeOff, UserX } from 'lucide-react';

const roleColors: Record<string, string> = {
  admin:       'bg-red-100 text-red-700',
  commercial:  'bg-blue-100 text-blue-700',
  livreur:     'bg-emerald-100 text-emerald-700',
  technicien:  'bg-purple-100 text-purple-700',
};

const emptyForm = {
  name: '', email: '', password: '', phone: '',
  role: 'commercial' as string,
  specialty: '',
  isActive: true,
};

export default function UsersPage() {
  const { t } = useI18nStore();
  const router = useRouter();
  const currentUser = useAuthStore((s) => s.user);
  const updateCurrentUser = useAuthStore((s) => s.updateUser);
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/invoices');
    }
  }, [currentUser, router]);
  const [editUser, setEditUser] = useState<any>(null);
  const [form, setForm]       = useState({ ...emptyForm });
  const [saving, setSaving]   = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/users?_=${Date.now()}`);
      setUsers(data);
    } catch { toast.error(t('error_loading_users')); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew  = () => {
    setEditUser(null);
    setForm({ ...emptyForm });
    setShowPassword(false);
    setShowForm(true);
  };
  const openEdit = (u: any) => {
    setEditUser(u);
    setForm({ name: u.name, email: u.email, password: '', phone: u.phone || '', role: u.role, specialty: u.specialty || '', isActive: u.isActive ?? true });
    setShowPassword(false);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: any = { ...form };
      if (editUser && !payload.password) delete payload.password;
      if (payload.role !== 'technicien')  delete payload.specialty;
      let saved: any;
      if (editUser) {
        const { data } = await api.put(`/users/${editUser.id}`, payload);
        saved = data;
        setUsers((prev) => prev.map((u) => (u.id === editUser.id ? { ...u, ...saved } : u)));
        if (currentUser && currentUser.id === editUser.id) {
          updateCurrentUser({
            name: saved.name,
            email: saved.email,
            phone: saved.phone,
            role: saved.role,
            specialty: saved.specialty,
            isActive: saved.isActive,
          });
        }
      } else {
        const { data } = await api.post('/users', payload);
        saved = data;
        setUsers((prev) => [...prev, saved]);
      }
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
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, isActive: false } : u));
    } catch { toast.error(t('error_deactivating_user')); }
  };

  const handleDeleteForever = async (id: string, name: string) => {
    if (!confirm(`⚠️ Supprimer définitivement "${name}" ? Cette action est irréversible et supprimera l'utilisateur de la base de données.`)) return;
    try {
      await api.delete(`/users/${id}/forever`);
      toast.success('Utilisateur supprimé définitivement');
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch { toast.error('Erreur lors de la suppression définitive'); }
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
              <h2 className="font-display font-700 text-slate-900">
                {editUser ? t('edit') : t('new')} {t('user')}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label">{t('full_name')} <span className="text-red-500">*</span></label>
                <input className="input" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t('full_name_placeholder')} />
              </div>
              <div>
                <label className="label">{t('email')} <span className="text-red-500">*</span></label>
                <input className="input" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemple.com" />
              </div>
              <div>
                <label className="label">
                  {editUser ? t('new_password_optional') : `${t('password')} *`}
                </label>
                <div className="relative">
                  <input className="input pr-10" type={showPassword ? 'text' : 'password'} required={!editUser} minLength={6}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="........" />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? t('hide_password') : t('show_password')}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">{t('phone')}</label>
                <input className="input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+213 5XX XXX XXX" />
              </div>
              <div>
                <label className="label">{t('role')} <span className="text-red-500">*</span></label>
                <select className="input" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value, specialty: '' })}>
                  <option value="commercial">{t('commercial')}</option>
                  <option value="livreur">{t('delivery_person')}</option>
                  <option value="technicien">{t('technician')}</option>
                  <option value="admin">{t('admin_manager')}</option>
                </select>
              </div>

              {form.role === 'technicien' && (
                <div>
                  <label className="label">{t('specialty')}</label>
                  <input className="input" value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder={t('specialty_placeholder')} />
                </div>
              )}

              {editUser && (
                <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer">
                  <span className="text-sm text-slate-700">{t('account_active')}</span>
                  <span className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <span
                      onClick={() => setForm({ ...form, isActive: !form.isActive })}
                      className={clsx(
                        'w-10 h-5 rounded-full transition-colors relative',
                        form.isActive ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                    >
                      <span
                        className={clsx(
                          'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                          form.isActive && 'translate-x-5',
                        )}
                      />
                    </span>
                  </span>
                </label>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1 justify-center">
                  {t('cancel')}
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving
                    ? <Loader2 size={16} className="animate-spin" />
                    : <><Save size={16} /> {editUser ? t('save') : t('create')}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-brand-500" />
        </div>
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
                    <span className={clsx('badge text-xs', roleColors[u.role] ?? 'bg-slate-100 text-slate-600')}>
                      {u.role === 'technicien' ? t('technician') : t(u.role)}
                    </span>
                    {u.role === 'technicien' && u.specialty && (
                      <p className="text-xs text-purple-500 mt-0.5">{u.specialty}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-brand-600 transition-colors" title="Modifier">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 hover:bg-amber-50 rounded text-slate-400 hover:text-amber-500 transition-colors" title="Désactiver">
                    <UserX size={14} />
                  </button>
                  <button onClick={() => handleDeleteForever(u.id, u.name)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-600 transition-colors" title="Supprimer définitivement">
                    <Trash2 size={14} />
                  </button>
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
