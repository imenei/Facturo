import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/realtime',
})
export class DeliveryGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DeliveryGateway.name);

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    // Join role-based rooms
    const role = client.handshake.query.role as string;
    const userId = client.handshake.query.userId as string;
    if (role) client.join(`role:${role}`);
    if (userId) client.join(`user:${userId}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join:task')
  handleJoinTask(@MessageBody() taskId: string, @ConnectedSocket() client: Socket) {
    client.join(`task:${taskId}`);
    return { event: 'joined', data: taskId };
  }

  // Emit delivery status update to all admins and commercials
  emitDeliveryStatusUpdated(taskId: string, payload: any) {
    this.server.to('role:admin').to('role:commercial').emit('delivery:status-updated', {
      taskId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
    // Also emit to the specific task room
    this.server.to(`task:${taskId}`).emit('delivery:status-updated', {
      taskId,
      ...payload,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit to a specific livreur when a new task is assigned
  emitTaskAssigned(userId: string, task: any) {
    this.server.to(`user:${userId}`).emit('task:assigned', {
      task,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit notification reminder sent
  emitReminderSent(clientName: string, invoiceNumber: string) {
    this.server.to('role:admin').emit('notification:reminder-sent', {
      clientName,
      invoiceNumber,
      timestamp: new Date().toISOString(),
    });
  }
}
