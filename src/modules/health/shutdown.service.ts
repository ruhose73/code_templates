import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';

@Injectable()
export class GracefulShutdownService implements OnApplicationShutdown {
  private readonly logger = new Logger(GracefulShutdownService.name);
  private isShuttingDown = false;

  /**
   * Handles application shutdown signal
   * @param signal - OS signal that triggered the shutdown.
   */
  onApplicationShutdown(signal: string) {
    this.logger.error(`OS signal shutdown.: ${signal}`);
    this.isShuttingDown = true;
  }

  /**
   * Checks if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}
