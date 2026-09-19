import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

const correlationIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;

export function acceptedCorrelationId(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && correlationIdPattern.test(value) ? value : undefined;
}

export function requestId(req: IncomingMessage, res: ServerResponse): string {
  const id = acceptedCorrelationId(req.headers["x-request-id"]) ?? randomUUID();
  res.setHeader("x-request-id", id);
  return id;
}

export function campaignLogProps(req: IncomingMessage): { campaignRunId?: string } {
  const campaignRunId = acceptedCorrelationId(req.headers["x-campaign-run-id"]);
  return campaignRunId ? { campaignRunId } : {};
}
