import { Module } from '@nestjs/common';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Export } from './entities/export.entity';

@Module({
    imports: [TypeOrmModule.forFeature([Export])],
    controllers: [ExportsController],
    providers: [ExportsService],
    exports: [ExportsService],
})
export class ExportsModule { }
