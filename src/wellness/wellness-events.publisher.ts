import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { connect, type Channel, type Connection } from 'amqplib';

type WellnessEventPayload = {
  sessionId: string;
  authUserId: string;
  audience: string;
  compliancePct: number;
  motionLevelAvg: number | null;
  scoreGain: number;
  score: number;
};

@Injectable()
export class WellnessEventsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WellnessEventsPublisher.name);
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private readonly exchange: string;

  constructor(private readonly config: ConfigService) {
    this.exchange = this.config.get<string>('RABBITMQ_EXCHANGE_WELLNESS') ?? 'wellness.events';
  }

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.warn('RABBITMQ_URL no configurado; eventos de wellness deshabilitados');
      return;
    }
    try {
      this.connection = await connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    } catch (error) {
      this.logger.warn(`No se pudo conectar a RabbitMQ: ${(error as Error).message}`);
    }
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  publishSessionCompleted(payload: WellnessEventPayload) {
    if (!this.channel) return;
    const body = Buffer.from(JSON.stringify(payload));
    this.channel.publish(this.exchange, 'wellness.session.completed', body, {
      contentType: 'application/json',
      persistent: true,
    });
  }
}
