export class Logger {
  private name: string;
  constructor(name = 'app') {
    this.name = name;
  }
  info(...args: any[]) {
    console.info(`[${this.name}]`, ...args);
  }
  warn(...args: any[]) {
    console.warn(`[${this.name}]`, ...args);
  }
  error(...args: any[]) {
    console.error(`[${this.name}]`, ...args);
  }
  debug(...args: any[]) {
    console.debug(`[${this.name}]`, ...args);
  }
}
