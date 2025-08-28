import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Repro } from './repro.entity';

export enum StepKind {
    CLICK = 'click',
    TYPE = 'type',
    REQUEST = 'request',
    ASSERT = 'assert',
    CLI = 'cli',
}

@Entity('steps')
export class Step {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reproId: string;

    @ManyToOne(() => Repro)
    @JoinColumn({ name: 'reproId' })
    repro: Repro;

    @Column({ type: 'int' })
    orderIdx: number;

    @Column({
        type: 'enum',
        enum: StepKind,
    })
    kind: StepKind;

    @Column({ type: 'jsonb' })
    payload: Record<string, any>;

    @Column({ type: 'boolean', default: false })
    minimized: boolean;

    @CreateDateColumn()
    createdAt: Date;
}
