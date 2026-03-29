import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum TemplateType {
  CLASSIC = 'classic',
  COMPACT = 'compact',
  DETAILED = 'detailed',
  CORPORATE = 'corporate',
  TABLE_FOCUS = 'table_focus',
}

@Entity('document_templates')
export class DocumentTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: TemplateType })
  type: TemplateType;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ default: false })
  isDefault: boolean;

  @Column({ default: true })
  isActive: boolean;

  // Optional header/footer customization
  @Column({ nullable: true, type: 'text' })
  headerText: string;

  @Column({ nullable: true, type: 'text' })
  footerText: string;

  // Logo position: left | center | right
  @Column({ default: 'left' })
  logoPosition: string;

  @Column({ default: true })
  showSignature: boolean;

  @Column({ default: true })
  showStamp: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
