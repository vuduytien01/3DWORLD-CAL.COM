/**
 * AI Guide Session Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  sessions,
  createSession,
  getSession,
  updateSession,
  addTurn,
  deleteSession,
  getAllSessions,
  getSessionCount,
  cleanupStaleSessions,
  type GuideSession,
  type GuideTurn,
} from '../session';
import { STEP_LOCATION_BY_ID } from '../../step-graph/step-locations';

describe('AI Guide Session', () => {
  beforeEach(() => {
    sessions.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());
  });

  it('creates session with initial step', () => {
    const session = createSession('sid-1', 'Nguyễn Văn A', '014', 'step-ticket');
    expect(session.sessionId).toBe('sid-1');
    expect(session.patientName).toBe('Nguyễn Văn A');
    expect(session.stt).toBe('014');
    expect(session.currentStepId).toBe('step-ticket');
    expect(session.currentStep).toBe(STEP_LOCATION_BY_ID.get('step-ticket'));
    expect(session.waitEstimate).toBe(0);
    expect(session.history).toEqual([]);
    expect(session.createdAt).toBe(Date.now());
    expect(session.lastActiveAt).toBe(Date.now());
  });

  it('throws for unknown stepId', () => {
    expect(() => createSession('sid-2', 'Test', '001', 'unknown-step')).toThrow('Unknown stepId: unknown-step');
  });

  it('getSession returns session by ID', () => {
    createSession('sid-3', 'Test', '002', 'step-queue');
    const session = getSession('sid-3');
    expect(session).toBeDefined();
    expect(session?.patientName).toBe('Test');
  });

  it('getSession returns undefined for non-existent', () => {
    expect(getSession('non-existent')).toBeUndefined();
  });

  it('updateSession updates fields', () => {
    createSession('sid-4', 'Test', '003', 'step-ticket');
    const updated = updateSession('sid-4', { waitEstimate: 5, stt: '004' });
    expect(updated?.waitEstimate).toBe(5);
    expect(updated?.stt).toBe('004');
    expect(updated?.lastActiveAt).toBe(Date.now());
  });

  it('updateSession returns undefined for non-existent', () => {
    expect(updateSession('non-existent', { waitEstimate: 5 })).toBeUndefined();
  });

  it('addTurn adds turn to history', () => {
    createSession('sid-5', 'Test', '005', 'step-ticket');
    const turn: GuideTurn = {
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
      usedLLM: false,
    };
    const updated = addTurn('sid-5', turn);
    expect(updated?.history.length).toBe(1);
    expect(updated?.history[0].content).toBe('Hello');
  });

  it('addTurn keeps only last 10 turns', () => {
    createSession('sid-6', 'Test', '006', 'step-ticket');
    for (let i = 0; i < 15; i++) {
      addTurn('sid-6', {
        role: 'user',
        content: `Message ${i}`,
        timestamp: Date.now() + i,
        usedLLM: false,
      });
    }
    const session = getSession('sid-6');
    expect(session?.history.length).toBe(10);
    expect(session?.history[0].content).toBe('Message 5');
    expect(session?.history[9].content).toBe('Message 14');
  });

  it('deleteSession removes session', () => {
    createSession('sid-7', 'Test', '007', 'step-ticket');
    expect(deleteSession('sid-7')).toBe(true);
    expect(getSession('sid-7')).toBeUndefined();
    expect(deleteSession('sid-7')).toBe(false);
  });

  it('getAllSessions returns all sessions', () => {
    createSession('sid-8', 'A', '008', 'step-ticket');
    createSession('sid-9', 'B', '009', 'step-queue');
    const all = getAllSessions();
    expect(all.length).toBe(2);
  });

  it('getSessionCount returns correct count', () => {
    expect(getSessionCount()).toBe(0);
    createSession('sid-10', 'A', '010', 'step-ticket');
    expect(getSessionCount()).toBe(1);
    createSession('sid-11', 'B', '011', 'step-queue');
    expect(getSessionCount()).toBe(2);
  });

  it('cleanupStaleSessions removes old sessions', () => {
    createSession('sid-12', 'Old', '012', 'step-ticket');
    createSession('sid-13', 'New', '013', 'step-queue');

    // Advance time by 31 minutes (older than default 30 min)
    vi.advanceTimersByTime(31 * 60 * 1000);

    const cleaned = cleanupStaleSessions(30 * 60 * 1000);
    expect(cleaned).toBe(2); // Both should be stale since they were created at same time
    expect(getSessionCount()).toBe(0);
  });

  it('cleanupStaleSessions with custom maxAge', () => {
    createSession('sid-14', 'A', '014', 'step-ticket');
    createSession('sid-15', 'B', '015', 'step-queue');

    vi.advanceTimersByTime(15 * 60 * 1000);

    const cleaned = cleanupStaleSessions(10 * 60 * 1000); // 10 min max age
    expect(cleaned).toBe(2);
    expect(getSessionCount()).toBe(0);
  });
});