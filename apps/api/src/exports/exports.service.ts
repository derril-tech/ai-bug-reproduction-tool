import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Export, ExportType, ExportStatus } from './entities/export.entity';
import { CreateExportDto } from './dto/create-export.dto';
import { NATSClient } from '../common/services/nats.service';

@Injectable()
export class ExportsService {
    private readonly logger = new Logger(ExportsService.name);

    constructor(
        @InjectRepository(Export)
        private exportsRepository: Repository<Export>,
        private natsClient: NATSClient,
    ) { }

    async create(createExportDto: CreateExportDto): Promise<Export> {
        const export_ = this.exportsRepository.create({
            ...createExportDto,
            status: ExportStatus.PENDING,
        });

        const savedExport = await this.exportsRepository.save(export_);

        // Publish export request to NATS
        await this.natsClient.publish('export.request', {
            export_id: savedExport.id,
            repro_id: createExportDto.repro_id,
            export_type: createExportDto.export_type,
            options: createExportDto.options || {},
        });

        this.logger.log(`Created export ${savedExport.id} for repro ${createExportDto.repro_id}`);

        return savedExport;
    }

    async findAll(): Promise<Export[]> {
        return this.exportsRepository.find({
            relations: ['repro'],
            order: { created_at: 'DESC' },
        });
    }

    async findOne(id: string): Promise<Export> {
        return this.exportsRepository.findOne({
            where: { id },
            relations: ['repro'],
        });
    }

    async findByReproId(reproId: string): Promise<Export[]> {
        return this.exportsRepository.find({
            where: { repro_id: reproId },
            order: { created_at: 'DESC' },
        });
    }

    async updateStatus(id: string, status: ExportStatus, result?: any, errorMessage?: string): Promise<Export> {
        const export_ = await this.exportsRepository.findOne({ where: { id } });
        if (!export_) {
            throw new Error(`Export ${id} not found`);
        }

        export_.status = status;
        if (result) {
            export_.result = result;
        }
        if (errorMessage) {
            export_.error_message = errorMessage;
        }

        return this.exportsRepository.save(export_);
    }

    async getArtifacts(reproId: string): Promise<any> {
        // Get all exports for the reproduction
        const exports = await this.findByReproId(reproId);

        // Get the reproduction details
        const repro = await this.exportsRepository
            .createQueryBuilder('export')
            .leftJoinAndSelect('export.repro', 'repro')
            .where('export.repro_id = :reproId', { reproId })
            .getOne();

        return {
            repro: repro?.repro,
            exports: exports.map(exp => ({
                id: exp.id,
                type: exp.export_type,
                status: exp.status,
                result: exp.result,
                created_at: exp.created_at,
            })),
        };
    }
}
