import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
export declare class AuthService {
    private usersService;
    private jwtService;
    constructor(usersService: UsersService, jwtService: JwtService);
    validateUser(email: string, password: string): Promise<{
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
    }>;
    login(email: string, password: string): Promise<{
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
}
