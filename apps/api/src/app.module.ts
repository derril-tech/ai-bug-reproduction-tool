import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';
import { ReprosModule } from './repros/repros.module';
import { SearchModule } from './search/search.module';
import { ExportsModule } from './exports/exports.module';
import { ProjectsModule } from './projects/projects.module';
import { CommonModule } from './common/common.module';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
        }),
        DatabaseModule,
        AuthModule,
        ReportsModule,
        ReprosModule,
        SearchModule,
        ExportsModule,
        ProjectsModule,
        CommonModule,
    ],
})
export class AppModule { }
