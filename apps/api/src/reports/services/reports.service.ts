import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Report, ReportSeverity, ReportSource } from '../entities/report.entity';
import { Signal, SignalKind } from '../entities/signal.entity';
import { CreateReportDto } from '../dto/create-report.dto';
import { UploadSignalDto } from '../dto/upload-signal.dto';

@Injectable()
export class ReportsService {
    constructor(
        @InjectRepository(Report)
        private readonly reportsRepository: Repository<Report>,
        @InjectRepository(Signal)
        private readonly signalsRepository: Repository<Signal>,
    ) { }

    async create(createReportDto: CreateReportDto): Promise<Report> {
        const report = this.reportsRepository.create({
            ...createReportDto,
            severity: createReportDto.severity || ReportSeverity.MEDIUM,
            source: createReportDto.source || ReportSource.USER,
        });

        return this.reportsRepository.save(report);
    }

    async findAll(projectId?: string): Promise<Report[]> {
        const query = this.reportsRepository
            .createQueryBuilder('report')
            .leftJoinAndSelect('report.project', 'project')
            .leftJoinAndSelect('report.signals', 'signals')
            .orderBy('report.createdAt', 'DESC');

        if (projectId) {
            query.where('report.projectId = :projectId', { projectId });
        }

        return query.getMany();
    }

    async findOne(id: string): Promise<Report> {
        const report = await this.reportsRepository
            .createQueryBuilder('report')
            .leftJoinAndSelect('report.project', 'project')
            .leftJoinAndSelect('report.signals', 'signals')
            .leftJoinAndSelect('report.mappings', 'mappings')
            .leftJoinAndSelect('report.repros', 'repros')
            .where('report.id = :id', { id })
            .getOne();

        if (!report) {
            throw new NotFoundException(`Report with ID ${id} not found`);
        }

        return report;
    }

    async update(id: string, updateData: Partial<CreateReportDto>): Promise<Report> {
        const report = await this.findOne(id);

        Object.assign(report, updateData);
        return this.reportsRepository.save(report);
    }

    async remove(id: string): Promise<void> {
        const report = await this.findOne(id);
        await this.reportsRepository.remove(report);
    }

    async uploadSignal(
        reportId: string,
        uploadSignalDto: UploadSignalDto,
        file: Express.Multer.File,
        s3Key: string,
    ): Promise<Signal> {
        // Verify report exists
        await this.findOne(reportId);

        const signal = this.signalsRepository.create({
            reportId,
            kind: uploadSignalDto.kind,
            s3Key,
            meta: uploadSignalDto.meta || {},
        });

        return this.signalsRepository.save(signal);
    }

    async getSignals(reportId: string): Promise<Signal[]> {
        return this.signalsRepository.find({
            where: { reportId },
            order: { createdAt: 'ASC' },
        });
    }

    async removeSignal(reportId: string, signalId: string): Promise<void> {
        const signal = await this.signalsRepository.findOne({
            where: { id: signalId, reportId },
        });

        if (!signal) {
            throw new NotFoundException(`Signal with ID ${signalId} not found for report ${reportId}`);
        }

        await this.signalsRepository.remove(signal);
    }
}
