import { IsString, IsOptional, IsEnum, IsObject, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportSeverity, ReportSource } from '../entities/report.entity';

export class CreateReportDto {
    @ApiProperty({
        description: 'ID of the project this report belongs to',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    projectId: string;

    @ApiProperty({
        description: 'Title of the bug report',
        example: 'Checkout button throws TypeError',
    })
    @IsString()
    title: string;

    @ApiPropertyOptional({
        description: 'Detailed description of the bug',
        example: 'When clicking the checkout button after applying a coupon, the page crashes with "Cannot read property map of undefined"',
    })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({
        description: 'Name or email of the person reporting the bug',
        example: 'john.doe@example.com',
    })
    @IsOptional()
    @IsString()
    reporter?: string;

    @ApiPropertyOptional({
        description: 'Source of the bug report',
        enum: ReportSource,
        default: ReportSource.USER,
    })
    @IsOptional()
    @IsEnum(ReportSource)
    source?: ReportSource;

    @ApiPropertyOptional({
        description: 'Severity level of the bug',
        enum: ReportSeverity,
        default: ReportSeverity.MEDIUM,
    })
    @IsOptional()
    @IsEnum(ReportSeverity)
    severity?: ReportSeverity;

    @ApiPropertyOptional({
        description: 'Environment information where the bug occurred',
        example: {
            browser: 'Chrome',
            version: '120.0',
            os: 'macOS',
            url: 'https://example.com/checkout',
        },
    })
    @IsOptional()
    @IsObject()
    env?: Record<string, any>;
}
