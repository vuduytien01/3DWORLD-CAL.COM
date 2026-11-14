/**
 * AI Guide Templates Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  templates,
  matchTemplate,
  getTemplate,
  hasTemplate,
  TEMPLATE_IDS,
  type TemplateResult,
} from '../templates';
import { createSession, sessions, getSession, type GuideSession } from '../session';

describe('AI Guide Templates', () => {
  let session: GuideSession;

  beforeEach(() => {
    sessions.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00Z').getTime());
    session = createSession('sid-test', 'Nguyễn Văn A', '014', 'step-queue');
  });

  it('has 10 templates', () => {
    expect(TEMPLATE_IDS.length).toBe(10);
    expect(Object.keys(templates).length).toBe(10);
  });

  it('all template IDs are defined', () => {
    for (const id of TEMPLATE_IDS) {
      expect(hasTemplate(id)).toBe(true);
      expect(getTemplate(id)).toBeDefined();
    }
  });

  it('greeting template includes patient name and STT', () => {
    const result = templates.greeting(session);
    expect(result.templateId).toBe('greeting');
    expect(result.content).toContain('Nguyễn Văn A');
    expect(result.content).toContain('014');
    expect(result.content).toContain('XẾP HÀNG');
  });

  it('current-status template includes step info and AI message', () => {
    const result = templates['current-status'](session);
    expect(result.templateId).toBe('current-status');
    expect(result.content).toContain('XẾP HÀNG');
    expect(result.content).toContain('QUEUE');
    expect(result.content).toContain('014');
    expect(result.content).toContain('theo dõi màn hình');
  });

  it('wait-update template uses estimate from args or session', () => {
    const result1 = templates['wait-update'](session, { estimate: '5' });
    expect(result1.content).toContain('5 phút');

    const result2 = templates['wait-update'](session, {});
    expect(result2.content).toContain('0 phút');
  });

  it('next-step template shows next step or completion', () => {
    const result = templates['next-step'](session);
    expect(result.templateId).toBe('next-step');
    expect(result.content).toContain('KHÁM');
  });

  it('next-step returns completion message at end of pipeline', () => {
    // Move session to last step
    const lastStepSession = createSession('sid-end', 'Test', '001', 'step-payment');
    const result = templates['next-step'](lastStepSession);
    expect(result.content).toContain('hoàn tất quy trình khám');
  });

  it('department-direction template finds department', () => {
    const result = templates['department-direction'](session, { deptCode: 'KHOA_NOI', floor: '0' });
    expect(result.templateId).toBe('department-direction');
    expect(result.content).toContain('KHOA NỘI');
    expect(result.content).toContain('NỘI');
    expect(result.content).toContain('trái');
  });

  it('department-direction handles unknown department', () => {
    const result = templates['department-direction'](session, { deptCode: 'UNKNOWN', floor: '0' });
    expect(result.content).toContain('không tìm thấy thông tin khoa');
  });

  it('cost-estimate template returns standard range', () => {
    const result = templates['cost-estimate'](session);
    expect(result.templateId).toBe('cost-estimate');
    expect(result.content).toContain('100.000–300.000');
    expect(result.content).toContain('Bảo hiểm y tế');
  });

  it('payment-methods template lists all methods', () => {
    const result = templates['payment-methods'](session);
    expect(result.templateId).toBe('payment-methods');
    expect(result.content).toContain('tiền mặt');
    expect(result.content).toContain('Visa');
    expect(result.content).toContain('Momo');
    expect(result.content).toContain('ZaloPay');
    expect(result.content).toContain('VNPay');
  });

  it('insurance-info template returns standard info', () => {
    const result = templates['insurance-info'](session);
    expect(result.templateId).toBe('insurance-info');
    expect(result.content).toContain('BHYT');
    expect(result.content).toContain('CMND/CCCD');
    expect(result.content).toContain('80–100%');
  });

  it('hospital-info template returns standard info', () => {
    const result = templates['hospital-info'](session);
    expect(result.templateId).toBe('hospital-info');
    expect(result.content).toContain('7:00–19:00');
    expect(result.content).toContain('Cấp cứu 24/7');
  });

  it('fallback template includes original question', () => {
    const result = templates['fallback'](session, { question: 'thời tiết' });
    expect(result.templateId).toBe('fallback');
    expect(result.content).toContain('thời tiết');
    expect(result.content).toContain('Chờ bao lâu');
  });

  it('matchTemplate routes wait questions to wait-update', () => {
    const match = matchTemplate('Còn chờ bao lâu?', session);
    expect(match?.templateId).toBe('wait-update');

    const match2 = matchTemplate('thời gian chờ', session);
    expect(match2?.templateId).toBe('wait-update');

    const match3 = matchTemplate('wait time', session);
    expect(match3?.templateId).toBe('wait-update');
  });

  it('matchTemplate routes next step questions to next-step', () => {
    const match = matchTemplate('Bước tiếp theo là gì?', session);
    expect(match?.templateId).toBe('next-step');

    const match2 = matchTemplate('xong rồi', session);
    expect(match2?.templateId).toBe('next-step');
  });

  it('matchTemplate routes cost questions to cost-estimate', () => {
    const match = matchTemplate('Chi phí bao nhiêu?', session);
    expect(match?.templateId).toBe('cost-estimate');

    const match2 = matchTemplate('giá khám', session);
    expect(match2?.templateId).toBe('cost-estimate');
  });

  it('matchTemplate routes payment questions to payment-methods', () => {
    const match = matchTemplate('Thanh toán như thế nào?', session);
    expect(match?.templateId).toBe('payment-methods');

    const match2 = matchTemplate('VNPay được không?', session);
    expect(match2?.templateId).toBe('payment-methods');
  });

  it('matchTemplate routes insurance questions to insurance-info', () => {
    const match = matchTemplate('BHYT chi trả bao nhiêu?', session);
    expect(match?.templateId).toBe('insurance-info');

    const match2 = matchTemplate('thẻ bảo hiểm', session);
    expect(match2?.templateId).toBe('insurance-info');
  });

  it('matchTemplate routes department questions to department-direction', () => {
    const match = matchTemplate('Khoa NGOAI ở đâu?', session);
    expect(match?.templateId).toBe('department-direction');
    expect(match?.args.deptCode).toBe('KHOA_NGOAI');
    expect(match?.args.floor).toBe('0');
  });

  it('matchTemplate routes hospital info questions to hospital-info', () => {
    const match = matchTemplate('Địa chỉ bệnh viện?', session);
    expect(match?.templateId).toBe('hospital-info');

    const match2 = matchTemplate('Mở cửa mấy giờ?', session);
    expect(match2?.templateId).toBe('hospital-info');
  });

  it('matchTemplate routes greeting to greeting', () => {
    const match = matchTemplate('Chào bạn', session);
    expect(match?.templateId).toBe('greeting');

    const match2 = matchTemplate('xin chào', session);
    expect(match2?.templateId).toBe('greeting');
  });

  it('matchTemplate returns null for unrecognized', () => {
    const match = matchTemplate('Thời tiết hôm nay thế nào?', session);
    expect(match).toBeNull();
  });

  it('explicit commands (menu, giúp) route to current-status', () => {
    const match1 = matchTemplate('menu', session);
    expect(match1?.templateId).toBe('current-status');

    const match2 = matchTemplate('giúp', session);
    expect(match2?.templateId).toBe('current-status');

    const match3 = matchTemplate('help', session);
    expect(match3?.templateId).toBe('current-status');
  });
});