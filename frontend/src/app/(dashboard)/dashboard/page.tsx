'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import { FileText, CheckSquare, Truck, DollarSign, TrendingUp, Clock, Loader2, Users, BarChart3, AlertCircle } from 'lucide-react';
import Link from 'next/link';

function StatCard({ icon: Icon, label, value, color, sub }: any) {
  return (
    <div className="card p-6 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={22} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-display font-700 text-slate-900 mt-0.5 truncate">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function WorkflowBadge({ step }: { step: string }) {
  const steps = ['commande', 'livraison', 'facturation', 'recouvrement'];
  const labels: Record<string, string> = { commande: 'Cmd', livraison: 'Liv', facturation: 'Fact', recouvrement: 'Recouv' };
  const currentIdx = steps.indexOf(step);
  return (
    <div className="flex items-center gap-0.5">
      {steps.map((s, i) => (
        <div key={s} className={`text-xs px-1.5 py-0.5 rounded font-medium ${i <= currentIdx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {labels[s]}
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [overview, setOverview] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'admin') {
          const [ov, inv, clients] = await Promise.all([
            api.get('/stats/overview'),
            api.get('/invoices', { params: { type: 'facture' } }),
            api.get('/stats/revenue-by-client'),
          ]);
          setOverview(ov.data);
          setRecentInvoices(inv.data.slice(0, 5));
          setTopClients(clients.data.slice(0, 4));
        } else if (user?.role === 'commercial') {
          const inv = await api.get('/invoices');
          setRecentInvoices(inv.data.slice(0, 5));
          const paid = inv.data.filter((i: any) => i.paymentStatus === 'paid').length;
          setOverview({ invoicesCount: { total: inv.data.length, paid } });
        } else if (user?.role === 'livreur') {
          const ts = await api.get('/tasks/my-stats');
          setTaskStats(ts.data);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 size={32} className="animate-spin text-brand-500" />
    </div>
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h1 className="text-3xl font-display font-700 text-slate-900">Bonjour, {user?.name?.split(' ')[0]} 👋</h1>
        <p className="text-slate-500 mt-1">Voici un aperçu de votre activité</p>
      </div>

      {user?.role === 'admin' && overview && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard icon={TrendingUp} label="Chiffre d'affaires" color="bg-brand-500"
              value={`${Number(overview.revenue?.totalRevenue || 0).toLocaleString('fr-DZ')} DZD`}
              sub={`${overview.revenue?.paidInvoicesCount || 0} facture(s) payée(s)`} />
            <StatCard icon={AlertCircle} label="Impayés" color="bg-red-500"
              value={`${Number(overview.revenue?.unpaidRevenue || 0).toLocaleString('fr-DZ')} DZD`}
              sub={`${overview.invoicesCount?.unpaid || 0} en attente`} />
            <StatCard icon={FileText} label="Total factures" color="bg-slate-600"
              value={overview.invoicesCount?.total || 0}
              sub={`${overview.invoicesCount?.draft || 0} brouillon(s)`} />
            <StatCard icon={CheckSquare} label="Livraisons" color="bg-emerald-500"
              value={`${overview.deliveries?.completed || 0} / ${overview.deliveries?.total || 0}`}
              sub={`Taux: ${overview.deliveries?.completionRate || 0}%`} />
          </div>

          {topClients.length > 0 && (
            <div className="card p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-brand-500" />
                <h2 className="font-display font-600 text-slate-900">CA par client</h2>
                <Link href="/clients" className="ml-auto text-sm text-brand-600 hover:underline">Voir tous →</Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {topClients.map((c: any) => (
                  <div key={c.clientId || c.clientName} className="bg-slate-50 rounded-lg p-3">
                    <div className="font-medium text-slate-900 text-sm truncate">{c.clientName}</div>
                    <div className="text-brand-600 font-700 mt-1">{Number(c.totalRevenue || 0).toLocaleString('fr-DZ')}</div>
                    <div className="text-xs text-slate-400">DZD · {c.invoiceCount} doc(s)</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {user?.role === 'commercial' && overview && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon={FileText} label="Mes factures" color="bg-brand-500" value={overview.invoicesCount?.total || 0} />
          <StatCard icon={CheckSquare} label="Payées" color="bg-emerald-500" value={overview.invoicesCount?.paid || 0} />
        </div>
      )}

      {user?.role === 'livreur' && taskStats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={CheckSquare} label="Total tâches" color="bg-brand-500" value={taskStats.total || 0} />
          <StatCard icon={CheckSquare} label="Terminées" color="bg-emerald-500" value={taskStats.completed || 0} />
          <StatCard icon={DollarSign} label="Total gagné" color="bg-purple-500"
            value={`${Number(taskStats.totalEarned || 0).toLocaleString('fr-DZ')} DZD`} />
        </div>
      )}

      {recentInvoices.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-600 text-slate-900">Dernières factures</h2>
            <Link href="/invoices" className="text-sm text-brand-600 hover:underline">Voir tout →</Link>
          </div>
          <div className="space-y-1">
            {recentInvoices.map((inv: any) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors gap-3 flex-wrap">
                <div>
                  <div className="font-mono text-sm font-medium text-slate-900">{inv.number}</div>
                  <div className="text-xs text-slate-500">{inv.clientName}</div>
                </div>
                <div className="flex items-center gap-3">
                  {inv.workflowStep && <WorkflowBadge step={inv.workflowStep} />}
                  <div className="text-right">
                    <div className="font-medium text-sm">{Number(inv.total).toLocaleString('fr-DZ')} DZD</div>
                    <span className={`text-xs font-medium ${inv.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {inv.paymentStatus === 'paid' ? '✓ Payée' : '○ Impayée'}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="font-display font-600 text-slate-900 mb-4">Actions rapides</h2>
        <div className="flex flex-wrap gap-3">
          {(user?.role === 'admin' || user?.role === 'commercial') && (
            <>
              <Link href="/invoices/new" className="btn-primary"><FileText size={16} /> Nouvelle facture</Link>
              <Link href="/invoices/new?type=proforma" className="btn-secondary"><FileText size={16} /> Proforma</Link>
              <Link href="/invoices/new?type=bon_livraison" className="btn-secondary"><Truck size={16} /> Bon livraison</Link>
              <Link href="/clients" className="btn-secondary"><Users size={16} /> Clients</Link>
            </>
          )}
          {user?.role === 'admin' && <Link href="/tasks" className="btn-secondary"><CheckSquare size={16} /> Tâches</Link>}
          {user?.role === 'commercial' && <Link href="/notifications" className="btn-secondary"><Clock size={16} /> Rappels impayés</Link>}
          {user?.role === 'livreur' && <Link href="/tasks" className="btn-primary"><CheckSquare size={16} /> Mes tâches</Link>}
        </div>
      </div>
    </div>
  );
}
