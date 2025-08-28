import {
    Controller,
    Post,
    Get,
    Body,
    Param,
    ParseUUIDPipe,
    UseGuards,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReprosService } from './services/repros.service';
import { CreateReproDto } from './dto/create-repro.dto';
import { Repro } from '../reports/entities/repro.entity';

@ApiTags('repros')
@Controller('repros')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReprosController {
    constructor(private readonly reprosService: ReprosService) { }

    @Post('generate')
    @ApiOperation({
        summary: 'Generate reproduction test from report',
        description: 'Creates a test case with fixtures and environment configuration based on the provided report'
    })
    @ApiResponse({
        status: 201,
        description: 'Reproduction generated successfully',
        type: Repro,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async generate(@Body() createReproDto: CreateReproDto): Promise<Repro> {
        return this.reprosService.generate(createReproDto);
    }

    @Post('plan')
    @ApiOperation({
        summary: 'Plan reproduction strategy for report',
        description: 'Analyzes report and signals to determine the best reproduction strategy'
    })
    @ApiResponse({
        status: 200,
        description: 'Reproduction plan generated',
        schema: {
            type: 'object',
            properties: {
                framework: { type: 'string', example: 'playwright' },
                strategy: { type: 'string', example: 'web_ui' },
                confidence: { type: 'number', example: 0.85 },
                estimated_steps: { type: 'number', example: 12 },
                recommendations: {
                    type: 'array',
                    items: { type: 'string' },
                },
            },
        },
    })
    async plan(@Body() createReproDto: CreateReproDto): Promise<any> {
        return this.reprosService.plan(createReproDto);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get reproduction by ID' })
    @ApiParam({
        name: 'id',
        description: 'Reproduction ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Reproduction retrieved successfully',
        type: Repro,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Reproduction not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Repro> {
        return this.reprosService.findOne(id);
    }

    @Post(':id/validate')
    @ApiOperation({
        summary: 'Validate reproduction by running tests',
        description: 'Executes the generated test case multiple times to validate reproducibility'
    })
    @ApiParam({
        name: 'id',
        description: 'Reproduction ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Validation completed',
        schema: {
            type: 'object',
            properties: {
                reproId: { type: 'string' },
                runs: { type: 'number' },
                passed: { type: 'number' },
                failed: { type: 'number' },
                stability_score: { type: 'number' },
                minimized_steps: { type: 'number' },
                status: { type: 'string' },
            },
        },
    })
    async validate(
        @Param('id', ParseUUIDPipe) id: string,
        @Body('runs') runs: number = 5,
        @Body('determinism') determinism?: any,
    ): Promise<any> {
        return this.reprosService.validate(id, runs, determinism);
    }

    @Get(':id/artifacts')
    @ApiOperation({
        summary: 'Get reproduction artifacts',
        description: 'Retrieve generated test files, fixtures, and environment configuration'
    })
    @ApiParam({
        name: 'id',
        description: 'Reproduction ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Artifacts retrieved successfully',
        schema: {
            type: 'object',
            properties: {
                test_script: { type: 'string' },
                fixtures: { type: 'object' },
                compose_config: { type: 'object' },
                readme: { type: 'string' },
                download_urls: {
                    type: 'object',
                    properties: {
                        test_package: { type: 'string' },
                        fixtures: { type: 'string' },
                        compose: { type: 'string' },
                    },
                },
            },
        },
    })
    async getArtifacts(@Param('id', ParseUUIDPipe) id: string): Promise<any> {
        return this.reprosService.getArtifacts(id);
    }
}
