import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();
        const { method, url, ip, headers } = request;
        const userAgent = headers['user-agent'] || '';
        const startTime = Date.now();

        // Log incoming request
        this.logger.log(
            `Incoming Request: ${method} ${url} - IP: ${ip} - User-Agent: ${userAgent}`,
        );

        return next.handle().pipe(
            tap((data) => {
                const { statusCode } = response;
                const contentLength = response.get('Content-Length');
                const duration = Date.now() - startTime;

                // Log successful response
                this.logger.log(
                    `Response: ${method} ${url} ${statusCode} - ${contentLength} bytes - ${duration}ms`,
                );
            }),
        );
    }
}
