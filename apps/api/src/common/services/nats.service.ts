import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nats from 'nats';

@Injectable()
export class NATSClient implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(NATSClient.name);
    private client: nats.NatsConnection | null = null;

    constructor(private configService: ConfigService) { }

    async onModuleInit() {
        try {
            const natsUrl = this.configService.get<string>('NATS_URL', 'nats://localhost:4222');
            this.client = await nats.connect({ servers: natsUrl });
            this.logger.log('Connected to NATS');
        } catch (error) {
            this.logger.error('Failed to connect to NATS', error);
        }
    }

    async onModuleDestroy() {
        if (this.client) {
            await this.client.close();
            this.logger.log('Disconnected from NATS');
        }
    }

    async publish(subject: string, data: any): Promise<void> {
        if (!this.client) {
            throw new Error('NATS client not connected');
        }

        try {
            const payload = JSON.stringify(data);
            this.client.publish(subject, Buffer.from(payload));
            this.logger.debug(`Published message to ${subject}`);
        } catch (error) {
            this.logger.error(`Failed to publish message to ${subject}`, error);
            throw error;
        }
    }

    async subscribe(subject: string, callback: (data: any) => void): Promise<void> {
        if (!this.client) {
            throw new Error('NATS client not connected');
        }

        try {
            const subscription = this.client.subscribe(subject);

            for await (const msg of subscription) {
                try {
                    const data = JSON.parse(msg.data.toString());
                    await callback(data);
                } catch (error) {
                    this.logger.error(`Error processing message from ${subject}`, error);
                }
            }
        } catch (error) {
            this.logger.error(`Failed to subscribe to ${subject}`, error);
            throw error;
        }
    }
}
