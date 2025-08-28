import {
    Controller,
    Get,
    Post,
    Body,
    Param,
    Delete,
    UseGuards,
    UseInterceptors,
    UploadedFile,
    Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiConsumes,
    ApiBody,
    ApiBearerAuth,
    ApiParam,
    ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './services/reports.service';
import { S3Service } from './services/s3.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UploadSignalDto } from './dto/upload-signal.dto';
import { Report } from './entities/report.entity';
import { Signal } from './entities/signal.entity';

@ApiTags('reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT-auth')
export class ReportsController {
    constructor(
        private readonly reportsService: ReportsService,
        private readonly s3Service: S3Service,
    ) { }

    @Post()
    @ApiOperation({ summary: 'Create a new bug report' })
    @ApiResponse({
        status: 201,
        description: 'Report created successfully',
        type: Report,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    async create(@Body() createReportDto: CreateReportDto): Promise<Report> {
        return this.reportsService.create(createReportDto);
    }

    @Get()
    @ApiOperation({ summary: 'Get all bug reports' })
    @ApiResponse({
        status: 200,
        description: 'Reports retrieved successfully',
        type: [Report],
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiQuery({
        name: 'projectId',
        required: false,
        description: 'Filter by project ID',
    })
    async findAll(@Query('projectId') projectId?: string): Promise<Report[]> {
        return this.reportsService.findAll(projectId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get a bug report by ID' })
    @ApiParam({
        name: 'id',
        description: 'Report ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Report retrieved successfully',
        type: Report,
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Report> {
        return this.reportsService.findOne(id);
    }

    @Post(':id/signals')
    @ApiOperation({ summary: 'Upload a signal file (HAR, screenshot, video, log)' })
    @ApiParam({
        name: 'id',
        description: 'Report ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiConsumes('multipart/form-data')
    @ApiBody({
        description: 'Signal file upload',
        schema: {
            type: 'object',
            properties: {
                kind: {
                    type: 'string',
                    enum: ['har', 'screenshot', 'video', 'log'],
                    example: 'har',
                },
                meta: {
                    type: 'object',
                    description: 'Additional metadata',
                },
                file: {
                    type: 'string',
                    format: 'binary',
                    description: 'File to upload',
                },
            },
        },
    })
    @UseInterceptors(FileInterceptor('file'))
    @ApiResponse({
        status: 201,
        description: 'Signal uploaded successfully',
        type: Signal,
    })
    @ApiResponse({ status: 400, description: 'Bad request' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async uploadSignal(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() uploadSignalDto: UploadSignalDto,
        @UploadedFile() file: Express.Multer.File,
    ): Promise<Signal> {
        // Upload file to S3
        const s3Key = this.s3Service.generateKey(
            `signals/${id}/${uploadSignalDto.kind}`,
            file.originalname,
        );

        await this.s3Service.uploadFile(s3Key, file);

        // Create signal record in database
        return this.reportsService.uploadSignal(id, uploadSignalDto, file, s3Key);
    }

    @Get(':id/signals')
    @ApiOperation({ summary: 'Get all signals for a report' })
    @ApiParam({
        name: 'id',
        description: 'Report ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiResponse({
        status: 200,
        description: 'Signals retrieved successfully',
        type: [Signal],
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Report not found' })
    async getSignals(@Param('id', ParseUUIDPipe) id: string): Promise<Signal[]> {
        return this.reportsService.getSignals(id);
    }

    @Delete(':reportId/signals/:signalId')
    @ApiOperation({ summary: 'Delete a signal from a report' })
    @ApiParam({
        name: 'reportId',
        description: 'Report ID',
        example: '123e4567-e89b-12d3-a456-426614174000',
    })
    @ApiParam({
        name: 'signalId',
        description: 'Signal ID',
        example: '456e7890-e89b-12d3-a456-426614174001',
    })
    @ApiResponse({
        status: 200,
        description: 'Signal deleted successfully',
    })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 404, description: 'Signal or report not found' })
    async removeSignal(
        @Param('reportId', ParseUUIDPipe) reportId: string,
        @Param('signalId', ParseUUIDPipe) signalId: string,
    ): Promise<void> {
        return this.reportsService.removeSignal(reportId, signalId);
    }
}
