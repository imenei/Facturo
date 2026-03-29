import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  reference: string;

  @Column({ nullable: true })
  unit: string; // pièce, kg, litre, etc.

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  purchasePrice: number; // Prix d'achat

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  salePrice: number; // Prix de vente — doit toujours être > purchasePrice

  @Column({ nullable: true, type: 'text' })
  logoUrl: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
