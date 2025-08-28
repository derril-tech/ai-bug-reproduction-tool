import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    CreateDateColumn,
    ManyToOne,
    JoinColumn,
} from 'typeorm';
import { Organization } from './organization.entity';

export enum UserRole {
    ADMIN = 'admin',
    MEMBER = 'member',
}

@Entity('users')
export class User {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    orgId: string;

    @ManyToOne(() => Organization)
    @JoinColumn({ name: 'orgId' })
    organization: Organization;

    @Column({ type: 'citext', unique: true })
    email: string;

    @Column({
        type: 'enum',
        enum: UserRole,
        default: UserRole.MEMBER,
    })
    role: UserRole;

    @CreateDateColumn()
    createdAt: Date;
}
