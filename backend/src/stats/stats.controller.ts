import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentStatus, InvoiceType } from '../invoices/invoice.entity';
import { Task, TaskStatus } from '../tasks/task.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StatsController {
  constructor(
    @InjectRepository(Invoice) private invoicesRepo: Repository<Invoice>,
    @InjectRepository(Task) private tasksRepo: Repository<Task>,
  ) {}

  @Get('revenue')
  async getTotalRevenue() {
    const result = await this.invoicesRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.total)', 'total')
      .addSelect('COUNT(*)', 'count')
      .where('inv.paymentStatus = :status', { status: PaymentStatus.PAID })
      .andWhere('inv.type = :type', { type: 'facture' })
      .getRawOne();

    const unpaid = await this.invoicesRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.total)', 'total')
      .where('inv.paymentStatus = :status', { status: PaymentStatus.UNPAID })
      .andWhere('inv.type = :type', { type: 'facture' })
      .andWhere('inv.status != :cancelled', { cancelled: InvoiceStatus.ANNULEE })
      .getRawOne();

    return {
      totalRevenue: Number(result?.total || 0),
      paidInvoicesCount: Number(result?.count || 0),
      unpaidRevenue: Number(unpaid?.total || 0),
    };
  }

  @Get('revenue-by-client')
  async getRevenueByClient() {
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('SUM(inv.total)', 'totalRevenue')
      .addSelect('COUNT(*)', 'invoiceCount')
      .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
      .where('inv.type = :type', { type: 'facture' })
      .groupBy('inv.clientName')
      .addGroupBy('inv.clientId')
      .orderBy('SUM(inv.total)', 'DESC')
      .getRawMany();
  }

  @Get('invoices-count')
  async getInvoicesCount() {
    const [total, paid, unpaid, cancelled, draft] = await Promise.all([
      this.invoicesRepo.count({ where: { type: 'facture' as any } }),
      this.invoicesRepo.count({ where: { type: 'facture' as any, paymentStatus: PaymentStatus.PAID } }),
      this.invoicesRepo.count({ where: { type: 'facture' as any, paymentStatus: PaymentStatus.UNPAID, status: InvoiceStatus.EMISE } }),
      this.invoicesRepo.count({ where: { type: 'facture' as any, status: InvoiceStatus.ANNULEE } }),
      this.invoicesRepo.count({ where: { type: 'facture' as any, status: InvoiceStatus.BROUILLON } }),
    ]);
    return { total, paid, unpaid, cancelled, draft };
  }

  @Get('deliveries-completed')
  async getDeliveriesCompleted() {
    const [total, completed, pending, notCompleted] = await Promise.all([
      this.tasksRepo.count(),
      this.tasksRepo.count({ where: { status: TaskStatus.TERMINEE } }),
      this.tasksRepo.count({ where: { status: TaskStatus.EN_ATTENTE } }),
      this.tasksRepo.count({ where: { status: TaskStatus.NON_TERMINEE } }),
    ]);

    const earningsResult = await this.tasksRepo
      .createQueryBuilder('task')
      .select('SUM(task.finalPrice)', 'totalEarnings')
      .where('task.status = :status', { status: TaskStatus.TERMINEE })
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
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('inv.clientEmail', 'clientEmail')
      .addSelect('inv.clientPhone', 'clientPhone')
      .addSelect('inv.clientLogoUrl', 'clientLogoUrl')
      .addSelect('SUM(inv.total)', 'unpaidTotal')
      .addSelect('COUNT(*)', 'unpaidCount')
      .addSelect('MIN(inv.createdAt)', 'oldestInvoice')
      .where('inv.paymentStatus = :s', { s: PaymentStatus.UNPAID })
      .andWhere('inv.status != :c', { c: InvoiceStatus.ANNULEE })
      .andWhere('inv.type = :type', { type: InvoiceType.FACTURE })
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
    const rows = await this.invoicesRepo
      .createQueryBuilder('inv')
      .select("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'month')
      .addSelect('SUM(inv.total)', 'revenue')
      .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
      .where('inv.type = :type', { type: 'facture' })
      .andWhere("inv.createdAt >= NOW() - INTERVAL '12 months'")
      .groupBy("TO_CHAR(inv.createdAt, 'YYYY-MM')")
      .orderBy("TO_CHAR(inv.createdAt, 'YYYY-MM')", 'ASC')
      .getRawMany();
    return rows;
  }

  // MOD 4: revenue by user (commercial / admin)
  @Get('revenue-by-user')
  async getRevenueByUser() {
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoin('inv.createdBy', 'user')
      .select('user.name', 'userName')
      .addSelect('user.role', 'userRole')
      .addSelect('COUNT(*)', 'invoiceCount')
      .addSelect('SUM(inv.total)', 'totalRevenue')
      .addSelect("SUM(CASE WHEN inv.paymentStatus = 'paid' THEN inv.total ELSE 0 END)", 'paidRevenue')
      .where('inv.type = :type', { type: 'facture' })
      .groupBy('user.name')
      .addGroupBy('user.role')
      .orderBy('SUM(inv.total)', 'DESC')
      .getRawMany();
  }

  // MOD 4: top 5 products sold
  @Get('top-products')
  async getTopProducts() {
    const invoices = await this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.items', 'items')
      .where('inv.type = :type', { type: 'facture' })
      .getRawMany();

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
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.createdBy', 'createdBy')
      .where('inv.paymentStatus = :status', { status: PaymentStatus.UNPAID })
      .andWhere('inv.status != :cancelled', { cancelled: InvoiceStatus.ANNULEE })
      .andWhere('inv.type = :type', { type: 'facture' })
      .andWhere("inv.createdAt < NOW() - INTERVAL '30 days'")
      .orderBy('inv.createdAt', 'ASC')
      .getMany();
  }

  // MOD 4: global margin stats
  @Get('margin')
  async getMarginStats() {
    const result = await this.invoicesRepo
      .createQueryBuilder('inv')
      .select('SUM(inv.totalMargin)', 'totalMargin')
      .addSelect('SUM(inv.total)', 'totalRevenue')
      .where('inv.type = :type', { type: 'facture' })
      .andWhere('inv.status != :cancelled', { cancelled: InvoiceStatus.ANNULEE })
      .getRawOne();

    const totalMargin = Number(result?.totalMargin || 0);
    const totalRevenue = Number(result?.totalRevenue || 0);
    const marginRate = totalRevenue > 0 ? ((totalMargin / totalRevenue) * 100).toFixed(1) : '0';

    return { totalMargin, totalRevenue, marginRate };
  }

  // MOD 4: delivery performance
  @Get('delivery-performance')
  async getDeliveryPerformance() {
    const total = await this.tasksRepo.count();
    const completed = await this.tasksRepo.count({ where: { status: TaskStatus.TERMINEE } });
    // on time = finished before or on dueDate
    const onTime = await this.tasksRepo
      .createQueryBuilder('task')
      .where('task.status = :status', { status: TaskStatus.TERMINEE })
      .andWhere('task.completedAt <= task.dueDate OR task.dueDate IS NULL')
      .getCount();

    return {
      total,
      completed,
      onTime,
      late: completed - onTime,
      onTimeRate: completed > 0 ? ((onTime / completed) * 100).toFixed(1) : '0',
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
