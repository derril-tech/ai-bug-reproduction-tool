import { IsEnum, IsUUID, IsOptional, IsObject } from 'class-validator';
import { ExportType } from '../entities/export.entity';

export class CreateExportDto {
    @IsUUID()
    repro_id: string;

    @IsEnum(ExportType)
    export_type: ExportType;

    @IsOptional()
    @IsObject()
    options?: any;
}
