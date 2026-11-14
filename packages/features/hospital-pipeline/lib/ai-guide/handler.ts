/**
 * AI Guide Handler — Main message processing
 *
 * Processes user messages through template matching → LLM fallback.
 * Records conversation turns, returns assistant reply.
 */

import { matchTemplate } from './templates';
import { templates } from './templates';
import { callLLM } from './llm-router';
import { updateSession, addTurn, getSession, sessions } from './session';

/** Process one user message, return assistant reply */
export async function handleMessage(
  sessionId: string,
  userMessage: string
): Promise<{ content: string; usedLLM: boolean; templateId?: string }> {
  const session = getSession(sessionId);
  if (!session) throw new Error(`Session not found: ${sessionId}`);

  const startTime = Date.now();

  // 1. Record user turn
  addTurn(sessionId, {
    role: 'user',
    content: userMessage,
    timestamp: Date.now(),
    usedLLM: false,
  });

  // 2. Try template match
  const match = matchTemplate(userMessage, session);
  if (match) {
    const result = templates[match.templateId](session, match.args);
    // Record assistant turn
    addTurn(sessionId, {
      role: 'assistant',
      content: result.content,
      timestamp: Date.now(),
      templateId: result.templateId,
      usedLLM: false,
    });
    return { content: result.content, usedLLM: false, templateId: result.templateId };
  }

  // 3. Fallback to LLM
  const llmResult = await callLLM(session, userMessage);
  addTurn(sessionId, {
    role: 'assistant',
    content: llmResult.content,
    timestamp: Date.now(),
    usedLLM: true,
  });

  // Log for observability
  const latencyMs = Date.now() - startTime;
  console.log(
    `[AI Guide] session=${sessionId} usedLLM=${llmResult.usedLLM} latencyMs=${latencyMs} ` +
    `templateId=fallback`
  );

  return { content: llmResult.content, usedLLM: true };
}

/** Proactive push: wait estimate update */
export async function pushWaitUpdate(
  sessionId: string,
  newEstimate: number
): Promise<{ content: string; templateId: string } | null> {
  const session = getSession(sessionId);
  if (!session) return null;

  updateSession(sessionId, { waitEstimate: newEstimate });

  const result = templates['wait-update'](session, { estimate: String(newEstimate) });
  addTurn(sessionId, {
    role: 'assistant',
    content: result.content,
    timestamp: Date.now(),
    templateId: result.templateId,
    usedLLM: false,
  });

  console.log(`[PUSH ${sessionId}] ${result.content}`);
  return { content: result.content, templateId: result.templateId };
}

/** Get session info for debugging/monitoring */
export function getSessionInfo(sessionId: string): {
  sessionId: string;
  patientName: string;
  stt: string;
  currentStepId: string;
  waitEstimate: number;
  messageCount: number;
  lastActiveAt: number;
} | null {
  const session = getSession(sessionId);
  if (!session) return null;

  return {
    sessionId: session.sessionId,
    patientName: session.patientName,
    stt: session.stt,
    currentStepId: session.currentStepId,
    waitEstimate: session.waitEstimate,
    messageCount: session.history.length,
    lastActiveAt: session.lastActiveAt,
  };
}

/** Get all active sessions summary (for monitoring) */
export function getAllSessionsSummary(): Array<{
  sessionId: string;
  patientName: string;
  stt: string;
  currentStepId: string;
  waitEstimate: number;
  messageCount: number;
  lastActiveAt: number;
}> {
  return Array.from(sessions.values()).map((s) => ({
    sessionId: s.sessionId,
    patientName: s.patientName,
    stt: s.stt,
    currentStepId: s.currentStepId,
    waitEstimate: s.waitEstimate,
    messageCount: s.history.length,
    lastActiveAt: s.lastActiveAt,
  }));
}