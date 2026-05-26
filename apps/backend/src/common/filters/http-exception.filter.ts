import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseDto } from '../dto/error-response.dto';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const parsed = this.parseException(exception, status);

    const payload: ErrorResponseDto = {
      statusCode: status,
      message: parsed.message,
      error: parsed.error,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
      requestId: this.getRequestId(request),
    };

    const details = {
      method: request.method,
      path: request.originalUrl,
      status,
      requestId: payload.requestId,
      message: parsed.message,
    };

    if (status >= 500) {
      this.logger.error(details, exception instanceof Error ? exception.stack : undefined);
    } else {
      this.logger.warn(details);
    }

    response.status(status).json(payload);
  }

  private parseException(
    exception: unknown,
    status: number,
  ): {
    message: string;
    error: string;
  } {
    if (exception instanceof HttpException) {
      const body = exception.getResponse();

      if (typeof body === 'string') {
        return { message: body, error: exception.name };
      }

      if (typeof body === 'object' && body !== null) {
        const typedBody = body as Record<string, unknown>;
        const rawMessage = typedBody.message;
        const message = Array.isArray(rawMessage)
          ? rawMessage.join('; ')
          : typeof rawMessage === 'string'
            ? rawMessage
            : exception.message;

        const error = typeof typedBody.error === 'string' ? typedBody.error : exception.name;

        return { message, error };
      }

      return { message: exception.message, error: exception.name };
    }

    if (exception instanceof Error) {
      return {
        message:
          process.env.NODE_ENV === 'production' && status === HttpStatus.INTERNAL_SERVER_ERROR
            ? 'Internal server error'
            : exception.message,
        error: exception.name,
      };
    }

    return {
      message: status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : 'Request failed',
      error: 'Error',
    };
  }

  private getRequestId(request: Request): string | undefined {
    const id = request.headers['x-request-id'];

    if (typeof id === 'string') {
      return id;
    }

    if (Array.isArray(id)) {
      return id[0];
    }

    return undefined;
  }
}

