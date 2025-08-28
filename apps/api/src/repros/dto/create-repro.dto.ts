import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ReproTarget {
    WEB = 'web',
    API = 'api',
    CLI = 'cli',
}

export enum ReproFramework {
    PLAYWRIGHT = 'playwright',
    CYPRESS = 'cypress',
    PUPPETEER = 'puppeteer',
    JEST = 'jest',
    PYTEST = 'pytest',
    MOCHA = 'mocha',
    JASMINE = 'jasmine',
    WEBDRIVER = 'webdriver',
    SELENIUM = 'selenium',
}

export class CreateReproDto {
    @ApiProperty({
        description: 'ID of the report to generate reproduction for',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsUUID()
    reportId: string;

    @ApiPropertyOptional({
        description: 'Target type for the reproduction',
        enum: ReproTarget,
        default: ReproTarget.WEB,
    })
    @IsOptional()
    @IsEnum(ReproTarget)
    target?: ReproTarget;

    @ApiPropertyOptional({
        description: 'Preferred testing framework',
        enum: ReproFramework,
        default: ReproFramework.PLAYWRIGHT,
    })
    @IsOptional()
    @IsEnum(ReproFramework)
    framework?: ReproFramework;

    @ApiPropertyOptional({
        description: 'Additional options for test generation',
        example: {
            enable_screenshots: true,
            enable_video_recording: false,
            max_steps: 50,
            browser: 'chromium',
        },
    })
    @IsOptional()
    options?: Record<string, any>;
}
