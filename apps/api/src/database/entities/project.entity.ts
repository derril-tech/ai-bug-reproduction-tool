import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
    OneToMany,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Report } from '../../reports/entities/report.entity';

@Entity('projects')
export class Project {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    orgId: string;

    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'orgId' })
    organization: Organization;

    @Column({ type: 'text' })
    name: string;

    @Column({ type: 'text', nullable: true })
    repoUrl: string;

    @Column({ type: 'text', default: 'main' })
    defaultBranch: string;

    @CreateDateColumn()
    createdAt: Date;

    // Relations
    @OneToMany(() => Report, (report) => report.project)
    reports: Report[];
}
