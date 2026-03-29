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
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const user_entity_1 = require("../users/user.entity");
let NotificationsController = class NotificationsController {
    constructor(notificationsService) {
        this.notificationsService = notificationsService;
    }
    sendReminder(invoiceId, body) {
        const channels = body.channels || { email: true };
        return this.notificationsService.sendAllReminders(invoiceId, channels);
    }
    sendEmail(invoiceId) {
        return this.notificationsService.sendEmailReminder(invoiceId);
    }
    sendWhatsApp(invoiceId) {
        return this.notificationsService.sendWhatsAppReminder(invoiceId);
    }
    sendSms(invoiceId) {
        return this.notificationsService.sendSmsReminder(invoiceId);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Post)('send-reminder/:invoiceId'),
    __param(0, (0, common_1.Param)('invoiceId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "sendReminder", null);
__decorate([
    (0, common_1.Post)('send-reminder/:invoiceId/email'),
    __param(0, (0, common_1.Param)('invoiceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "sendEmail", null);
__decorate([
    (0, common_1.Post)('send-reminder/:invoiceId/whatsapp'),
    __param(0, (0, common_1.Param)('invoiceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "sendWhatsApp", null);
__decorate([
    (0, common_1.Post)('send-reminder/:invoiceId/sms'),
    __param(0, (0, common_1.Param)('invoiceId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], NotificationsController.prototype, "sendSms", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)('notifications'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_entity_1.UserRole.ADMIN, user_entity_1.UserRole.COMMERCIAL),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map