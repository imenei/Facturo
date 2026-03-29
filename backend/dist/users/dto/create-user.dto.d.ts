import { UserRole } from '../user.entity';
export declare class CreateUserDto {
    email: string;
    password: string;
    name: string;
    phone?: string;
    role: UserRole;
}
