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
exports.InterventionsController = void 0;
const common_1 = require("@nestjs/common");
const intervention_service_1 = require("./intervention.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const user_entity_1 = require("../users/user.entity");
let InterventionsController = class InterventionsController {
    constructor(svc) {
        this.svc = svc;
    }
    create(dto, req) {
        return this.svc.create(dto, req.user.id);
    }
    findAll(req, status, workType, clientName, serialNumber, dateFrom, dateTo) {
        return this.svc.findAll(req.user, { status, workType, clientName, serialNumber, dateFrom, dateTo });
    }
    getStats(req) {
        if (req.user.role === user_entity_1.UserRole.TECHNICIEN)
            return this.svc.getTechStats(req.user.id);
        return this.svc.getAdminStats();
    }
    getMachineHistory(sn) {
        return this.svc.getMachineHistory(sn || '');
    }
    getClientHistory(cn) {
        return this.svc.getClientHistory(cn || '');
    }
    findOne(id, req) {
        return this.svc.findOne(id, req.user);
    }
    update(id, dto, req) {
        return this.svc.update(id, dto, req.user);
    }
    start(id, req) {
        return this.svc.startIntervention(id, req.user);
    }
    pause(id, workedMinutes, req) {
        return this.svc.pauseIntervention(id, req.user, workedMinutes || 0);
    }
    finish(id, payload, req) {
        return this.svc.finishIntervention(id, req.user, payload);
    }
    addPhoto(id, photo, req) {
        return this.svc.addPhoto(id, req.user, photo);
    }
    saveSignature(id, signature, req) {
        return this.svc.saveSignature(id, req.user, signature);
    }
    remove(id) {
        return this.svc.remove(id);
    }
};
exports.InterventionsController = InterventionsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.TECHNICIEN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, common_1.Query)('workType')),
    __param(3, (0, common_1.Query)('clientName')),
    __param(4, (0, common_1.Query)('serialNumber')),
    __param(5, (0, common_1.Query)('dateFrom')),
    __param(6, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('history/machine'),
    __param(0, (0, common_1.Query)('serialNumber')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "getMachineHistory", null);
__decorate([
    (0, common_1.Get)('history/client'),
    __param(0, (0, common_1.Query)('clientName')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "getClientHistory", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':id/start'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "start", null);
__decorate([
    (0, common_1.Patch)(':id/pause'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('workedMinutes')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Number, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "pause", null);
__decorate([
    (0, common_1.Patch)(':id/finish'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "finish", null);
__decorate([
    (0, common_1.Patch)(':id/photo'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('photo')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "addPhoto", null);
__decorate([
    (0, common_1.Patch)(':id/signature'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)('signature')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "saveSignature", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], InterventionsController.prototype, "remove", null);
exports.InterventionsController = InterventionsController = __decorate([
    (0, common_1.Controller)('interventions'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [intervention_service_1.InterventionsService])
], InterventionsController);
//# sourceMappingURL=intervention.controller.js.map