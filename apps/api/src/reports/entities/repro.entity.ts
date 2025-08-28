import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { Report } from './report.entity';
import { Step } from './step.entity';
import { Run } from './run.entity';

export enum ReproStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
}

@Entity('repros')
export class Repro {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reportId: string;

    @ManyToOne(() => Report)
    @JoinColumn({ name: 'reportId' })
    report: Report;

    @Column({ type: 'text', nullable: true })
    framework: string;

    @Column({ type: 'text', nullable: true })
    entry: string;

    @Column({ type: 'jsonb', nullable: true })
    dockerCompose: Record<string, any>;

    @Column({ type: 'jsonb', nullable: true })
    seed: Record<string, any>;

    @Column({ type: 'text', nullable: true })
    sandboxUrl: string;

    @Column({
        type: 'enum',
        enum: ReproStatus,
        default: ReproStatus.PENDING,
    })
    status: ReproStatus;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @OneToMany(() => Step, (step) => step.repro)
    steps: Step[];

    @OneToMany(() => Run, (run) => run.repro)
    runs: Run[];
}
