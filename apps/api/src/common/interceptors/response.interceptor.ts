import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';

export interface ResponseFormat<T> {
    success: true;
    data: T;
    timestamp: string;
    requestId?: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ResponseFormat<T>> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<ResponseFormat<T>> {
        const request = context.switchToHttp().getRequest<Request>();
        const requestId = request.headers['x-request-id'] as string;

        return next.handle().pipe(
            map((data) => ({
                success: true,
                data,
                timestamp: new Date().toISOString(),
                ...(requestId && { requestId }),
            })),
        );
    }
}
