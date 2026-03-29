import { CompanyService } from './company.service';
export declare class CompanyController {
    private readonly companyService;
    constructor(companyService: CompanyService);
    get(): Promise<import("./company.entity").Company>;
    update(dto: any): Promise<import("./company.entity").Company>;
}
