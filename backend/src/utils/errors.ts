export class FixFlowError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail?: string;

  constructor(message: string, status = 500, code = 'internal_error', detail?: string) {
    super(message);
    this.name = 'FixFlowError';
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

export const badRequest = (message: string, detail?: string) =>
  new FixFlowError(message, 400, 'bad_request', detail);
export const notFound = (message: string, detail?: string) =>
  new FixFlowError(message, 404, 'not_found', detail);
export const conflict = (message: string, detail?: string) =>
  new FixFlowError(message, 409, 'conflict', detail);
export const forbidden = (message: string, detail?: string) =>
  new FixFlowError(message, 403, 'forbidden', detail);

/** Normalises anything thrown into a serialisable shape. */
export function toErrorPayload(err: unknown): { message: string; detail?: string } {
  if (err instanceof FixFlowError) return { message: err.message, detail: err.detail };
  if (err instanceof Error) {
    return { message: err.message, detail: (err.stack ?? '').split('\n').slice(1, 3).join(' | ') };
  }
  return { message: String(err) };
}
