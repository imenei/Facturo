import { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
export declare class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
    server: Server;
    private readonly logger;
    handleConnection(client: Socket): void;
    handleDisconnect(client: Socket): void;
    handleJoinTask(taskId: string, client: Socket): {
        event: string;
        data: string;
    };
    emitDeliveryStatusUpdated(taskId: string, payload: any): void;
    emitTaskAssigned(userId: string, task: any): void;
    emitReminderSent(clientName: string, invoiceNumber: string): void;
}
