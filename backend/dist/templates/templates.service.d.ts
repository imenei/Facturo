import { Repository } from 'typeorm';
import { DocumentTemplate, TemplateType } from './template.entity';
export declare const TEMPLATE_TYPES: {
    type: TemplateType;
    name: string;
    description: string;
    logoPosition: string;
}[];
export declare class TemplatesService {
    private templatesRepo;
    constructor(templatesRepo: Repository<DocumentTemplate>);
    getTypes(): {
        type: TemplateType;
        name: string;
        description: string;
        logoPosition: string;
    }[];
    findAll(): Promise<DocumentTemplate[]>;
    findOne(id: string): Promise<DocumentTemplate>;
    getDefault(): Promise<DocumentTemplate | null>;
    create(dto: Partial<DocumentTemplate>): Promise<DocumentTemplate>;
    update(id: string, dto: Partial<DocumentTemplate>): Promise<DocumentTemplate>;
    setDefault(id: string): Promise<DocumentTemplate>;
    remove(id: string): Promise<void>;
    seedDefaults(): Promise<void>;
}
