import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Repro } from '../../repros/entities/repro.entity';

export enum ExportType {
    PR = 'pr',
    SANDBOX = 'sandbox',
    DOCKER = 'docker',
    REPORT = 'report',
}

export enum ExportStatus {
    PENDING = 'pending',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

@Entity('exports')
export class Export {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    repro_id: string;

    @ManyToOne(() => Repro, repro => repro.exports)
    repro: Repro;

    @Column({
        type: 'enum',
        enum: ExportType,
    })
    export_type: ExportType;

    @Column({
        type: 'enum',
        enum: ExportStatus,
        default: ExportStatus.PENDING,
    })
    status: ExportStatus;

    @Column({ type: 'jsonb', nullable: true })
    result: any;

    @Column({ type: 'text', nullable: true })
    error_message: string;

    @Column({ type: 'jsonb', nullable: true })
    options: any;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
