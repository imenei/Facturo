import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('AllExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // message : toujours une chaîne, ou un tableau de chaînes (validation)
    let message: string | string[] = 'Internal server error';
    let error: string | undefined;

    if (isHttp) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
      } else if (res && typeof res === 'object') {
        const r = res as Record<string, any>;
        message = r.message ?? exception.message;
        error = typeof r.error === 'string' ? r.error : undefined;
      } else {
        message = exception.message;
      }
    }

    // Erreurs serveur : visibles dans `pm2 logs` et dans error-debug.log
    if (status >= 500) {
      const stack =
        exception instanceof Error ? exception.stack : JSON.stringify(exception);
      const msg = exception instanceof Error ? exception.message : String(exception);
      this.logger.error(`${request.method} ${request.url} -> ${status}: ${msg}`, stack);

      const logLine = `[${new Date().toISOString()}] ${request.method} ${request.url}\n${stack}\n\n`;
      try {
        fs.appendFileSync(path.join(process.cwd(), 'error-debug.log'), logLine);
      } catch (e) {
        // ignore write errors
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      ...(error ? { error } : {}),
    });
  }
}