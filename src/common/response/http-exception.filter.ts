import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { ErrorCode } from './error-code.enum';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let code: string;
    let message: string;

    if (typeof exceptionResponse === 'object' && 'code' in exceptionResponse) {
      const body = exceptionResponse as { code: string; message: string };
      code = body.code;
      message = body.message;
    } else {
      code = HttpStatus[status] ?? ErrorCode.INTERNAL_ERROR;
      const rawMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as { message: string | string[] }).message;
      message = Array.isArray(rawMessage) ? rawMessage.join(', ') : rawMessage;
    }

    reply.status(status).send({ success: false, data: null, error: { code, message } });
  }
}
