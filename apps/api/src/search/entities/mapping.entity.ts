import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Report } from '../../reports/entities/report.entity';

@Entity('mappings')
export class Mapping {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    report_id: string;

    @ManyToOne(() => Report, report => report.mappings)
    report: Report;

    @Column({ type: 'jsonb', nullable: true })
    framework_scores: any;

    @Column({ type: 'jsonb', nullable: true })
    module_suggestions: any;

    @Column({ type: 'jsonb', nullable: true })
    doc_results: any;

    @Column({ type: 'float', nullable: true })
    confidence_score: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}
