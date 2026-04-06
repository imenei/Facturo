"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const task_entity_1 = require("./task.entity");
const user_entity_1 = require("../users/user.entity");
let TasksService = class TasksService {
    constructor(tasksRepository) {
        this.tasksRepository = tasksRepository;
    }
    async create(dto, adminId) {
        const task = this.tasksRepository.create({
            name: dto.name,
            description: dto.description,
            price: dto.price,
            dueDate: dto.dueDate || null,
            deliveryDate: dto.deliveryDate || null,
            clientName: dto.clientName || null,
            clientLogoUrl: dto.clientLogoUrl || null,
            clientAddress: dto.clientAddress || null,
            createdBy: { id: adminId },
            assignedTo: { id: dto.assignedToId },
        });
        return this.tasksRepository.save(task);
    }
    async findAll(user) {
        if (user.role === user_entity_1.UserRole.ADMIN) {
            return this.tasksRepository.find({ order: { createdAt: 'DESC' }, relations: ['assignedTo', 'createdBy'] });
        }
        return this.tasksRepository.find({
            where: { assignedTo: { id: user.id } },
            order: { createdAt: 'DESC' },
            relations: ['assignedTo', 'createdBy'],
        });
    }
    async findOne(id, user) {
        const task = await this.tasksRepository.findOne({ where: { id }, relations: ['assignedTo', 'createdBy'] });
        if (!task)
            throw new common_1.NotFoundException('Tâche non trouvée');
        if (user.role === user_entity_1.UserRole.LIVREUR && task.assignedTo.id !== user.id) {
            throw new common_1.ForbiddenException('Accès refusé');
        }
        return task;
    }
    async update(id, dto, user) {
        const task = await this.findOne(id, user);
        if (user.role === user_entity_1.UserRole.LIVREUR) {
            if (dto.status)
                task.status = dto.status;
            if (dto.remarks !== undefined)
                task.remarks = dto.remarks;
            if (dto.status === task_entity_1.TaskStatus.TERMINEE)
                task.completedAt = new Date();
        }
        else {
            Object.assign(task, dto);
            if (dto.assignedToId)
                task.assignedTo = { id: dto.assignedToId };
        }
        return this.tasksRepository.save(task);
    }
    async remove(id) {
        await this.tasksRepository.delete(id);
    }
    async getLivreurStats(userId) {
        const tasks = await this.tasksRepository.find({ where: { assignedTo: { id: userId } } });
        const completed = tasks.filter((t) => t.status === task_entity_1.TaskStatus.TERMINEE);
        const totalEarned = completed.reduce((sum, t) => sum + Number(t.price), 0);
        return { total: tasks.length, completed: completed.length, pending: tasks.filter(t => t.status === task_entity_1.TaskStatus.EN_ATTENTE).length, totalEarned };
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], TasksService);
//# sourceMappingURL=tasks.service.js.map