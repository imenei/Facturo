import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const stack = exception instanceof Error ? exception.stack : JSON.stringify(exception);

    // Erreurs serveur : visibles directement dans `pm2 logs`
    if (status >= 500) {
      const msg = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.url} -> ${status}: ${msg}`, stack);
    }

    const logLine = `[${new Date().toISOString()}] ${request.method} ${request.url}\n${stack}\n\n`;
    try {
      fs.appendFileSync(path.join(process.cwd(), 'error-debug.log'), logLine);
    } catch (e) {
      // ignore write errors
    }

    response.status(status).json({
      statusCode: status,
      message: exception instanceof HttpException ? exception.getResponse() : 'Internal server error',
    });
  }
}
