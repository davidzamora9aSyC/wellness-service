import { Module } from '@nestjs/common';
import { WellnessController } from './wellness.controller';
import { WellnessService } from './wellness.service';
import { WellnessEventsPublisher } from './wellness-events.publisher';

@Module({
  controllers: [WellnessController],
  providers: [WellnessService, WellnessEventsPublisher],
})
export class WellnessModule {}
