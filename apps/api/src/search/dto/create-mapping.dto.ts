import { IsUUID, IsOptional, IsString } from 'class-validator';

export class CreateMappingDto {
    @IsUUID()
    report_id: string;

    @IsUUID()
    project_id: string;

    @IsOptional()
    @IsString()
    query?: string;

    @IsOptional()
    @IsString()
    repo_path?: string;
}
