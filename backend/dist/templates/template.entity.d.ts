export declare enum TemplateType {
    CLASSIC = "classic",
    COMPACT = "compact",
    DETAILED = "detailed",
    CORPORATE = "corporate",
    TABLE_FOCUS = "table_focus"
}
export declare class DocumentTemplate {
    id: string;
    name: string;
    type: TemplateType;
    description: string;
    isDefault: boolean;
    isActive: boolean;
    headerText: string;
    footerText: string;
    logoPosition: string;
    showSignature: boolean;
    showStamp: boolean;
    createdAt: Date;
    updatedAt: Date;
}
