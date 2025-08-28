import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Report } from './report.entity';

export enum FrameworkType {
    PLAYWRIGHT = 'playwright',
    CYPRESS = 'cypress',
    PUPPETEER = 'puppeteer',
    JEST = 'jest',
    PYTEST = 'pytest',
    MOCHA = 'mocha',
    JASMINE = 'jasmine',
    WEBDRIVER = 'webdriver',
    SELENIUM = 'selenium',
    API = 'api',
    CLI = 'cli',
}

@Entity('mappings')
export class Mapping {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    reportId: string;

    @ManyToOne(() => Report)
    @JoinColumn({ name: 'reportId' })
    report: Report;

    @Column({ type: 'text', nullable: true })
    module: string;

    @Column({ type: 'text', array: true, nullable: true })
    files: string[];

    @Column({
        type: 'enum',
        enum: FrameworkType,
        nullable: true,
    })
    framework: FrameworkType;

    @Column({ type: 'numeric', nullable: true })
    confidence: number;

    @CreateDateColumn()
    createdAt: Date;
}
