import { Injectable, OnModuleInit } from '@nestjs/common';
import { newEnforcer } from 'casbin';
import { TypeORMAdapter } from 'casbin-typeorm-adapter';

@Injectable()
export class CasbinService implements OnModuleInit {
    private enforcer: any;

    async onModuleInit() {
        // Initialize Casbin enforcer with TypeORM adapter
        // TODO: Configure proper database adapter
        const adapter = await TypeORMAdapter.newAdapter({
            type: 'postgres',
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            username: process.env.DB_USERNAME || 'postgres',
            password: process.env.DB_PASSWORD || 'postgres',
            database: process.env.DB_NAME || 'bug_repro',
        });

        this.enforcer = await newEnforcer();
        this.enforcer.setAdapter(adapter);

        // Load model from string (RBAC model)
        const model = `
      [request_definition]
      r = sub, obj, act

      [policy_definition]
      p = sub, obj, act

      [role_definition]
      g = _, _

      [policy_effect]
      e = some(where (p.eft == allow))

      [matchers]
      m = g(r.sub, p.sub) && r.obj == p.obj && r.act == p.act
    `;

        await this.enforcer.setModelFromText(model);

        // Load default policies
        await this.loadDefaultPolicies();

        // Load policies from database
        await this.enforcer.loadPolicy();
    }

    async enforce(sub: string, obj: string, act: string): Promise<boolean> {
        return this.enforcer.enforce(sub, obj, act);
    }

    async addPolicy(sub: string, obj: string, act: string): Promise<boolean> {
        return this.enforcer.addPolicy(sub, obj, act);
    }

    async removePolicy(sub: string, obj: string, act: string): Promise<boolean> {
        return this.enforcer.removePolicy(sub, obj, act);
    }

    async addRoleForUser(user: string, role: string): Promise<boolean> {
        return this.enforcer.addRoleForUser(user, role);
    }

    async deleteRoleForUser(user: string, role: string): Promise<boolean> {
        return this.enforcer.deleteRoleForUser(user, role);
    }

    private async loadDefaultPolicies() {
        // Default RBAC policies
        const policies = [
            // Admin has all permissions
            ['admin', 'reports', 'create'],
            ['admin', 'reports', 'read'],
            ['admin', 'reports', 'update'],
            ['admin', 'reports', 'delete'],
            ['admin', 'repros', 'create'],
            ['admin', 'repros', 'read'],
            ['admin', 'repros', 'update'],
            ['admin', 'repros', 'delete'],
            ['admin', 'exports', 'create'],
            ['admin', 'exports', 'read'],
            ['admin', 'exports', 'update'],
            ['admin', 'exports', 'delete'],

            // Member has read/write on own resources
            ['member', 'reports', 'create'],
            ['member', 'reports', 'read'],
            ['member', 'reports', 'update'],
            ['member', 'repros', 'read'],
            ['member', 'exports', 'read'],
            ['member', 'exports', 'create'],
        ];

        for (const policy of policies) {
            await this.enforcer.addPolicy(...policy);
        }
    }
}
