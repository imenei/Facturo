import { Response } from 'express';
export declare class UploadController {
    uploadLogo(file: Express.Multer.File): {
        url: string;
        filename: string;
        originalName: string;
        size: number;
    };
    serveLogo(filename: string, res: Response): Response<any, Record<string, any>> | undefined;
    deleteLogo(filename: string): {
        success: boolean;
        message: string;
    };
}
