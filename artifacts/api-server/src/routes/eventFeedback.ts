import { getAuth } from "@clerk/express";
import { ListEventFeedbackQueryParams, ListEventFeedbackResponse, SubmitEventFeedbackBody, SubmitEventFeedbackResponse } from "@workspace/api-zod";
import { Router } from "express";
import { decodeFeedbackCursor, FeedbackConflict, FeedbackThrottled, FeedbackUnavailable, listFeedback, submitFeedback } from "../lib/eventFeedback";

const router = Router();
const error = (code: string, message: string) => ({ error: message, code });

router.get("/events/feedback", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json(error("AUTH_REQUIRED", "Game session required.")); return; }
  const query = ListEventFeedbackQueryParams.strict().safeParse(req.query);
  if (!query.success || (req.query.limit !== undefined && (typeof req.query.limit !== "string" || !/^[0-9]+$/.test(req.query.limit))) ||
    !Number.isInteger(query.data?.limit)) {
    res.status(400).json(error("INVALID_PAGE", "Invalid feedback page request.")); return;
  }
  try {
    if (query.data.cursor) decodeFeedbackCursor(query.data.cursor);
  } catch {
    res.status(400).json(error("INVALID_PAGE", "Invalid feedback page request.")); return;
  }
  try {
    res.json(ListEventFeedbackResponse.parse(await listFeedback(query.data.limit, query.data.cursor)));
  } catch {
    res.status(503).json(error("FEEDBACK_UNAVAILABLE", "Feedback is unavailable. Please retry."));
  }
});

router.post("/events/feedback", async (req, res) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json(error("AUTH_REQUIRED", "Game session required.")); return; }
  const input = SubmitEventFeedbackBody.strict().safeParse(req.body);
  if (!input.success || !input.data.message.trim()) {
    res.status(400).json(error("INVALID_FEEDBACK", "Enter a category, message, and retry ID.")); return;
  }
  try {
    const receipt = SubmitEventFeedbackResponse.parse(await submitFeedback(userId, input.data));
    res.status(receipt.replayed ? 200 : 201).json(receipt);
  } catch (cause) {
    if (cause instanceof FeedbackConflict) {
      res.status(409).json(error("RETRY_CONFLICT", "Retry ID was already used for different feedback."));
    } else if (cause instanceof FeedbackThrottled) {
      res.setHeader("Retry-After", String(cause.retryAfterSeconds));
      res.status(429).json({ ...error("FEEDBACK_THROTTLED", "Posting limit reached. Please try again later."), retryAfterSeconds: cause.retryAfterSeconds });
    } else {
      // Never log exception objects: driver errors may contain SQL parameters.
      res.status(503).json(error("FEEDBACK_UNAVAILABLE", "Feedback could not be confirmed. Retry with the same retry ID."));
    }
  }
});

export default router;