import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ProblemJsonService } from '../services/problem-json.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    constructor(private readonly problemJsonService: ProblemJsonService) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let problemJson;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                problemJson = this.problemJsonService.createProblem(
                    'about:blank',
                    exceptionResponse,
                    status,
                    exceptionResponse,
                    request.url,
                );
            } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
                const responseObj = exceptionResponse as any;
                problemJson = this.problemJsonService.createProblem(
                    responseObj.type || 'about:blank',
                    responseObj.message || responseObj.error || 'Error',
                    status,
                    responseObj.detail || responseObj.message,
                    request.url,
                    responseObj.extensions,
                );
            }
        } else if (exception instanceof Error) {
            this.logger.error(
                `Unhandled exception: ${exception.message}`,
                exception.stack,
            );

            problemJson = this.problemJsonService.internalServerError(
                'An unexpected error occurred',
                {
                    originalError: exception.message,
                    timestamp: new Date().toISOString(),
                },
            );
        } else {
            this.logger.error('Unknown exception type', exception);
            problemJson = this.problemJsonService.internalServerError(
                'An unknown error occurred',
            );
        }

        // Add request ID if available
        if (request.headers['x-request-id']) {
            problemJson.instance = request.headers['x-request-id'] as string;
        }

        response.status(status).json(problemJson);
    }
}
