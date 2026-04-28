import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DocumentTemplate, TemplateType } from './template.entity';

// Static definitions of the 5 template types
export const TEMPLATE_TYPES = [
  {
    type: TemplateType.CLASSIC,
    name: 'Classic',
    description: 'Mise en page standard, logo en haut à gauche, tableau simple',
    logoPosition: 'left',
  },
  {
    type: TemplateType.COMPACT,
    name: 'Compact',
    description: 'Informations condensées, gain de place, idéal pour petites factures',
    logoPosition: 'left',
  },
  {
    type: TemplateType.DETAILED,
    name: 'Detailed',
    description: 'Mise en page détaillée avec sections bien séparées et sous-totaux visibles',
    logoPosition: 'left',
  },
  {
    type: TemplateType.CORPORATE,
    name: 'Corporate',
    description: 'Logo centré, informations entreprise en évidence, structure formelle',
    logoPosition: 'center',
  },
  {
    type: TemplateType.TABLE_FOCUS,
    name: 'Table Focus',
    description: 'Accent sur le tableau produits, colonnes larges et lisibles',
    logoPosition: 'right',
  },
];

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(DocumentTemplate)
    private templatesRepo: Repository<DocumentTemplate>,
  ) {}

  // GET /templates/types — 5 types disponibles (static)
  getTypes() {
    return TEMPLATE_TYPES;
  }

  async findAll(): Promise<DocumentTemplate[]> {
    return this.templatesRepo.find({ where: { isActive: true }, order: { createdAt: 'ASC' } });
  }

  async findOne(id: string): Promise<DocumentTemplate> {
    const t = await this.templatesRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Template non trouvé');
    return t;
  }

  async getDefault(): Promise<DocumentTemplate | null> {
    return this.templatesRepo.findOne({ where: { isDefault: true, isActive: true } });
  }

  async create(dto: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    const t = this.templatesRepo.create(dto);
    return this.templatesRepo.save(t);
  }

  async update(id: string, dto: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
    const t = await this.findOne(id);
    Object.assign(t, dto);
    return this.templatesRepo.save(t);
  }

  async setDefault(id: string): Promise<DocumentTemplate> {
    const t = await this.findOne(id);
    // Unset defaults only on existing active templates to avoid empty criteria updates.
    await this.templatesRepo
      .createQueryBuilder()
      .update(DocumentTemplate)
      .set({ isDefault: false })
      .where('isDefault = :isDefault', { isDefault: true })
      .execute();
    t.isDefault = true;
    return this.templatesRepo.save(t);
  }

  async remove(id: string): Promise<void> {
    const t = await this.findOne(id);
    t.isActive = false;
    await this.templatesRepo.save(t);
  }

  async seedDefaults(): Promise<void> {
    const count = await this.templatesRepo.count();
    if (count > 0) return;
    for (const [i, tmpl] of TEMPLATE_TYPES.entries()) {
      await this.templatesRepo.save(
        this.templatesRepo.create({ ...tmpl, isDefault: i === 0, isActive: true }),
      );
    }
  }
}
