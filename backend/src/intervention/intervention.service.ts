// backend/src/interventions/interventions.service.ts
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { Intervention, InterventionStatus, MaterialItem } from './intervention.entity';
import { UserRole } from '../users/user.entity';

// Type local pour ne pas dépendre du shape exact du JWT guard
interface RequestUser {
  id: string;
  role: UserRole | string;
}

@Injectable()
export class InterventionsService {
  constructor(
    @InjectRepository(Intervention)
    private repo: Repository<Intervention>,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async generateTicket(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo.count();
    return `INT-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private calcTotals(dto: any, existing?: Partial<Intervention>) {
    const materials: MaterialItem[] = dto.materialsUsed ?? existing?.materialsUsed ?? [];
    const partsCost = materials.reduce((s, m) => s + Number(m.quantity) * Number(m.unitPrice), 0);
    const totalPrice = Number(dto.laborCost ?? existing?.laborCost ?? 0) + partsCost;
    return { partsCost, totalPrice };
  }

  private mapMaterials(raw: any[]): MaterialItem[] {
    return (raw || []).map(m => ({
      name: m.name,
      quantity: Number(m.quantity),
      unitPrice: Number(m.unitPrice),
      total: Number(m.quantity) * Number(m.unitPrice),
    }));
  }

  private isTech(user: RequestUser): boolean {
    return user.role === UserRole.TECHNICIEN || user.role === 'technicien';
  }

  private assertAccess(item: Intervention, user: RequestUser) {
    if (this.isTech(user) && item.assignedTo?.id !== user.id) {
      throw new ForbiddenException('Accès refusé');
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  async create(dto: any, createdById: string): Promise<Intervention> {
    const ticketNumber = await this.generateTicket();
    const materials = this.mapMaterials(dto.materialsUsed || []);
    const { partsCost, totalPrice } = this.calcTotals({ ...dto, materialsUsed: materials });

    const item: Intervention = this.repo.create({
      ...dto as Partial<Intervention>,
      ticketNumber,
      materialsUsed: materials,
      photos: dto.photos || [],
      partsCost,
      totalPrice,
      createdBy: { id: createdById } as any,
      assignedTo: dto.assignedToId ? { id: dto.assignedToId } as any : null,
    } as Intervention);
    return this.repo.save(item) as Promise<Intervention>;
  }

  async findAll(
    user: RequestUser,
    filters?: {
      status?: string;
      workType?: string;
      clientName?: string;
      serialNumber?: string;
      dateFrom?: string;
      dateTo?: string;
    },
  ): Promise<Intervention[]> {
    const qb = this.repo.createQueryBuilder('i')
      .leftJoinAndSelect('i.assignedTo', 'assignedTo')
      .leftJoinAndSelect('i.createdBy', 'createdBy')
      .orderBy('i.createdAt', 'DESC');

    if (this.isTech(user)) {
      qb.where('assignedTo.id = :uid', { uid: user.id });
    }

    if (filters?.status)       qb.andWhere('i.status = :s',     { s: filters.status });
    if (filters?.workType)     qb.andWhere('i.workType = :wt',  { wt: filters.workType });
    if (filters?.clientName)   qb.andWhere('LOWER(i.clientName) LIKE :cn', { cn: `%${filters.clientName.toLowerCase()}%` });
    if (filters?.serialNumber) qb.andWhere('LOWER(i.serialNumber) LIKE :sn', { sn: `%${filters.serialNumber.toLowerCase()}%` });
    if (filters?.dateFrom)     qb.andWhere('i.entryDate >= :df', { df: filters.dateFrom });
    if (filters?.dateTo)       qb.andWhere('i.entryDate <= :dt', { dt: filters.dateTo });

    return qb.getMany();
  }

  async findOne(id: string, user: RequestUser): Promise<Intervention> {
    const item = await this.repo.findOne({ where: { id }, relations: ['assignedTo', 'createdBy'] });
    if (!item) throw new NotFoundException('Intervention non trouvée');
    this.assertAccess(item, user);
    return item;
  }

  async update(id: string, dto: any, user: RequestUser): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);

    if (this.isTech(user)) {
      // Technicien : uniquement les champs techniques
      const allowed = [
        'status', 'technicalDiagnosis', 'actionsPerformed', 'remarks',
        'materialsUsed', 'laborCost', 'actualExitDate', 'interventionType',
        'photos', 'workedMinutes',
      ];
      for (const key of allowed) {
        if (dto[key] !== undefined) (item as any)[key] = dto[key];
      }
      if (dto.materialsUsed) item.materialsUsed = this.mapMaterials(dto.materialsUsed);
    } else {
      // Admin : mise à jour complète
      const materials = dto.materialsUsed ? this.mapMaterials(dto.materialsUsed) : item.materialsUsed;
      Object.assign(item, dto, { materialsUsed: materials });
      if (dto.assignedToId) item.assignedTo = { id: dto.assignedToId } as any;
    }

    const { partsCost, totalPrice } = this.calcTotals(item, item);
    item.partsCost = partsCost;
    item.totalPrice = totalPrice;

    return this.repo.save(item) as Promise<Intervention>;
  }

  // ── Technicien workflow actions ───────────────────────────────────────────

  async startIntervention(id: string, user: RequestUser): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);
    if (item.status === InterventionStatus.TERMINEE) {
      throw new BadRequestException('Intervention déjà terminée');
    }
    item.status = InterventionStatus.EN_COURS;
    item.startedAt = new Date();
    return this.repo.save(item) as Promise<Intervention>;
  }

  async pauseIntervention(id: string, user: RequestUser, workedMinutes: number): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);
    item.status = InterventionStatus.EN_PAUSE;
    item.workedMinutes += workedMinutes;
    return this.repo.save(item) as Promise<Intervention>;
  }

  async finishIntervention(
    id: string,
    user: RequestUser,
    payload: {
      technicalDiagnosis?: string;
      actionsPerformed?: string;
      remarks?: string;
      materialsUsed?: any[];
      laborCost?: number;
      workedMinutes?: number;
      photos?: string[];
      clientSignature?: string;
    },
  ): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);

    item.status = InterventionStatus.TERMINEE;
    item.finishedAt = new Date();
    item.actualExitDate = new Date() as any;

    if (payload.technicalDiagnosis !== undefined) item.technicalDiagnosis = payload.technicalDiagnosis;
    if (payload.actionsPerformed !== undefined)   item.actionsPerformed   = payload.actionsPerformed;
    if (payload.remarks !== undefined)            item.remarks            = payload.remarks;
    if (payload.workedMinutes !== undefined)      item.workedMinutes      = (item.workedMinutes || 0) + payload.workedMinutes;
    if (payload.photos !== undefined)             item.photos             = payload.photos;
    if (payload.laborCost !== undefined)          item.laborCost          = payload.laborCost;
    if (payload.clientSignature) {
      item.clientSignature = payload.clientSignature;
      item.signedAt = new Date();
    }
    if (payload.materialsUsed) {
      item.materialsUsed = this.mapMaterials(payload.materialsUsed);
    }

    const { partsCost, totalPrice } = this.calcTotals(item, item);
    item.partsCost = partsCost;
    item.totalPrice = totalPrice;

    return this.repo.save(item) as Promise<Intervention>;
  }

  async addPhoto(id: string, user: RequestUser, photoBase64: string): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);
    item.photos = [...(item.photos || []), photoBase64];
    return this.repo.save(item) as Promise<Intervention>;
  }

  async saveSignature(id: string, user: RequestUser, signature: string): Promise<Intervention> {
    const item = await this.findOne(id, user);
    this.assertAccess(item, user);
    item.clientSignature = signature;
    item.signedAt = new Date();
    return this.repo.save(item) as Promise<Intervention>;
  }

  // ── History ───────────────────────────────────────────────────────────────

  async getMachineHistory(serialNumber: string): Promise<Intervention[]> {
    return this.repo.find({
      where: { serialNumber: ILike(`%${serialNumber}%`) },
      order: { createdAt: 'DESC' },
      relations: ['assignedTo'],
    });
  }

  async getClientHistory(clientName: string): Promise<Intervention[]> {
    return this.repo.find({
      where: { clientName: ILike(`%${clientName}%`) },
      order: { createdAt: 'DESC' },
      relations: ['assignedTo'],
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getTechStats(userId: string) {
    const all = await this.repo.find({
      where: { assignedTo: { id: userId } },
      relations: ['assignedTo'],
    });
    const done       = all.filter(i => i.status === InterventionStatus.TERMINEE);
    const inProgress = all.filter(i => i.status === InterventionStatus.EN_COURS);
    const totalWorkedMin = done.reduce((s, i) => s + (i.workedMinutes || 0), 0);
    return {
      total: all.length,
      done: done.length,
      inProgress: inProgress.length,
      pending: all.filter(i => i.status === InterventionStatus.EN_ATTENTE).length,
      totalEarned: done.reduce((s, i) => s + Number(i.totalPrice), 0),
      totalWorkedHours: Math.round((totalWorkedMin / 60) * 10) / 10,
    };
  }

  async getAdminStats() {
    const [total, done, inProgress, pending, paused] = await Promise.all([
      this.repo.count(),
      this.repo.count({ where: { status: InterventionStatus.TERMINEE } }),
      this.repo.count({ where: { status: InterventionStatus.EN_COURS } }),
      this.repo.count({ where: { status: InterventionStatus.EN_ATTENTE } }),
      this.repo.count({ where: { status: InterventionStatus.EN_PAUSE } }),
    ]);
    const rev = await this.repo.createQueryBuilder('i')
      .select('SUM(i.totalPrice)', 'total')
      .where('i.status = :s', { s: InterventionStatus.TERMINEE })
      .getRawOne();
    return { total, done, inProgress, pending, paused, totalRevenue: Number(rev?.total || 0) };
  }

  async remove(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}