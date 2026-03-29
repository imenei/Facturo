import { Controller, Get, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Invoice, InvoiceStatus, PaymentStatus } from '../invoices/invoice.entity';
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

  // GET /stats/revenue — CA total (factures payées)
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

  // GET /stats/revenue-by-client — CA par client
  @Get('revenue-by-client')
  async getRevenueByClient() {
    return this.invoicesRepo
      .createQueryBuilder('inv')
      .select('inv.clientName', 'clientName')
      .addSelect('inv.clientId', 'clientId')
      .addSelect('SUM(inv.total)', 'totalRevenue')
      .addSelect('COUNT(*)', 'invoiceCount')
      .addSelect('SUM(CASE WHEN inv.paymentStatus = \'paid\' THEN inv.total ELSE 0 END)', 'paidRevenue')
      .where('inv.type = :type', { type: 'facture' })
      .groupBy('inv.clientName')
      .addGroupBy('inv.clientId')
      .orderBy('SUM(inv.total)', 'DESC')
      .getRawMany();
  }

  // GET /stats/invoices-count — nombre de factures par statut
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

  // GET /stats/deliveries-completed — tâches de livraison complétées
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
      .select('SUM(task.price)', 'totalEarnings')
      .where('task.status = :status', { status: TaskStatus.TERMINEE })
      .getRawOne();

    return {
      total,
      completed,
      pending,
      notCompleted,
      completionRate: total > 0 ? ((completed / total) * 100).toFixed(1) : '0',
      totalEarnings: Number(earningsResult?.totalEarnings || 0),
    };
  }

  // GET /stats/overview — tout en un seul appel pour le dashboard
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
