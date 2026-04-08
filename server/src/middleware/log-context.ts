import { AsyncLocalStorage } from "async_hooks";

export interface LogContext {
  requestId: string;
  userId?: string;
  companyId?: string;
}

export const logContext = new AsyncLocalStorage<LogContext>();

export function getLogContext(): LogContext | undefined {
  return logContext.getStore();
}

export function getRequestId(): string | undefined {
  return logContext.getStore()?.requestId;
}

export function getUserId(): string | undefined {
  return logContext.getStore()?.userId;
}

export function getCompanyId(): string | undefined {
  return logContext.getStore()?.companyId;
}
