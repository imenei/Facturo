import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const hashed = await bcrypt.hash(createUserDto.password, 12);
    const user = this.usersRepository.create({ ...createUserDto, password: hashed });
    return this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ select: ['id', 'email', 'name', 'phone', 'role', 'isActive', 'createdAt'] });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.usersRepository.find({
      where: { role, isActive: true },
      select: ['id', 'email', 'name', 'phone', 'role', 'isActive'],
    });
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }
    Object.assign(user, updateUserDto);
    return this.usersRepository.save(user);
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
  }
}
