import { Injectable } from '@nestjs/common';

export interface ProblemJson {
    type: string;
    title: string;
    status: number;
    detail?: string;
    instance?: string;
    [key: string]: any;
}

@Injectable()
export class ProblemJsonService {
    createProblem(
        type: string,
        title: string,
        status: number,
        detail?: string,
        instance?: string,
        extensions?: Record<string, any>,
    ): ProblemJson {
        const problem: ProblemJson = {
            type,
            title,
            status,
        };

        if (detail) problem.detail = detail;
        if (instance) problem.instance = instance;
        if (extensions) Object.assign(problem, extensions);

        return problem;
    }

    badRequest(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7231#section-6.5.1',
            'Bad Request',
            400,
            detail,
            undefined,
            extensions,
        );
    }

    unauthorized(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7235#section-3.1',
            'Unauthorized',
            401,
            detail,
            undefined,
            extensions,
        );
    }

    forbidden(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7231#section-6.5.3',
            'Forbidden',
            403,
            detail,
            undefined,
            extensions,
        );
    }

    notFound(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7231#section-6.5.4',
            'Not Found',
            404,
            detail,
            undefined,
            extensions,
        );
    }

    conflict(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7231#section-6.5.8',
            'Conflict',
            409,
            detail,
            undefined,
            extensions,
        );
    }

    unprocessableEntity(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc4918#section-11.2',
            'Unprocessable Entity',
            422,
            detail,
            undefined,
            extensions,
        );
    }

    internalServerError(detail?: string, extensions?: Record<string, any>): ProblemJson {
        return this.createProblem(
            'https://tools.ietf.org/html/rfc7231#section-6.6.1',
            'Internal Server Error',
            500,
            detail,
            undefined,
            extensions,
        );
    }
}
