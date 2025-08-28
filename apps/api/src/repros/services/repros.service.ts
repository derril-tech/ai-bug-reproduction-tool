import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Repro, ReproStatus } from '../../reports/entities/repro.entity';
import { Report } from '../../reports/entities/report.entity';
import { Signal } from '../../reports/entities/signal.entity';
import { CreateReproDto, ReproTarget, ReproFramework } from '../dto/create-repro.dto';

@Injectable()
export class ReprosService {
    constructor(
        @InjectRepository(Repro)
        private readonly reprosRepository: Repository<Repro>,
        @InjectRepository(Report)
        private readonly reportsRepository: Repository<Report>,
        @InjectRepository(Signal)
        private readonly signalsRepository: Repository<Signal>,
    ) { }

    async generate(createReproDto: CreateReproDto): Promise<Repro> {
        // Verify report exists
        const report = await this.reportsRepository.findOne({
            where: { id: createReproDto.reportId },
        });

        if (!report) {
            throw new NotFoundException(`Report with ID ${createReproDto.reportId} not found`);
        }

        // Check if reproduction already exists for this report
        const existingRepro = await this.reprosRepository.findOne({
            where: { reportId: createReproDto.reportId },
        });

        if (existingRepro) {
            throw new BadRequestException(
                `Reproduction already exists for report ${createReproDto.reportId}`
            );
        }

        // Determine framework based on target and report content
        const framework = await this.determineFramework(createReproDto, report);

        // Create reproduction record
        const repro = this.reprosRepository.create({
            reportId: createReproDto.reportId,
            framework: framework,
            status: ReproStatus.PENDING,
        });

        const savedRepro = await this.reprosRepository.save(repro);

        // Trigger async synthesis process
        await this.triggerSynthesis(savedRepro.id, createReproDto);

        return savedRepro;
    }

    async plan(createReproDto: CreateReproDto): Promise<any> {
        // Verify report exists
        const report = await this.reportsRepository.findOne({
            where: { id: createReproDto.reportId },
        });

        if (!report) {
            throw new NotFoundException(`Report with ID ${createReproDto.reportId} not found`);
        }

        // Get signals for analysis
        const signals = await this.signalsRepository.find({
            where: { reportId: createReproDto.reportId },
        });

        // Analyze signals to determine best strategy
        const analysis = await this.analyzeSignals(signals, report);

        return {
            framework: analysis.recommendedFramework,
            strategy: analysis.strategy,
            confidence: analysis.confidence,
            estimated_steps: analysis.estimatedSteps,
            recommendations: analysis.recommendations,
            signal_analysis: analysis.signalBreakdown,
        };
    }

    async findOne(id: string): Promise<Repro> {
        const repro = await this.reprosRepository.findOne({
            where: { id },
            relations: ['report'],
        });

        if (!repro) {
            throw new NotFoundException(`Reproduction with ID ${id} not found`);
        }

        return repro;
    }

    async validate(id: string, runs: number = 5, determinism?: any): Promise<any> {
        const repro = await this.findOne(id);

        // Set default determinism controls
        const defaultDeterminism = {
            enable_network_shaping: true,
            enable_time_freezing: true,
            enable_resource_limits: true,
            network_latency_ms: 50,
            network_bandwidth_kbps: 1000,
            monitoring_interval: 5,
            ...determinism,
        };

        // Trigger validation process with determinism controls
        await this.triggerValidation(repro.id, runs, defaultDeterminism);

        return {
            reproId: repro.id,
            runs: runs,
            determinism: defaultDeterminism,
            status: 'validation_started',
            message: `Validation started with ${runs} test runs and determinism controls`,
        };
    }

    async getArtifacts(id: string): Promise<any> {
        const repro = await this.findOne(id);

        if (repro.status !== ReproStatus.COMPLETED) {
            throw new BadRequestException(
                `Reproduction ${id} is not yet completed. Current status: ${repro.status}`
            );
        }

        // Generate download URLs for artifacts
        const downloadUrls = await this.generateDownloadUrls(repro);

        return {
            reproId: repro.id,
            status: repro.status,
            framework: repro.framework,
            download_urls: downloadUrls,
            created_at: repro.createdAt,
        };
    }

    private async determineFramework(dto: CreateReproDto, report: Report): Promise<string> {
        // Use specified framework if provided
        if (dto.framework) {
            return dto.framework;
        }

        // Auto-detect based on signals and report content
        const signals = await this.signalsRepository.find({
            where: { reportId: report.id },
        });

        // Check for HAR files (indicates web UI testing)
        const hasHar = signals.some(s => s.kind === 'har');
        if (hasHar) {
            return ReproFramework.PLAYWRIGHT;
        }

        // Check for API patterns in description
        const description = (report.description || '').toLowerCase();
        if ('api' in description || 'endpoint' in description || 'http' in description) {
            return ReproFramework.JEST;
        }

        // Default to Playwright for web applications
        return ReproFramework.PLAYWRIGHT;
    }

    private async analyzeSignals(signals: Signal[], report: Report): Promise<any> {
        const analysis = {
            recommendedFramework: ReproFramework.PLAYWRIGHT,
            strategy: 'web_ui',
            confidence: 0.5,
            estimatedSteps: 0,
            recommendations: [] as string[],
            signalBreakdown: {
                har_files: 0,
                screenshots: 0,
                videos: 0,
                logs: 0,
                total: signals.length,
            },
        };

        // Count signal types
        for (const signal of signals) {
            analysis.signalBreakdown[`${signal.kind}_files`] += 1;
        }

        // Determine strategy based on signals
        const hasHar = analysis.signalBreakdown.har_files > 0;
        const hasScreenshots = analysis.signalBreakdown.screenshots > 0;
        const hasLogs = analysis.signalBreakdown.logs > 0;

        if (hasHar && hasScreenshots) {
            analysis.strategy = 'web_ui_with_interactions';
            analysis.confidence = 0.9;
            analysis.estimatedSteps = analysis.signalBreakdown.har_files * 5 + 10;
            analysis.recommendedFramework = ReproFramework.PLAYWRIGHT;
            analysis.recommendations.push('Use Playwright for comprehensive web UI testing');
        } else if (hasHar) {
            analysis.strategy = 'web_navigation';
            analysis.confidence = 0.7;
            analysis.estimatedSteps = analysis.signalBreakdown.har_files * 3 + 5;
            analysis.recommendedFramework = ReproFramework.PLAYWRIGHT;
        } else if (hasLogs) {
            analysis.strategy = 'api_or_backend';
            analysis.confidence = 0.6;
            analysis.estimatedSteps = 5;
            analysis.recommendedFramework = ReproFramework.JEST;
            analysis.recommendations.push('Consider API testing based on log analysis');
        } else {
            analysis.strategy = 'minimal';
            analysis.confidence = 0.3;
            analysis.estimatedSteps = 3;
            analysis.recommendations.push('Limited signal data available');
            analysis.recommendations.push('Manual test case creation may be needed');
        }

        // Add framework-specific recommendations
        if (analysis.recommendedFramework === ReproFramework.PLAYWRIGHT) {
            analysis.recommendations.push('Playwright supports cross-browser testing');
            analysis.recommendations.push('Consider using codegen for initial test creation');
        }

        return analysis;
    }

    private async triggerSynthesis(reproId: string, dto: CreateReproDto): Promise<void> {
        // In a real implementation, this would publish to NATS queue
        // For now, we'll simulate the process

        console.log(`Triggering synthesis for repro ${reproId}`);
        console.log(`Report ID: ${dto.reportId}`);
        console.log(`Target: ${dto.target || 'web'}`);
        console.log(`Framework: ${dto.framework || 'auto-detect'}`);

        // TODO: Publish to NATS queue for synth-worker
        // await this.natsClient.publish('report.synth', {
        //   repro_id: reproId,
        //   report_id: dto.reportId,
        //   target: dto.target,
        //   framework: dto.framework,
        //   options: dto.options,
        // });
    }

    private async triggerValidation(reproId: string, runs: number, determinism: any): Promise<void> {
        // TODO: Publish to validation queue with determinism controls
        console.log(`Triggering validation for repro ${reproId} with ${runs} runs`);
        console.log(`Determinism controls:`, determinism);

        // In a real implementation, this would publish to NATS:
        // await this.natsClient.publish('repro.validate', {
        //   repro_id: reproId,
        //   runs: runs,
        //   determinism: determinism,
        // });
    }

    private async generateDownloadUrls(repro: Repro): Promise<any> {
        // TODO: Generate signed S3 URLs for artifacts
        // For now, return placeholder URLs
        return {
            test_package: `/api/repros/${repro.id}/download/test-package.zip`,
            fixtures: `/api/repros/${repro.id}/download/fixtures.json`,
            compose: `/api/repros/${repro.id}/download/docker-compose.yml`,
            readme: `/api/repros/${repro.id}/download/README.md`,
        };
    }
}
