/**
 * Department Locations Tests
 */

import { describe, it, expect } from 'vitest';
import {
  GROUND_FLOOR_DEPARTMENTS,
  ALL_FLOOR_DEPARTMENTS,
  getDepartment,
  getDepartmentsOnFloor,
  getSpecialtyDepartments,
  triageDepartment,
  ROOM_KIND_FURNITURE,
  getDepartmentWorldOrigin,
  type DepartmentSpec,
  type RoomKind,
} from '../department-locations';

describe('Department Locations', () => {
  it('ground floor has 8 departments (2 admin + 6 specialty)', () => {
    expect(GROUND_FLOOR_DEPARTMENTS.length).toBe(8);
  });

  it('ground floor has expected department codes', () => {
    const codes = GROUND_FLOOR_DEPARTMENTS.map((d) => d.code);
    expect(codes).toEqual([
      'KHOA_TIEP_DON',
      'KHOA_NOI',
      'KHOA_CDHA',
      'KHOA_NGOAI',
      'KHOA_MAT',
      'KHOA_TMH',
      'KHOA_RHM',
      'KHOA_THANH_TOAN',
    ]);
  });

  it('ALL_FLOOR_DEPARTMENTS generates 10 floors with 6 specialty each = 60 + 2 admin = 62', () => {
    // Ground: 8 depts (2 admin + 6 specialty)
    // Floors 1-9: 6 specialty each = 54
    // Total = 62
    expect(ALL_FLOOR_DEPARTMENTS.length).toBe(62);
  });

  it('floors 1-9 have only specialty departments (no admin)', () => {
    for (let f = 1; f <= 9; f++) {
      const depts = getDepartmentsOnFloor(f);
      expect(depts.length).toBe(6);
      for (const dept of depts) {
        expect(['KHOA_TIEP_DON', 'KHOA_THANH_TOAN']).not.toContain(dept.code);
      }
    }
  });

  it('getDepartment finds department by code and floor', () => {
    const dept = getDepartment('KHOA_NOI', 0);
    expect(dept).toBeDefined();
    expect(dept?.code).toBe('KHOA_NOI');
    expect(dept?.floor).toBe(0);
  });

  it('getDepartment returns undefined for non-existent', () => {
    expect(getDepartment('KHOA_NOI', 99)).toBeUndefined();
    expect(getDepartment('UNKNOWN', 0)).toBeUndefined();
  });

  it('getDepartmentsOnFloor returns correct departments', () => {
    const ground = getDepartmentsOnFloor(0);
    expect(ground.length).toBe(8);

    const floor3 = getDepartmentsOnFloor(3);
    expect(floor3.length).toBe(6);
  });

  it('getSpecialtyDepartments excludes admin departments', () => {
    const specialty = getSpecialtyDepartments(0);
    expect(specialty.length).toBe(6);
    for (const dept of specialty) {
      expect(['KHOA_TIEP_DON', 'KHOA_THANH_TOAN']).not.toContain(dept.code);
    }
  });

  it('department codes are unique per floor', () => {
    for (let f = 0; f <= 9; f++) {
      const depts = getDepartmentsOnFloor(f);
      const codes = depts.map((d) => d.code);
      expect(new Set(codes).size).toBe(codes.length);
    }
  });

  it('all specialty departments have triage keywords', () => {
    for (const dept of GROUND_FLOOR_DEPARTMENTS) {
      if (!['KHOA_TIEP_DON', 'KHOA_THANH_TOAN'].includes(dept.code)) {
        expect(dept.triageKeywords.length).toBeGreaterThan(0);
      }
    }
  });

  it('signage colors are valid hex', () => {
    const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const dept of GROUND_FLOOR_DEPARTMENTS) {
      expect(hexColorRegex.test(dept.signageColor)).toBe(true);
    }
  });

  it('ROOM_KIND_FURNITURE maps all room kinds', () => {
    const roomKinds: RoomKind[] = [
      'exam',
      'xray',
      'ultrasound',
      'surgery',
      'ophthalmology',
      'ent',
      'dental',
      'waiting',
      'reception',
      'payment',
    ];
    for (const kind of roomKinds) {
      expect(ROOM_KIND_FURNITURE[kind]).toBeDefined();
      expect(ROOM_KIND_FURNITURE[kind].length).toBeGreaterThan(0);
    }
  });

  it('getDepartmentWorldOrigin returns correct origin', () => {
    const origin = getDepartmentWorldOrigin('KHOA_NOI', 0);
    expect(origin).toEqual({ x: -12, z: 15 });
  });

  it('rooms have valid door positions on perimeter', () => {
    for (const dept of GROUND_FLOOR_DEPARTMENTS) {
      for (const room of dept.rooms) {
        if (room.doorWidth > 0) {
          const hw = room.size.width / 2;
          const hd = room.size.depth / 2;
          const dx = room.doorOffset.x;
          const dz = room.doorOffset.z;
          const onEdge =
            Math.abs(Math.abs(dx) - hw) < 0.01 ||
            Math.abs(Math.abs(dz) - hd) < 0.01;
          expect(onEdge).toBe(true);
        }
      }
    }
  });

  it('triageDepartment maps common symptoms correctly', () => {
    const testCases: Array<{ symptoms: string; expectedCode: string }> = [
      { symptoms: 'đau bụng', expectedCode: 'KHOA_NOI' },
      { symptoms: 'đau răng', expectedCode: 'KHOA_RHM' },
      { symptoms: 'khó thở', expectedCode: 'KHOA_NOI' },
      { symptoms: 'mổ', expectedCode: 'KHOA_NGOAI' },
      { symptoms: 'x-quang', expectedCode: 'KHOA_CDHA' },
      { symptoms: 'siêu âm', expectedCode: 'KHOA_CDHA' },
      { symptoms: 'đau mắt', expectedCode: 'KHOA_MAT' },
      { symptoms: 'đau tai', expectedCode: 'KHOA_TMH' },
      { symptoms: 'thanh toán', expectedCode: 'KHOA_THANH_TOAN' },
    ];

    for (const tc of testCases) {
      const dept = triageDepartment(tc.symptoms);
      expect(dept).toBeDefined();
      expect(dept?.code).toBe(tc.expectedCode);
    }
  });

  it('triageDepartment returns undefined for unknown symptoms', () => {
    expect(triageDepartment('thời tiết')).toBeUndefined();
    expect(triageDepartment('')).toBeUndefined();
  });

  it('floors have 100m Z separation', () => {
    const noiFloor0 = getDepartment('KHOA_NOI', 0);
    const noiFloor1 = getDepartment('KHOA_NOI', 1);
    const noiFloor2 = getDepartment('KHOA_NOI', 2);

    expect(noiFloor0).toBeDefined();
    expect(noiFloor1).toBeDefined();
    expect(noiFloor2).toBeDefined();

    if (noiFloor0 && noiFloor1 && noiFloor2) {
      expect(noiFloor1.worldOrigin.z - noiFloor0.worldOrigin.z).toBe(100);
      expect(noiFloor2.worldOrigin.z - noiFloor1.worldOrigin.z).toBe(100);
    }
  });
});