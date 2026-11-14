/**
 * AI Guide Handler Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  handleMessage,
  pushWaitUpdate,
  getSessionInfo,
  getAllSessionsSummary,
} from '../handler';
import { createSession, sessions, getSession, type GuideSession } from '../session';
import process from "node:process";

describe('AI Guide Handler', () => {
  beforeEach(() => {
    sessions.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());
    // Enable stub mode for tests
    process.env.FREELLM_STUB = 'true';
  });

  it('handleMessage returns greeting for greeting input', async () => {
    createSession('sid-1', 'Trần Thị B', '015', 'step-queue');
    const res = await handleMessage('sid-1', 'Chào bạn');
    expect(res.usedLLM).toBe(false);
    expect(res.templateId).toBe('greeting');
    expect(res.content).toContain('Trần Thị B');
    expect(res.content).toContain('015');
  });

  it('handleMessage returns wait-update for wait question', async () => {
    createSession('sid-2', 'Lê Văn C', '016', 'step-consultation');
    const res = await handleMessage('sid-2', 'Còn chờ bao lâu?');
    expect(res.usedLLM).toBe(false);
    expect(res.templateId).toBe('wait-update');
  });

  it('handleMessage falls back to LLM for unknown question', async () => {
    createSession('sid-3', 'Phạm Thị D', '017', 'step-lab');
    const res = await handleMessage('sid-3', 'Thời tiết hôm nay thế nào?');
    expect(res.usedLLM).toBe(true);
    expect(res.content).toContain('[STUB]');
  });

  it('handleMessage throws for non-existent session', async () => {
    await expect(handleMessage('non-existent', 'test')).rejects.toThrow('Session not found');
  });

  it('handleMessage records user and assistant turns', async () => {
    createSession('sid-4', 'Test', '018', 'step-queue');
    await handleMessage('sid-4', 'Chào bạn');
    const session = getSession('sid-4');
    expect(session?.history.length).toBe(2);
    expect(session?.history[0].role).toBe('user');
    expect(session?.history[1].role).toBe('assistant');
    expect(session?.history[1].templateId).toBe('greeting');
    expect(session?.history[1].usedLLM).toBe(false);
  });

  it('pushWaitUpdate updates session and returns message', async () => {
    createSession('sid-5', 'Hoàng Văn E', '019', 'step-queue');
    const result = await pushWaitUpdate('sid-5', 5);
    expect(result).not.toBeNull();
    expect(result?.templateId).toBe('wait-update');
    expect(result?.content).toContain('5 phút');

    const session = getSession('sid-5');
    expect(session?.waitEstimate).toBe(5);
    expect(session?.history.length).toBe(1); // Only assistant turn added
  });

  it('pushWaitUpdate returns null for non-existent session', async () => {
    const result = await pushWaitUpdate('non-existent', 5);
    expect(result).toBeNull();
  });

  it('getSessionInfo returns session summary', () => {
    createSession('sid-6', 'Vũ Thị F', '020', 'step-ticket');
    const info = getSessionInfo('sid-6');
    expect(info).not.toBeNull();
    expect(info?.sessionId).toBe('sid-6');
    expect(info?.patientName).toBe('Vũ Thị F');
    expect(info?.stt).toBe('020');
    expect(info?.currentStepId).toBe('step-ticket');
    expect(info?.waitEstimate).toBe(0);
    expect(info?.messageCount).toBe(0);
  });

  it('getSessionInfo returns null for non-existent', () => {
    expect(getSessionInfo('non-existent')).toBeNull();
  });

  it('getAllSessionsSummary returns all sessions', () => {
    createSession('sid-7', 'A', '021', 'step-ticket');
    createSession('sid-8', 'B', '022', 'step-queue');
    const summary = getAllSessionsSummary();
    expect(summary.length).toBe(2);
    expect(summary[0].sessionId).toBe('sid-7');
    expect(summary[1].sessionId).toBe('sid-8');
  });

  it('LLM fallback records usedLLM=true', async () => {
    createSession('sid-9', 'Test', '023', 'step-queue');
    const res = await handleMessage('sid-9', 'Random unknown question');
    expect(res.usedLLM).toBe(true);

    const session = getSession('sid-9');
    const assistantTurn = session?.history.find((t) => t.role === 'assistant');
    expect(assistantTurn?.usedLLM).toBe(true);
  });
});