import { Module } from '@nestjs/common';
import { DeliveryGateway } from './delivery.gateway';

@Module({
  providers: [DeliveryGateway],
  exports: [DeliveryGateway],
})
export class GatewayModule {}
