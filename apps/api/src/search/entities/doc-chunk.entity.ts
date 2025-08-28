import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Project } from '../../projects/entities/project.entity';

@Entity('doc_chunks')
export class DocChunk {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'uuid' })
    project_id: string;

    @ManyToOne(() => Project, project => project.docChunks)
    project: Project;

    @Column({ type: 'text' })
    file_path: string;

    @Column({ type: 'text' })
    chunk_text: string;

    @Column({ type: 'vector', nullable: true })
    embedding: number[];

    @Column({ type: 'jsonb', nullable: true })
    meta: any;

    @CreateDateColumn()
    created_at: Date;
}
