import { Repository } from 'typeorm';
import { Company } from './company.entity';
export declare class CompanyService {
    private companyRepository;
    constructor(companyRepository: Repository<Company>);
    get(): Promise<Company>;
    update(dto: Partial<Company>): Promise<Company>;
}
