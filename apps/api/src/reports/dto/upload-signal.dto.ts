import { IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SignalKind } from '../entities/signal.entity';

export class UploadSignalDto {
    @ApiProperty({
        description: 'Type of signal file being uploaded',
        enum: SignalKind,
        example: SignalKind.HAR,
    })
    @IsEnum(SignalKind)
    kind: SignalKind;

    @ApiPropertyOptional({
        description: 'Additional metadata for the signal',
        example: {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            timestamp: '2024-01-15T10:30:00Z',
            url: 'https://example.com/checkout',
        },
    })
    @IsOptional()
    @IsObject()
    meta?: Record<string, any>;
}
