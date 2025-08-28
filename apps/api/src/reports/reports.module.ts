import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { ReportsController } from './reports.controller';
import { ReportsService } from './services/reports.service';
import { S3Service } from './services/s3.service';
import { Report } from './entities/report.entity';
import { Signal } from './entities/signal.entity';
import { Mapping } from './entities/mapping.entity';
import { Repro } from './entities/repro.entity';
import { Step } from './entities/step.entity';
import { Run } from './entities/run.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Report,
            Signal,
            Mapping,
            Repro,
            Step,
            Run,
        ]),
        MulterModule.register({
            limits: {
                fileSize: 50 * 1024 * 1024, // 50MB
            },
            fileFilter: (req, file, callback) => {
                // Allow common file types for bug reports
                const allowedMimes = [
                    'application/json',
                    'application/har+json',
                    'text/plain',
                    'text/csv',
                    'image/png',
                    'image/jpeg',
                    'image/gif',
                    'video/mp4',
                    'video/webm',
                    'application/zip',
                ];

                if (allowedMimes.includes(file.mimetype)) {
                    callback(null, true);
                } else {
                    callback(new Error(`File type ${file.mimetype} not allowed`), false);
                }
            },
        }),
    ],
    controllers: [ReportsController],
    providers: [ReportsService, S3Service],
    exports: [ReportsService, S3Service],
})
export class ReportsModule { }
