import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// Tables dont les lignes n'ont pas de sens sans l'utilisateur : on les supprime avec lui.
const DELETE_WITH_USER_TABLES = [/notification/i];

const q = (s: string) => `"${String(s).replace(/"/g, '""')}"`;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<Partial<User>> {
    const existing = await this.usersRepository.findOne({
      where: { email: createUserDto.email },
    });
    if (existing) throw new ConflictException('Email déjà utilisé');
    const hashed = await bcrypt.hash(createUserDto.password, 12);
    const user = this.usersRepository.create({ ...createUserDto, password: hashed, isActive: true });
    const saved = await this.usersRepository.save(user);
    const { password, ...rest } = saved;
    return rest;
  }

  async findAll(): Promise<User[]> {
    return this.usersRepository.find({ select: ['id', 'email', 'name', 'phone', 'specialty', 'role', 'isActive', 'createdAt'] });
  }

  async findByRole(role: UserRole): Promise<User[]> {
    return this.usersRepository
      .createQueryBuilder('user')
      .where('user.role = :role', { role })
      .select(['user.id', 'user.email', 'user.name', 'user.phone', 'user.role', 'user.isActive'])
      .orderBy('user.name', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<Partial<User>> {
    const user = await this.findOne(id);
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 12);
    }
    Object.assign(user, updateUserDto);
    const saved = await this.usersRepository.save(user);
    const { password, ...rest } = saved;
    return rest;
  }

  async remove(id: string): Promise<void> {
    const user = await this.findOne(id);
    user.isActive = false;
    await this.usersRepository.save(user);
  }

  /**
   * Suppression définitive.
   * Détache l'utilisateur de toutes les tables qui le référencent (clé étrangère) :
   *  - colonne nullable            -> mise à NULL
   *  - table de notifications      -> lignes supprimées
   *  - colonne NOT NULL ailleurs   -> suppression refusée (409), pour ne pas détruire de données
   */
  async deleteForever(id: string): Promise<void> {
    const user = await this.findOne(id);
    const usersTable = this.usersRepository.metadata.tableName;

    await this.usersRepository.manager.transaction(async (m) => {
      const refs: { schema: string; table: string; column: string; nullable: string }[] = await m.query(
        `SELECT kcu.table_schema AS schema, kcu.table_name AS "table", kcu.column_name AS "column", c.is_nullable AS nullable
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage ccu
             ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
           JOIN information_schema.columns c
             ON c.table_schema = kcu.table_schema AND c.table_name = kcu.table_name AND c.column_name = kcu.column_name
          WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = $1`,
        [usersTable],
      );

      const blocking: string[] = [];

      for (const r of refs) {
        const target = `${q(r.schema)}.${q(r.table)}`;
        const col = q(r.column);

        if (DELETE_WITH_USER_TABLES.some((re) => re.test(r.table))) {
          await m.query(`DELETE FROM ${target} WHERE ${col} = $1`, [id]);
        } else if (r.nullable === 'YES') {
          await m.query(`UPDATE ${target} SET ${col} = NULL WHERE ${col} = $1`, [id]);
        } else {
          const [{ count }] = await m.query(`SELECT COUNT(*)::int AS count FROM ${target} WHERE ${col} = $1`, [id]);
          if (count > 0) blocking.push(`${r.table} (${count})`);
        }
      }

      if (blocking.length) {
        throw new ConflictException(
          `Suppression impossible : cet utilisateur est lié à des données (${blocking.join(', ')}). Utilisez « Désactiver » à la place.`,
        );
      }

      await m.remove(user);
    });
  }
}
