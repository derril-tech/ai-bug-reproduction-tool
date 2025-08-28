import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Repro } from './repro.entity';

@Entity('runs')
export class Run {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reproId: string;

    @ManyToOne(() => Repro)
    @JoinColumn({ name: 'reproId' })
    repro: Repro;

    @Column({ type: 'int' })
    iteration: number;

    @Column({ type: 'boolean' })
    passed: boolean;

    @Column({ type: 'int', nullable: true })
    durationMs: number;

    @Column({ type: 'text', nullable: true })
    logsS3: string;

    @Column({ type: 'text', nullable: true })
    videoS3: string;

    @Column({ type: 'text', nullable: true })
    traceS3: string;

    @CreateDateColumn()
    createdAt: Date;
}
