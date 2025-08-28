import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
    getHello(): object {
        return {
            name: 'AI Bug Reproduction Tool API',
            version: '0.1.0',
            description: 'REST API for converting natural language bug reports into deterministic repros',
            endpoints: {
                health: '/health',
                api_docs: '/api',
                reports: '/v1/reports',
                repros: '/v1/repros',
                exports: '/v1/exports',
            },
        };
    }

    getHealth(): object {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '0.1.0',
        };
    }
}
