import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './company.entity';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepository: Repository<Company>,
  ) {}

  async get(): Promise<Company> {
    let company = await this.companyRepository.findOne({ where: {} });
    if (!company) {
      company = this.companyRepository.create({ name: 'Mon Entreprise' });
      await this.companyRepository.save(company);
    }
    return company;
  }

  async update(dto: Partial<Company>): Promise<Company> {
    const company = await this.get();
    Object.assign(company, dto);
    return this.companyRepository.save(company);
  }
}
