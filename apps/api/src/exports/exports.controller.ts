import { Controller, Get, Post, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/create-export.dto';
import { ExportType } from './entities/export.entity';

@Controller('v1/exports')
export class ExportsController {
    constructor(private readonly exportsService: ExportsService) { }

    @Post()
    async create(@Body() createExportDto: CreateExportDto) {
        return this.exportsService.create(createExportDto);
    }

    @Post('pr')
    async createPR(@Body() createExportDto: CreateExportDto) {
        return this.exportsService.create({
            ...createExportDto,
            export_type: ExportType.PR,
        });
    }

    @Post('sandbox')
    async createSandbox(@Body() createExportDto: CreateExportDto) {
        return this.exportsService.create({
            ...createExportDto,
            export_type: ExportType.SANDBOX,
        });
    }

    @Post('docker')
    async createDocker(@Body() createExportDto: CreateExportDto) {
        return this.exportsService.create({
            ...createExportDto,
            export_type: ExportType.DOCKER,
        });
    }

    @Post('report')
    async createReport(@Body() createExportDto: CreateExportDto) {
        return this.exportsService.create({
            ...createExportDto,
            export_type: ExportType.REPORT,
        });
    }

    @Get()
    async findAll() {
        return this.exportsService.findAll();
    }

    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.exportsService.findOne(id);
    }

    @Get('repro/:reproId')
    async findByReproId(@Param('reproId', ParseUUIDPipe) reproId: string) {
        return this.exportsService.findByReproId(reproId);
    }
}

@Controller('v1/repros')
export class ReproArtifactsController {
    constructor(private readonly exportsService: ExportsService) { }

    @Get(':id/artifacts')
    async getArtifacts(@Param('id', ParseUUIDPipe) id: string) {
        return this.exportsService.getArtifacts(id);
    }
}
