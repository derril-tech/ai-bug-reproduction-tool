import { Module } from '@nestjs/common';
import { NATSClient } from './services/nats.service';

@Module({
    providers: [NATSClient],
    exports: [NATSClient],
})
export class CommonModule { }
