import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentStatus, InvoiceType } from '../invoices/invoice.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

/**
 * Chiffre d'affaires (CA) = ventes HT des FACTURES émises ou payées.
 * Les proformas, les bons de livraison, les brouillons, les factures annulées et les factures
 * supprimées (corbeille) n'en font jamais partie. La TVA n'est pas du chiffre d'affaires.
 */
const SALES_HT = '(inv.total - COALESCE(inv.tvaAmount, 0))';
const NET_PROFIT = 'COALESCE(NULLIF(inv.netProfit, 0), COALESCE(inv.totalMargin, 0) - COALESCE(inv.otherCharge, 0) - COALESCE(inv.deliveryPrice, 0))';

// ✅ MODIF : taux de TVA (19 %) -> TVA = prix HT * 0.19
const TVA_RATE = 0.19;

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StatsController {
  constructor(
    @InjectRepository(Invoice) private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

  /** Factures non supprimées (tous statuts). */
  private factures() {
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .where('inv.type = :factureType', { factureType: InvoiceType.FACTURE })
      .andWhere('inv.isDeleted = false');
  }

  /** Factures émises ou payées : la base de tous les chiffres financiers. */
  private issuedFactures() {
    return this.factures().andWhere('inv.status IN (:...issuedStatuses)', {
      issuedStatuses: [InvoiceStatus.EMISE, InvoiceStatus.PAYEE],
    });
  }

  /**
   * Tâches de livraison « réelles » : on écarte les tâches rattachées à un document supprimé / proforma,
   * et les anciennes tâches en doublon d'une facture qui possède désormais un bon de livraison
   * (la livraison n'est comptée qu'une seule fois, via son bon).
   */
  private deliveryTasks() {
    return this.tasksRepo
      .createQueryBuilder('task')
      .leftJoin('task.invoice', 'inv')
      .where(
        `(inv.id IS NULL OR (inv.isDeleted = false AND inv.type != :proformaType AND NOT (inv.type = :factureType AND EXISTS (
          SELECT 1 FROM invoices bl
          WHERE bl."sourceInvoiceId" = CAST(inv.id AS text) AND bl.type = :noteType AND bl."isDeleted" = false
        ))))`,
        { proformaType: InvoiceType.PROFORMA, factureType: InvoiceType.FACTURE, noteType: InvoiceType.BON_LIVRAISON },
      );
  }

  @Get('revenue')
  async getTotalRevenue() {
    const sales = await this.issuedFactures()
      .select(`COALESCE(SUM(${SALES_HT}), 0)`, 'revenue')
      .addSelect('COUNT(*)', 'count')
      .addSelect(`COALESCE(SUM(CASE WHEN inv.paymentStatus = :paid THEN ${SALES_HT} ELSE 0 END), 0)`, 'collected')
      .addSelect('COUNT(CASE WHEN inv.paymentStatus = :paid THEN 1 END)', 'paidCount')
      .setParameter('paid', PaymentStatus.PAID)
      .getRawOne();

    // Reste à encaisser (TTC : c'est ce que le client doit réellement payer).
    const unpaid = await this.issuedFactures()
      .select('COALESCE(SUM(inv.total), 0)', 'total')
      .andWhere('inv.paymentStatus = :unpaid', { unpaid: PaymentStatus.UNPAID })
      .getRawOne();

    // ✅ MODIF : TVA = HT * 0.19, arrondie à 2 décimales par facture
    const vat = await this.issuedFactures()
      .select(
        `COALESCE(SUM(ROUND(CAST(${SALES_HT} * ${TVA_RATE} AS numeric), 2)), 0)`,
        'totalVat',
      )
      .andWhere('inv.hasTva = true')
      .getRawOne();

    return {
      totalRevenue: Number(sales?.revenue || 0),
      collectedRevenue: Number(sales?.collected || 0),
      invoicesCount: Number(sales?.count || 0),
      paidInvoicesCount: Number(sales?.paidCount || 0),
      unpaidRevenue: Number(unpaid?.total || 0),
      totalVat: Number(vat?.totalVat || 0),
    };
  }

  @Get('revenue-by-client')
  async getRevenueByClient() {
    return this.issuedFactures()
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect(`SUM(${SALES_HT})`, 'totalRevenue')
      .addSelect('COUNT(*)', 'invoiceCount')
      .addSelect(`SUM(CASE WHEN inv.paymentStatus = 'paid' THEN ${SALES_HT} ELSE 0 END)`, 'paidRevenue')
      .groupBy('inv.clientName')
      .addGroupBy('inv.clientId')
      .orderBy(`SUM(${SALES_HT})`, 'DESC')
      .getRawMany();
  }

  @Get('invoices-count')
  async getInvoicesCount() {
    const [total, paid, unpaid, cancelled, draft] = await Promise.all([
      this.issuedFactures().getCount(),
      this.issuedFactures().andWhere('inv.paymentStatus = :s', { s: PaymentStatus.PAID }).getCount(),
      this.issuedFactures().andWhere('inv.paymentStatus = :s', { s: PaymentStatus.UNPAID }).getCount(),
      this.factures().andWhere('inv.status = :s', { s: InvoiceStatus.ANNULEE }).getCount(),
      this.factures().andWhere('inv.status = :s', { s: InvoiceStatus.BROUILLON }).getCount(),
    ]);
    return { total, paid, unpaid, cancelled, draft };
  }

  @Get('deliveries-completed')
  async getDeliveriesCompleted() {
    const countBy = (status?: TaskStatus) => {
      const qb = this.deliveryTasks();
      if (status) qb.andWhere('task.status = :status', { status });
      return qb.getCount();
    };
    const [total, completed, pending, notCompleted] = await Promise.all([
      countBy(),
      countBy(TaskStatus.TERMINEE),
      countBy(TaskStatus.EN_ATTENTE),
      countBy(TaskStatus.NON_TERMINEE),
    ]);

    const earningsResult = await this.deliveryTasks()
      .select('COALESCE(SUM(task.finalPrice), 0)', 'totalEarnings')
      .andWhere('task.status = :status', { status: TaskStatus.TERMINEE })
      .getRawOne();

    return {
      total, completed, pending, notCompleted,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
      totalEarnings: Number(earningsResult?.totalEarnings || 0),
    };
  }

  // MOD 1: unpaid invoices grouped by client (for dashboard and clients page)
  @Get('unpaid-by-client')
  async getUnpaidByClient() {
    return this.issuedFactures()
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('inv.clientEmail', 'clientEmail')
      .addSelect('inv.clientPhone', 'clientPhone')
      .addSelect('inv.clientLogoUrl', 'clientLogoUrl')
      .addSelect('SUM(inv.total)', 'unpaidTotal')
      .addSelect('COUNT(*)', 'unpaidCount')
      .addSelect('MIN(inv.createdAt)', 'oldestInvoice')
      .andWhere('inv.paymentStatus = :s', { s: PaymentStatus.UNPAID })
      .groupBy('inv.clientName')
      .addGroupBy('inv.clientId')
      .addGroupBy('inv.clientEmail')
      .addGroupBy('inv.clientPhone')
      .addGroupBy('inv.clientLogoUrl')
      .orderBy('SUM(inv.total)', 'DESC')
      .getRawMany();
  }

  // MOD 4: monthly revenue for last 12 months
  @Get('monthly-revenue')
  async getMonthlyRevenue() {
    return this.issuedFactures()
      .select("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'month')
      .addSelect(`SUM(${SALES_HT})`, 'revenue')
      .addSelect(`SUM(CASE WHEN inv.paymentStatus = 'paid' THEN ${SALES_HT} ELSE 0 END)`, 'paidRevenue')
      .andWhere("inv.createdAt >= NOW() - INTERVAL '12 months'")
      .groupBy("TO_CHAR(inv.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'ASC')
      .getRawMany();
  }

  // MOD 4: revenue by user (commercial / admin)
  @Get('revenue-by-user')
  async getRevenueByUser() {
    return this.issuedFactures()
      .leftJoin('inv.createdBy', 'user')
      .select('user.name', 'userName')
      .addSelect('user.role', 'userRole')
      .addSelect('COUNT(*)', 'invoiceCount')
      .addSelect(`SUM(${SALES_HT})`, 'totalRevenue')
      .addSelect(`SUM(CASE WHEN inv.paymentStatus = 'paid' THEN ${SALES_HT} ELSE 0 END)`, 'paidRevenue')
      .groupBy('user.name')
      .addGroupBy('user.role')
      .orderBy(`SUM(${SALES_HT})`, 'DESC')
      .getRawMany();
  }

  // MOD 4: top 5 products sold
  @Get('top-products')
  async getTopProducts() {
    const invoices = await this.issuedFactures().select('inv.items', 'items').getRawMany();

    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
    for (const row of invoices) {
      const items = Array.isArray(row.items) ? row.items : [];
      for (const item of items) {
        const key = item.description;
        if (!productMap[key]) productMap[key] = { name: key, qty: 0, revenue: 0 };
        productMap[key].qty += Number(item.quantity);
        productMap[key].revenue += Number(item.total);
      }
    }
    return Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }

  // MOD 4: overdue invoices (unpaid for more than 30 days)
  @Get('overdue-invoices')
  async getOverdueInvoices() {
    return this.issuedFactures()
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .andWhere('inv.paymentStatus = :status', { status: PaymentStatus.UNPAID })
      .andWhere("inv.createdAt < NOW() - INTERVAL '30 days'")
      .orderBy('inv.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Bénéfice net global = bénéfice net de chaque facture émise / payée
   * (ventes − achats − frais internes − frais de livraison du livreur affecté)
   * − frais imprévus de livraison (extraFees) de toutes les livraisons.
   */
  @Get('margin')
  async getMarginStats() {
    const result = await this.issuedFactures()
      .select(`COALESCE(SUM(${NET_PROFIT}), 0)`, 'invoiceProfit')
      .addSelect(`COALESCE(SUM(${SALES_HT}), 0)`, 'totalRevenue')
      .getRawOne();

    const extra = await this.deliveryTasks()
      .select('COALESCE(SUM(task.extraFees), 0)', 'extraFees')
      .getRawOne();

    const extraFees = Number(extra?.extraFees || 0);
    const totalMargin = Number(result?.invoiceProfit || 0) - extraFees;
    const totalRevenue = Number(result?.totalRevenue || 0);
    const marginRate = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : '0';

    return { totalMargin, totalRevenue, marginRate, extraFees };
  }

  // MOD 4: delivery performance
  @Get('delivery-performance')
  async getDeliveryPerformance() {
    const total = await this.deliveryTasks().getCount();
    const completed = await this.deliveryTasks()
      .andWhere('task.status = :status', { status: TaskStatus.TERMINEE })
      .getCount();
    // À temps = terminée au plus tard à l'échéance (ou sans échéance). Les parenthèses sont
    // indispensables : sans elles, tous les livraisons sans échéance étaient comptées « à temps »
    // même non terminées, d'où des taux supérieurs à 100 %.
    const onTime = await this.deliveryTasks()
      .andWhere('task.status = :status', { status: TaskStatus.TERMINEE })
      .andWhere('(task.dueDate IS NULL OR COALESCE(task.finishedDeliveryAt, task.completedAt) <= task.dueDate)')
      .getCount();

    return {
      total,
      completed,
      onTime,
      late: completed - onTime,
      onTimeRate: completed > 0 ? Math.min(100, (onTime / completed) * 100).toFixed(1) : '0',
    };
  }

  // MOD 4: all-in-one for dashboard
  @Get('overview')
  async getOverview() {
    const [revenue, invoicesCount, deliveries] = await Promise.all([
      this.getTotalRevenue(),
      this.getInvoicesCount(),
      this.getDeliveriesCompleted(),
    ]);
    return { revenue, invoicesCount, deliveries };
  }
}
