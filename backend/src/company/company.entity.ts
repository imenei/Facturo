import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('company')
export class Company {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'Mon Entreprise' })
  name: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  nif: string;

  @Column({ nullable: true })
  nis: string;

  @Column({ nullable: true })
  rc: string;

  @Column({ nullable: true })
  ai: string;

  @Column({ nullable: true })
  rib: string;

  @Column({ nullable: true })
  bank: string;

  @Column({ nullable: true, type: 'text' })
  logo: string; // base64 or URL

  @Column({ nullable: true })
  logoUrl: string; // from upload endpoint (mod #11)

  @Column({ nullable: true, type: 'text' })
  signature: string; // base64

  @Column({ nullable: true, type: 'text' })
  stamp: string; // base64

  @Column({ nullable: true, type: 'text' })
  legalMentions: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
