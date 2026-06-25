'use client';
import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useI18nStore } from '@/store/i18nStore';
import api from '@/lib/api';
import {
  FileText, CheckSquare, Truck, DollarSign, TrendingUp,
  Clock, Loader2, Users, BarChart3, AlertCircle, Wrench,
  PlayCircle, Timer, ShieldAlert, Package, ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';
import clsx from 'clsx';

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
        <div key={s}
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${i <= currentIdx ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
          {labels[s]}
        </div>
      ))}
    </div>
  );
}

// MOD 4: mini bar chart component
function MiniBarChart({ data, labelKey, valueKey, color = 'bg-brand-500' }: {
  data: any[]; labelKey: string; valueKey: string; color?: string;
}) {
  if (!data?.length) return <p className="text-slate-400 text-sm">Pas de données</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0));
  return (
    <div className="space-y-2">
      {data.map((item, i) => {
        const val = Number(item[valueKey]) || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-20 shrink-0 truncate">{item[labelKey]}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div className={clsx('h-2 rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-medium text-slate-900 w-28 text-right shrink-0">
              {val.toLocaleString('fr-DZ')} DZD
            </span>
          </div>
        );
      })}
    </div>
  );
}

// MOD 1+4: Unpaid by client widget
function UnpaidByClientWidget({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-slate-400 text-sm py-2">Aucun impayé 🎉</p>;
  const maxVal = Math.max(...data.map((d) => Number(d.unpaidTotal)));
  return (
    <div className="space-y-3">
      {data.slice(0, 6).map((item) => {
        const amount = Number(item.unpaidTotal);
        const daysSince = Math.floor((Date.now() - new Date(item.oldestInvoice).getTime()) / 86400000);
        const pct = maxVal > 0 ? (amount / maxVal) * 100 : 0;
        const urgencyColor = daysSince > 60 ? 'bg-red-500' : daysSince > 30 ? 'bg-orange-400' : 'bg-amber-400';
        return (
          <div key={item.clientId || item.clientName}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-900 truncate max-w-40">{item.clientName}</span>
                {daysSince > 30 && (
                  <span className={clsx('text-xs px-1.5 py-0.5 rounded-full text-white font-medium', daysSince > 60 ? 'bg-red-500' : 'bg-orange-400')}>
                    {daysSince}j
                  </span>
                )}
              </div>
              <div className="text-right shrink-0">
                <span className="text-sm font-700 text-red-600">{amount.toLocaleString('fr-DZ')} DZD</span>
                <div className="text-xs text-slate-400">{item.unpaidCount} facture(s)</div>
              </div>
            </div>
            <div className="bg-slate-100 rounded-full h-1.5">
              <div className={clsx('h-1.5 rounded-full', urgencyColor)} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useI18nStore();

  const [overview, setOverview] = useState<any>(null);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [taskStats, setTaskStats] = useState<any>(null);
  const [topClients, setTopClients] = useState<any[]>([]);
  const [techStats, setTechStats] = useState<any>(null);
  const [activeIvs, setActiveIvs] = useState<any[]>([]);
  const [recentIvs, setRecentIvs] = useState<any[]>([]);

  // MOD 1+4: analytics data
  const [unpaidByClient, setUnpaidByClient] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [revenueByUser, setRevenueByUser] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<any[]>([]);
  const [marginStats, setMarginStats] = useState<any>(null);
  const [deliveryPerf, setDeliveryPerf] = useState<any>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'admin') {
          const [ov, inv, clients, unpaid, monthly, byUser, products, overdue, margin, delPerf] = await Promise.all([
            api.get('/stats/overview'),
            api.get('/invoices', { params: { type: 'facture' } }),
            api.get('/stats/revenue-by-client'),
            api.get('/stats/unpaid-by-client'),       // MOD 1
            api.get('/stats/monthly-revenue'),         // MOD 4
            api.get('/stats/revenue-by-user'),         // MOD 4
            api.get('/stats/top-products'),            // MOD 4
            api.get('/stats/overdue-invoices'),        // MOD 4
            api.get('/stats/margin'),                  // MOD 4
            api.get('/stats/delivery-performance'),    // MOD 4
          ]);
          setOverview(ov.data);
          setRecentInvoices(inv.data.slice(0, 5));
          setTopClients(clients.data.slice(0, 5));
          setUnpaidByClient(unpaid.data);
          setMonthlyRevenue(monthly.data);
          setRevenueByUser(byUser.data);
          setTopProducts(products.data);
          setOverdueInvoices(overdue.data);
          setMarginStats(margin.data);
          setDeliveryPerf(delPerf.data);
        } else if (user?.role === 'commercial') {
          const inv = await api.get('/invoices');
          setRecentInvoices(inv.data.slice(0, 5));
          const paid = inv.data.filter((i: any) => i.paymentStatus === 'paid').length;
          setOverview({ invoicesCount: { total: inv.data.length, paid } });
        } else if (user?.role === 'livreur') {
          const ts = await api.get('/tasks/my-stats');
          setTaskStats(ts.data);
        } else if (user?.role === 'technicien') {
          const [st, active, recent] = await Promise.all([
            api.get('/interventions/stats'),
            api.get('/interventions', { params: { status: 'en_cours' } }),
            api.get('/interventions', { params: { limit: 5 } }),
          ]);
          setTechStats(st.data);
          setActiveIvs(active.data);
          setRecentIvs(recent.data);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={32} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const recoveryRate = overview?.invoicesCount?.total > 0
    ? Math.round((overview.invoicesCount.paid / overview.invoicesCount.total) * 100)
    : 0;

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto animate-fade-in">

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-2xl font-700 uppercase shrink-0">
          {user?.name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-display font-700 text-slate-900">
            {t('hello')}, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 mt-0.5">{t('activity_overview')}</p>
        </div>
      </div>

      {/* ══ ADMIN ═══════════════════════════════════════════════════════════════ */}
      {user?.role === 'admin' && overview && (
        <>
          {/* MOD 4: Alertes intelligentes */}
          {(overdueInvoices.length > 0 || recoveryRate < 70 || Number(deliveryPerf?.onTimeRate) < 80) && (
            <div className="mb-6 space-y-2">
              {overdueInvoices.length > 0 && (
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  <strong>{overdueInvoices.length} facture(s)</strong> impayée(s) depuis plus de 30 jours —
                  <Link href="/invoices?paymentStatus=unpaid" className="underline ml-1">Voir →</Link>
                </div>
              )}
              {recoveryRate < 70 && (
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <ShieldAlert size={16} className="shrink-0" />
                  Taux de recouvrement faible : <strong className="mx-1">{recoveryRate}%</strong> (objectif 70%)
                </div>
              )}
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={TrendingUp} label={t('revenue')} color="bg-brand-500"
              value={`${Number(overview.revenue?.totalRevenue || 0).toLocaleString('fr-DZ')} DZD`}
              sub={`${overview.revenue?.paidInvoicesCount || 0} factures payées`}
            />
            <StatCard
              icon={AlertCircle} label={t('unpaid_amount')} color="bg-red-500"
              value={`${Number(overview.revenue?.unpaidRevenue || 0).toLocaleString('fr-DZ')} DZD`}
              sub={`${overview.invoicesCount?.unpaid || 0} en attente`}
            />
            {/* MOD 4: recovery rate KPI */}
            <StatCard
              icon={BarChart3} label={t('recovery_rate')} color={recoveryRate >= 70 ? 'bg-emerald-500' : 'bg-orange-500'}
              value={`${recoveryRate}%`}
              sub={`${overview.invoicesCount?.paid || 0} / ${overview.invoicesCount?.total || 0} factures`}
            />
            <StatCard
              icon={CheckSquare} label={t('deliveries')} color="bg-emerald-500"
              value={`${overview.deliveries?.completed || 0} / ${overview.deliveries?.total || 0}`}
              sub={`Taux : ${overview.deliveries?.completionRate || 0}%`}
            />
          </div>

          {/* MOD 4: row 2 — margin + delivery perf */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              icon={DollarSign} label={t('gross_margin')} color="bg-purple-500"
              value={marginStats ? `${Number(marginStats.totalMargin).toLocaleString('fr-DZ')} DZD` : '—'}
              sub={marginStats ? `Taux : ${marginStats.marginRate}%` : ''}
            />
            <StatCard
              icon={Truck} label={t('on_time_deliveries')} color={Number(deliveryPerf?.onTimeRate) >= 80 ? 'bg-emerald-600' : 'bg-amber-500'}
              value={deliveryPerf ? `${deliveryPerf.onTimeRate}%` : '—'}
              sub={deliveryPerf ? `${deliveryPerf.onTime} à temps / ${deliveryPerf.completed} terminées` : ''}
            />
            <StatCard
              icon={FileText} label="Total documents" color="bg-slate-600"
              value={overview.invoicesCount?.total || 0}
              sub={`${overview.invoicesCount?.draft || 0} brouillons`}
            />
            <StatCard
              icon={Users} label={t('active_clients')} color="bg-indigo-500"
              value={topClients.length || 0}
              sub="avec au moins 1 document"
            />
          </div>

          {/* MOD 4: Monthly revenue chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-brand-500" />
                <h2 className="font-display font-600 text-slate-900">{t('monthly_revenue_12_months')}</h2>
              </div>
              <MiniBarChart data={monthlyRevenue} labelKey="month" valueKey="revenue" color="bg-brand-500" />
            </div>

            {/* MOD 4: Revenue by user (commercial) */}
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users size={18} className="text-violet-500" />
                <h2 className="font-display font-600 text-slate-900">{t('revenue_by_sales')}</h2>
              </div>
              <MiniBarChart data={revenueByUser} labelKey="userName" valueKey="totalRevenue" color="bg-violet-500" />
            </div>
          </div>

          {/* MOD 1: Unpaid by client + MOD 4: Top products */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertCircle size={18} className="text-red-500" />
                  <h2 className="font-display font-600 text-slate-900">{t('unpaid_by_client')}</h2>
                </div>
                <Link href="/clients" className="text-sm text-brand-600 hover:underline">{t('view_all')} →</Link>
              </div>
              <UnpaidByClientWidget data={unpaidByClient} />
            </div>

            <div className="card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package size={18} className="text-amber-500" />
                <h2 className="font-display font-600 text-slate-900">{t('top_5_products')}</h2>
              </div>
              {topProducts.length === 0 ? (
                <p className="text-slate-400 text-sm">{t('no_data')}</p>
              ) : (
                <div className="space-y-2">
                  {topProducts.map((p, i) => (
                    <div key={p.name} className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs font-700 flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="flex-1 text-sm text-slate-700 truncate">{p.name}</span>
                      <span className="text-xs text-slate-400">×{p.qty}</span>
                      <span className="text-sm font-600 text-amber-700">{Number(p.revenue).toLocaleString('fr-DZ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top clients */}
          {topClients.length > 0 && (
            <div className="card p-6 mb-8">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={18} className="text-brand-500" />
                <h2 className="font-display font-600 text-slate-900">{t('revenue_by_client')}</h2>
                <Link href="/clients" className="ml-auto text-sm text-brand-600 hover:underline">{t('view_all')} →</Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                {topClients.map((c: any) => (
                  <div key={c.clientId || c.clientName} className="bg-slate-50 rounded-lg p-3">
                    <div className="font-medium text-slate-900 text-sm truncate">{c.clientName}</div>
                    <div className="text-brand-600 font-700 mt-1">{Number(c.totalRevenue || 0).toLocaleString('fr-DZ')}</div>
                    <div className="text-xs text-slate-400">DZD · {c.invoiceCount} docs</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══ COMMERCIAL ══════════════════════════════════════════════════════════ */}
      {user?.role === 'commercial' && overview && (
        <div className="grid grid-cols-2 gap-4 mb-8">
          <StatCard icon={FileText} label={t('my_invoices')} color="bg-brand-500" value={overview.invoicesCount?.total || 0} />
          <StatCard icon={CheckSquare} label={t('paid_invoices')} color="bg-emerald-500" value={overview.invoicesCount?.paid || 0} />
        </div>
      )}

      {/* ══ LIVREUR ═════════════════════════════════════════════════════════════ */}
      {user?.role === 'livreur' && taskStats && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard icon={CheckSquare} label={t('total_tasks')} color="bg-brand-500" value={taskStats.total || 0} />
          <StatCard icon={CheckSquare} label={t('completed_tasks')} color="bg-emerald-500" value={taskStats.completed || 0} />
          <StatCard icon={DollarSign} label={t('total_earned')} color="bg-purple-500"
            value={`${Number(taskStats.totalEarned || 0).toLocaleString('fr-DZ')} DZD`} />
        </div>
      )}

      {/* ══ TECHNICIEN ══════════════════════════════════════════════════════════ */}
      {user?.role === 'technicien' && techStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <StatCard icon={Wrench} label={t('total_interventions')} color="bg-brand-500" value={techStats.total} />
          <StatCard icon={PlayCircle} label={t('in_progress')} color="bg-blue-500" value={techStats.inProgress} />
          <StatCard icon={CheckSquare} label={t('completed_feminine_plural')} color="bg-emerald-500" value={techStats.done} />
          <StatCard icon={Clock} label={t('pending')} color="bg-amber-500" value={techStats.pending} />
          <StatCard icon={Timer} label={t('worked_hours')} color="bg-purple-500" value={`${techStats.totalWorkedHours}h`} />
          <StatCard icon={DollarSign} label={t('total_earned')} color="bg-slate-600"
            value={`${Number(techStats.totalEarned || 0).toLocaleString('fr-DZ')} DZD`} />
        </div>
      )}

      {/* Technicien — En cours */}
      {user?.role === 'technicien' && activeIvs.length > 0 && (
        <div className="card p-6 mb-6">
          <h2 className="font-display font-600 text-slate-900 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />{t('interventions_in_progress')}
          </h2>
          <div className="space-y-3">
            {activeIvs.map((iv) => (
              <Link key={iv.id} href={`/interventions/${iv.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-blue-50 border border-blue-100 hover:border-blue-300 transition-all">
                <div>
                  <div className="font-mono text-xs text-blue-500 font-medium">{iv.ticketNumber}</div>
                  <div className="font-display font-600 text-slate-900 mt-0.5">{iv.machineName}{iv.machineBrand && ` (${iv.machineBrand})`}</div>
                  <div className="text-sm text-slate-500">👤 {iv.clientName}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400">Démarré le</div>
                  <div className="text-sm">{iv.startedAt ? new Date(iv.startedAt).toLocaleDateString('fr-FR') : '—'}</div>
                  <div className="text-brand-600 font-700 text-sm mt-1">{Number(iv.totalPrice).toLocaleString('fr-DZ')} DZD</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent invoices (admin + commercial) */}
      {recentInvoices.length > 0 && (
        <div className="card p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-600 text-slate-900">{t('latest_invoices')}</h2>
            <Link href="/invoices" className="text-sm text-brand-600 hover:underline">{t('view_all')} →</Link>
          </div>
          <div className="space-y-1">
            {recentInvoices.map((inv: any) => (
              <Link key={inv.id} href={`/invoices/${inv.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-slate-50 transition-colors gap-3 flex-wrap">
                <div>
                  <div className="font-mono text-sm font-medium text-slate-900">{inv.number}</div>
                  <div className="text-xs text-slate-500">{inv.clientName}</div>
                  {/* MOD 3: creator on dashboard */}
                  {inv.createdBy && (
                    <div className="text-xs text-slate-400">
                      {inv.createdBy.role === 'admin' ? '🛡 Admin' : `💼 ${inv.createdBy.name}`}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {inv.workflowStep && <WorkflowBadge step={inv.workflowStep} />}
                  <div className="text-right">
                    <div className="font-medium text-sm">{Number(inv.total).toLocaleString('fr-DZ')} DZD</div>
                    <span className={clsx('text-xs font-medium', inv.paymentStatus === 'paid' ? 'text-emerald-600' : 'text-red-500')}>
                      {inv.paymentStatus === 'paid' ? `✓ ${t('paid_status')}` : `○ ${t('unpaid_status_short')}`}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="card p-6">
        <h2 className="font-display font-600 text-slate-900 mb-4">{t('quick_actions')}</h2>
        <div className="flex flex-wrap gap-3">
          {(user?.role === 'admin' || user?.role === 'commercial') && (
            <>
              <Link href="/invoices/new" className="btn-primary"><FileText size={16} /> {t('new_invoice')}</Link>
              <Link href="/invoices/new?type=proforma" className="btn-secondary"><FileText size={16} /> {t('proforma')}</Link>
              <Link href="/invoices/new?type=bon_livraison" className="btn-secondary"><Truck size={16} /> {t('delivery_note')}</Link>
              <Link href="/clients" className="btn-secondary"><Users size={16} /> {t('clients')}</Link>
            </>
          )}
          {user?.role === 'admin' && (
            <>
              <Link href="/tasks" className="btn-secondary"><CheckSquare size={16} /> {t('tasks')}</Link>
              <Link href="/interventions" className="btn-secondary"><Wrench size={16} /> Interventions</Link>
            </>
          )}
          {user?.role === 'commercial' && (
            <Link href="/notifications" className="btn-secondary"><Clock size={16} /> {t('unpaid_reminders')}</Link>
          )}
          {user?.role === 'livreur' && (
            <Link href="/tasks" className="btn-primary"><CheckSquare size={16} /> {t('my_tasks')}</Link>
          )}
          {user?.role === 'technicien' && (
            <>
              <Link href="/interventions" className="btn-primary"><Wrench size={16} /> Mes interventions</Link>
              <Link href="/interventions/new" className="btn-secondary"><PlayCircle size={16} /> Nouvelle intervention</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
