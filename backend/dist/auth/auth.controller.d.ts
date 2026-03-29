import { AuthService } from './auth.service';
declare class LoginDto {
    email: string;
    password: string;
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    login(loginDto: LoginDto): Promise<{
        access_token: string;
        user: {
            id: string;
            email: string;
            name: string;
            phone: string;
            role: import("../users/user.entity").UserRole;
            isActive: boolean;
            invoices: import("../invoices/invoice.entity").Invoice[];
            tasks: import("../tasks/task.entity").Task[];
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
    getProfile(req: any): any;
}
export {};
