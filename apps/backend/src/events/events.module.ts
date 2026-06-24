import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { SseController } from './sse.controller';
import { SseGateway } from './sse.gateway';

@Global()
@Module({
  controllers: [SseController],
  providers: [EventBusService, SseGateway],
  exports: [EventBusService, SseGateway],
})
export class EventsModule {}
