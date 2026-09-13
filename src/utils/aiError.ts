export class AiError extends Error {
  status?: number;
  interrupted: boolean;

  constructor(message: string, status?: number, interrupted = false) {
    super(message);
    this.status = status;
    this.interrupted = interrupted;
  }
}
