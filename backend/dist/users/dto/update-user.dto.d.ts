import { UserRole } from '../user.entity';
export declare class UpdateUserDto {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    role?: UserRole;
    isActive?: boolean;
}
