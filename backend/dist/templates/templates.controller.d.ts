import { TemplatesService } from './templates.service';
export declare class TemplatesController {
    private readonly templatesService;
    constructor(templatesService: TemplatesService);
    getTypes(): {
        type: import("./template.entity").TemplateType;
        name: string;
        description: string;
        logoPosition: string;
    }[];
    findAll(): Promise<import("./template.entity").DocumentTemplate[]>;
    getDefault(): Promise<import("./template.entity").DocumentTemplate>;
    findOne(id: string): Promise<import("./template.entity").DocumentTemplate>;
    create(dto: any): Promise<import("./template.entity").DocumentTemplate>;
    update(id: string, dto: any): Promise<import("./template.entity").DocumentTemplate>;
    setDefault(id: string): Promise<import("./template.entity").DocumentTemplate>;
    remove(id: string): Promise<void>;
}
