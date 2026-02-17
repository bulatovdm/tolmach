export class Logger {
  constructor(private readonly prefix: string) {}

  info(message: string): void {
    console.log(`[${this.prefix}] ${message}`);
  }

  warn(message: string): void {
    console.warn(`[${this.prefix}] ${message}`);
  }

  error(message: string, error?: Error): void {
    console.error(`[${this.prefix}] ${message}`);
    if (error) {
      console.error(error);
    }
  }

  debug(message: string): void {
    if (process.env["DEBUG"] === "true") {
      console.debug(`[${this.prefix}] ${message}`);
    }
  }
}
