import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';
import { Mapping } from '../../search/entities/mapping.entity';
import { Repro } from '../../repros/entities/repro.entity';

@Entity('reports')
export class Report {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @ManyToOne(() => Project, project => project.reports)
    project: Project;

    @Column({ type: 'text' })
    title: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    content: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @Column({ type: 'varchar', length: 20, default: 'open' })
    status: string;

    @Column({ type: 'int', default: 0 })
    priority: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => Mapping, mapping => mapping.report)
    mappings: Mapping[];

    @OneToMany(() => Repro, repro => repro.report)
    repros: Repro[];
}
