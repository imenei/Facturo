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
var DeliveryGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeliveryGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const common_1 = require("@nestjs/common");
let DeliveryGateway = DeliveryGateway_1 = class DeliveryGateway {
    constructor() {
        this.logger = new common_1.Logger(DeliveryGateway_1.name);
    }
    handleConnection(client) {
        this.logger.log(`Client connected: ${client.id}`);
        const role = client.handshake.query.role;
        const userId = client.handshake.query.userId;
        if (role)
            client.join(`role:${role}`);
        if (userId)
            client.join(`user:${userId}`);
    }
    handleDisconnect(client) {
        this.logger.log(`Client disconnected: ${client.id}`);
    }
    handleJoinTask(taskId, client) {
        client.join(`task:${taskId}`);
        return { event: 'joined', data: taskId };
    }
    emitDeliveryStatusUpdated(taskId, payload) {
        this.server.to('role:admin').to('role:commercial').emit('delivery:status-updated', {
            taskId,
            ...payload,
            timestamp: new Date().toISOString(),
        });
        this.server.to(`task:${taskId}`).emit('delivery:status-updated', {
            taskId,
            ...payload,
            timestamp: new Date().toISOString(),
        });
    }
    emitTaskAssigned(userId, task) {
        this.server.to(`user:${userId}`).emit('task:assigned', {
            task,
            timestamp: new Date().toISOString(),
        });
    }
    emitReminderSent(clientName, invoiceNumber) {
        this.server.to('role:admin').emit('notification:reminder-sent', {
            clientName,
            invoiceNumber,
            timestamp: new Date().toISOString(),
        });
    }
};
exports.DeliveryGateway = DeliveryGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], DeliveryGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join:task'),
    __param(0, (0, websockets_1.MessageBody)()),
    __param(1, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, socket_io_1.Socket]),
    __metadata("design:returntype", void 0)
], DeliveryGateway.prototype, "handleJoinTask", null);
exports.DeliveryGateway = DeliveryGateway = DeliveryGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            credentials: true,
        },
        namespace: '/realtime',
    })
], DeliveryGateway);
//# sourceMappingURL=delivery.gateway.js.map