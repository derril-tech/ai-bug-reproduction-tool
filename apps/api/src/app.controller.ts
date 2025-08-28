import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Get()
    @ApiOperation({ summary: 'Get API information' })
    @ApiResponse({ status: 200, description: 'API information' })
    getHello(): object {
        return this.appService.getHello();
    }

    @Get('health')
    @ApiOperation({ summary: 'Health check endpoint' })
    @ApiResponse({ status: 200, description: 'Service is healthy' })
    getHealth(): object {
        return this.appService.getHealth();
    }
}
