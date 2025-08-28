import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mapping } from './entities/mapping.entity';
import { DocChunk } from './entities/doc-chunk.entity';
import { CreateMappingDto } from './dto/create-mapping.dto';
import { NATSClient } from '../common/services/nats.service';

@Injectable()
export class SearchService {
    private readonly logger = new Logger(SearchService.name);

    constructor(
        @InjectRepository(Mapping)
        private mappingRepository: Repository<Mapping>,
        @InjectRepository(DocChunk)
        private docChunkRepository: Repository<DocChunk>,
        private natsClient: NATSClient,
    ) { }

    async createMapping(createMappingDto: CreateMappingDto): Promise<Mapping> {
        const mapping = this.mappingRepository.create({
            report_id: createMappingDto.report_id,
            confidence_score: 0.0,
        });

        const savedMapping = await this.mappingRepository.save(mapping);

        // Publish mapping request to NATS
        await this.natsClient.publish('mapping.request', {
            mapping_id: savedMapping.id,
            report_id: createMappingDto.report_id,
            project_id: createMappingDto.project_id,
            query: createMappingDto.query || '',
            repo_path: createMappingDto.repo_path || '',
        });

        this.logger.log(`Created mapping ${savedMapping.id} for report ${createMappingDto.report_id}`);

        return savedMapping;
    }

    async findMappingByReportId(reportId: string): Promise<Mapping | null> {
        return this.mappingRepository.findOne({
            where: { report_id: reportId },
            order: { created_at: 'DESC' },
        });
    }

    async updateMapping(id: string, data: Partial<Mapping>): Promise<Mapping> {
        const mapping = await this.mappingRepository.findOne({ where: { id } });
        if (!mapping) {
            throw new Error(`Mapping ${id} not found`);
        }

        Object.assign(mapping, data);
        return this.mappingRepository.save(mapping);
    }

    async searchDocuments(projectId: string, query: string, limit: number = 5): Promise<DocChunk[]> {
        // This would use pgvector similarity search in a real implementation
        // For now, return a simple text search
        return this.docChunkRepository
            .createQueryBuilder('chunk')
            .where('chunk.project_id = :projectId', { projectId })
            .andWhere('chunk.chunk_text ILIKE :query', { query: `%${query}%` })
            .limit(limit)
            .getMany();
    }

    async indexDocument(projectId: string, filePath: string, chunkText: string, embedding?: number[], meta?: any): Promise<DocChunk> {
        const chunk = this.docChunkRepository.create({
            project_id: projectId,
            file_path: filePath,
            chunk_text: chunkText,
            embedding,
            meta,
        });

        return this.docChunkRepository.save(chunk);
    }
}
