/**
 * Triage tests — spec 03 acceptance criteria:
 * triageDepartment("đau bụng") → KHOA_NOI, triageDepartment("đau răng") → KHOA_RHM
 * triageDepartmentAcrossFloors("đau ngực") → KHOA_NOI_TM (tầng 5), triageDepartmentAcrossFloors("siêu âm") → KHOA_CDHASA (tầng 8)
 */

import { describe, it, expect } from 'vitest';
import { triageDepartment, triageDepartmentAcrossFloors, type UpperFloorDepartment } from '../triage';
import { GROUND_FLOOR_DEPARTMENTS } from '../../step-graph/department-locations';

describe('triageDepartment', () => {
  it('routes "đau bụng" to KHOA_NOI (spec 03 acceptance)', () => {
    const dept = triageDepartment('đau bụng');
    expect(dept?.code).toBe('KHOA_NOI');
  });

  it('routes "đau răng" to KHOA_RHM (spec 03 acceptance)', () => {
    const dept = triageDepartment('đau răng');
    expect(dept?.code).toBe('KHOA_RHM');
  });

  it('routes eye symptoms to KHOA_MAT', () => {
    const dept = triageDepartment('Tôi bị mờ mắt mấy hôm nay');
    expect(dept?.code).toBe('KHOA_MAT');
  });

  it('routes ENT symptoms to KHOA_TMH', () => {
    const dept = triageDepartment('viêm xoang mãn tính');
    expect(dept?.code).toBe('KHOA_TMH');
  });

  it('routes imaging requests to KHOA_CDHA', () => {
    const dept = triageDepartment('cần chụp x-quang ngực');
    expect(dept?.code).toBe('KHOA_CDHA');
  });

  it('routes surgery keywords to KHOA_NGOAI', () => {
    const dept = triageDepartment('bác sĩ bảo viêm ruột thừa cần mổ');
    expect(dept?.code).toBe('KHOA_NGOAI');
  });

  it('routes admin requests to the admin departments', () => {
    expect(triageDepartment('tôi muốn lấy vé')?.code).toBe('KHOA_TIEP_DON');
    expect(triageDepartment('em cần thanh toán viện phí')?.code).toBe('KHOA_THANH_TOAN');
  });

  it('scores multi-keyword symptoms to the department with most hits', () => {
    const dept = triageDepartment('sốt và đau bụng');
    expect(dept?.code).toBe('KHOA_NOI');
  });

  it('is case-insensitive (spec 03: simple lowercase substring)', () => {
    const dept = triageDepartment('Đau Bụng kéo dài');
    expect(dept?.code).toBe('KHOA_NOI');
  });

  it('does not match accent-stripped input (spec 03 v0 limitation: plain substring)', () => {
    expect(triageDepartment('DAU BUNG')).toBeUndefined();
  });

  it('returns undefined when no keyword matches', () => {
    expect(triageDepartment('thời tiết hôm nay đẹp quá')).toBeUndefined();
    expect(triageDepartment('')).toBeUndefined();
  });

  it('returns the full DepartmentSpec shape from step-graph', () => {
    const dept = triageDepartment('đau bụng');
    expect(dept).toBeDefined();
    expect(typeof dept?.name).toBe('string');
    expect(typeof dept?.floor).toBe('number');
    expect(Array.isArray(dept?.rooms)).toBe(true);
    expect(Array.isArray(dept?.triageKeywords)).toBe(true);
    expect(GROUND_FLOOR_DEPARTMENTS).toContain(dept);
  });
});

describe('triageDepartmentAcrossFloors', () => {
  it('routes "chấn thương sọ não" to NGOẠI THẦN KINH on floor 5 (unique upper floor keyword)', () => {
    const dept = triageDepartmentAcrossFloors('chấn thương sọ não');
    expect(dept).toBeDefined();
    expect('displayFloor' in dept!).toBe(true);
    const upper = dept as UpperFloorDepartment;
    expect(upper.code).toBe('KHOA_NGOAI_TK');
    expect(upper.name).toBe('KHOA NGOẠI THẦN KINH');
    expect(upper.displayFloor).toBe(5);
    expect(upper.floorIndex).toBe(4);
  });

  it('routes "siêu âm tim" to SIÊU ÂM on floor 8 (multi-keyword beats ground CDHA)', () => {
    // Ground CDHA has "siêu âm" (1 match), upper KHOA_CDHASA has "siêu âm" + "siêu âm tim" (2 matches)
    const dept = triageDepartmentAcrossFloors('siêu âm tim');
    expect(dept).toBeDefined();
    expect('displayFloor' in dept!).toBe(true);
    const upper = dept as UpperFloorDepartment;
    expect(upper.code).toBe('KHOA_CDHASA');
    expect(upper.name).toBe('KHOA SIÊU ÂM');
    expect(upper.displayFloor).toBe(8);
    expect(upper.floorIndex).toBe(7);
  });

  it('routes ground floor keywords to ground departments (unchanged behavior)', () => {
    const noi = triageDepartmentAcrossFloors('đau bụng');
    expect(noi).toBeDefined();
    expect('floor' in noi!).toBe(true);
    expect(noi?.code).toBe('KHOA_NOI');

    const rhm = triageDepartmentAcrossFloors('đau răng');
    expect(rhm).toBeDefined();
    expect('floor' in rhm!).toBe(true);
    expect(rhm?.code).toBe('KHOA_RHM');
  });

  it('returns undefined when no keyword matches anywhere', () => {
    expect(triageDepartmentAcrossFloors('thời tiết đẹp quá')).toBeUndefined();
    expect(triageDepartmentAcrossFloors('')).toBeUndefined();
  });

  it('upper floor department has correct UpperFloorDepartment shape', () => {
    const dept = triageDepartmentAcrossFloors('chấn thương sọ não');
    expect(dept).toBeDefined();
    expect('displayFloor' in dept!).toBe(true);
    const upper = dept as UpperFloorDepartment;
    expect(typeof upper.shortCode).toBe('string');
    expect(typeof upper.signageColor).toBe('string');
    expect(Array.isArray(upper.roomLabels)).toBe(true);
    expect(Array.isArray(upper.triageKeywords)).toBe(true);
  });
});
