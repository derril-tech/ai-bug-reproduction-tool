import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { Report } from '../../reports/entities/report.entity';
import { DocChunk } from '../../search/entities/doc-chunk.entity';

@Entity('projects')
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    repo_url: string;

    @Column({ type: 'jsonb', nullable: true })
    metadata: any;

    @Column({ type: 'varchar', length: 20, default: 'active' })
    status: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @OneToMany(() => Report, report => report.project)
    reports: Report[];

    @OneToMany(() => DocChunk, docChunk => docChunk.project)
    docChunks: DocChunk[];
}
