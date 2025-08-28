import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Report } from '../../reports/entities/report.entity';
import { Export } from '../../exports/entities/export.entity';

@Entity('repros')
export class Repro {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    report_id: string;

    @ManyToOne(() => Report, report => report.repros)
    report: Report;

    @Column({ type: 'text' })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    test_code: string;

    @Column({ type: 'jsonb', nullable: true })
    fixtures: any;

    @Column({ type: 'jsonb', nullable: true })
    config: any;

    @Column({ type: 'varchar', length: 20, default: 'pending' })
    status: string;

    @Column({ type: 'float', nullable: true })
    stability_score: number;

    @Column({ type: 'int', default: 0 })
    run_count: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => Export, export_ => export_.repro)
    exports: Export[];
}
