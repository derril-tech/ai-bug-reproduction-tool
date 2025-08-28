import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    Index,
} from 'typeorm';
import { Report } from './report.entity';

export enum SignalKind {
    HAR = 'har',
    SCREENSHOT = 'screenshot',
    VIDEO = 'video',
    LOG = 'log',
}

@Entity('signals')
export class Signal {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reportId: string;

    @ManyToOne(() => Report)
    @JoinColumn({ name: 'reportId' })
    report: Report;

    @Column({
        type: 'enum',
        enum: SignalKind,
    })
    kind: SignalKind;

    @Column({ type: 'text', nullable: true })
    s3Key: string;

    @Column({ type: 'jsonb', nullable: true })
    meta: Record<string, any>;

    @Column({ type: 'vector', nullable: true })
    @Index('signals_embedding_idx', { spatial: true })
    embedding: number[];

    @CreateDateColumn()
    createdAt: Date;
}
