/**
 * Location Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  onStepChange,
  onSymptomsDescribed,
  onWaitEstimateUpdate,
  onPipelineComplete,
  getCurrentStepLocation,
  getTriagedDepartment,
  updatePatientSTT,
  updatePatientName,
} from '../location-integration';
import { createSession, sessions, getSession, type GuideSession } from '../session';
import { STEP_IDS_IN_ORDER } from '../../step-graph/step-locations';
import process from "node:process";

describe('Location Integration', () => {
  beforeEach(() => {
    sessions.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());
    process.env.FREELLM_STUB = 'true';
  });

  it('onStepChange updates step and wait estimate', () => {
    createSession('sid-1', 'Test', '001', 'step-ticket');
    onStepChange('sid-1', 'step-queue', 8);

    const session = getSession('sid-1');
    expect(session?.currentStepId).toBe('step-queue');
    expect(session?.waitEstimate).toBe(8);
    expect(session?.currentStep.label).toBe('XẾP HÀNG');
  });

  it('onStepChange logs warning for unknown stepId', () => {
    createSession('sid-2', 'Test', '002', 'step-ticket');
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onStepChange('sid-2', 'unknown-step', 5);
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unknown stepId: unknown-step')
    );
    consoleSpy.mockRestore();
  });

  it('onStepChange does nothing for non-existent session', () => {
    onStepChange('non-existent', 'step-queue', 5);
    // Should not throw
  });

  it('advances a session through the whole pipeline (session advance)', () => {
    createSession('sid-advance', 'Tiến Triển', '030', 'step-ticket');
    const waits = [10, 15, 20, 10, 5, 30, 5]; // waits for the 7 transitions after step-ticket

    STEP_IDS_IN_ORDER.slice(1).forEach((stepId, i) => {
      onStepChange('sid-advance', stepId, waits[i]);
    });

    const session = getSession('sid-advance');
    expect(session?.currentStepId).toBe('step-payment');
    expect(session?.currentStep.label).toBe('THANH TOÁN');
    expect(session?.waitEstimate).toBe(5);
    expect(session?.history.length).toBe(waits.length);
    expect(session?.history.every((t) => t.templateId === 'wait-update')).toBe(true);
    expect(session?.history[waits.length - 1].content).toContain('5 phút');
  });

  it('onSymptomsDescribed triages to correct department', () => {
    createSession('sid-3', 'Test', '003', 'step-ticket');
    const dept = onSymptomsDescribed('sid-3', 'đau bụng');
    expect(dept?.code).toBe('KHOA_NOI');

    const session = getSession('sid-3');
    expect(session?.triagedDepartment?.code).toBe('KHOA_NOI');
  });

  it('onSymptomsDescribed returns undefined for unknown symptoms', () => {
    createSession('sid-4', 'Test', '004', 'step-ticket');
    const dept = onSymptomsDescribed('sid-4', 'thời tiết');
    expect(dept).toBeUndefined();
  });

  it('onSymptomsDescribed adds assistant turn with direction', () => {
    createSession('sid-5', 'Test', '005', 'step-ticket');
    onSymptomsDescribed('sid-5', 'đau răng');

    const session = getSession('sid-5');
    const assistantTurn = session?.history.find((t) => t.role === 'assistant');
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.templateId).toBe('department-direction');
    expect(assistantTurn?.usedLLM).toBe(false);
  });

  it('onSymptomsDescribed does nothing for non-existent session', () => {
    expect(onSymptomsDescribed('non-existent', 'đau bụng')).toBeUndefined();
  });

  it('onWaitEstimateUpdate updates wait estimate', () => {
    createSession('sid-6', 'Test', '006', 'step-queue');
    onWaitEstimateUpdate('sid-6', 10);

    const session = getSession('sid-6');
    expect(session?.waitEstimate).toBe(10);
  });

  it('onPipelineComplete sends completion message', () => {
    createSession('sid-7', 'Test', '007', 'step-payment');
    onPipelineComplete('sid-7');

    const session = getSession('sid-7');
    const assistantTurn = session?.history.find((t) => t.role === 'assistant');
    expect(assistantTurn).toBeDefined();
    expect(assistantTurn?.content).toContain('hoàn tất quy trình khám');
  });

  it('getCurrentStepLocation returns step info', () => {
    createSession('sid-8', 'Test', '008', 'step-consultation');
    const loc = getCurrentStepLocation('sid-8');
    expect(loc).not.toBeNull();
    expect(loc?.stepId).toBe('step-consultation');
    expect(loc?.label).toBe('KHÁM');
    expect(loc?.position).toEqual({ x: 0, y: 1.5, z: 8.0 });
  });

  it('getCurrentStepLocation returns null for non-existent', () => {
    expect(getCurrentStepLocation('non-existent')).toBeNull();
  });

  it('getTriagedDepartment returns triaged department', () => {
    createSession('sid-9', 'Test', '009', 'step-ticket');
    onSymptomsDescribed('sid-9', 'đau răng');
    const dept = getTriagedDepartment('sid-9');
    expect(dept?.code).toBe('KHOA_RHM');
  });

  it('getTriagedDepartment returns undefined if not triaged', () => {
    createSession('sid-10', 'Test', '010', 'step-ticket');
    expect(getTriagedDepartment('sid-10')).toBeUndefined();
  });

  it('updatePatientSTT updates STT number', () => {
    createSession('sid-11', 'Test', '011', 'step-ticket');
    const result = updatePatientSTT('sid-11', '050');
    expect(result).toBe(true);

    const session = getSession('sid-11');
    expect(session?.stt).toBe('050');
  });

  it('updatePatientSTT returns false for non-existent', () => {
    expect(updatePatientSTT('non-existent', '050')).toBe(false);
  });

  it('updatePatientName updates patient name', () => {
    createSession('sid-12', 'Old Name', '012', 'step-ticket');
    const result = updatePatientName('sid-12', 'New Name');
    expect(result).toBe(true);

    const session = getSession('sid-12');
    expect(session?.patientName).toBe('New Name');
  });

  it('updatePatientName returns false for non-existent', () => {
    expect(updatePatientName('non-existent', 'New Name')).toBe(false);
  });
});