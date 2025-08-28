import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CasbinService } from '../services/casbin.service';

@Injectable()
export class CasbinGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private casbinService: CasbinService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            return false;
        }

        const handler = context.getHandler();
        const controller = context.getClass();

        // Get resource and action from route
        const resource = this.getResourceFromRoute(request);
        const action = this.getActionFromMethod(request.method);

        // Check permission
        return this.casbinService.enforce(user.role, resource, action);
    }

    private getResourceFromRoute(request: any): string {
        // Extract resource from URL path
        const path = request.route?.path || request.url;
        const segments = path.split('/').filter(Boolean);

        // Remove 'v1' prefix and get first segment
        if (segments[0] === 'v1') {
            return segments[1] || 'default';
        }

        return segments[0] || 'default';
    }

    private getActionFromMethod(method: string): string {
        switch (method.toUpperCase()) {
            case 'GET':
                return 'read';
            case 'POST':
                return 'create';
            case 'PUT':
                return 'update';
            case 'PATCH':
                return 'update';
            case 'DELETE':
                return 'delete';
            default:
                return 'read';
        }
    }
}
