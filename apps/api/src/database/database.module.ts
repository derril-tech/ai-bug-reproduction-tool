import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Report } from '../reports/entities/report.entity';
import { Repro } from '../repros/entities/repro.entity';
import { Mapping } from '../search/entities/mapping.entity';
import { DocChunk } from '../search/entities/doc-chunk.entity';
import { Export } from '../exports/entities/export.entity';
import { Project } from '../projects/entities/project.entity';

@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
                type: 'postgres',
                host: configService.get('DB_HOST', 'localhost'),
                port: configService.get('DB_PORT', 5432),
                username: configService.get('DB_USERNAME', 'postgres'),
                password: configService.get('DB_PASSWORD', 'password'),
                database: configService.get('DB_DATABASE', 'ai_bug_tool'),
                entities: [Report, Repro, Mapping, DocChunk, Export, Project],
                synchronize: configService.get('NODE_ENV') === 'development',
                logging: configService.get('NODE_ENV') === 'development',
            }),
            inject: [ConfigService],
        }),
    ],
})
export class DatabaseModule { }
