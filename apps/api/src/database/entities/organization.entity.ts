import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { Project } from './project.entity';

export enum PlanType {
    FREE = 'free',
    PRO = 'pro',
    ENTERPRISE = 'enterprise',
}

@Entity('orgs')
export class Organization {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'text' })
    name: string;

    @Column({
        type: 'enum',
        enum: PlanType,
        default: PlanType.PRO,
    })
    plan: PlanType;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @OneToMany(() => User, (user) => user.organization)
    users: User[];

    @OneToMany(() => Project, (project) => project.organization)
    projects: Project[];
}
