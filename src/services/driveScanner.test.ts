import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractCriterionCodeFromText,
  matchCriterionByKeywords,
  parseDriveLinksAndFiles,
  batchAttachEvidenceItems,
} from './driveScanner.ts';
import type { CCHCSection } from '../types/cchc.ts';

test('extractCriterionCodeFromText handles 4-part criterion codes', () => {
  assert.equal(extractCriterionCodeFromText('I.2.b.1_Ke_hoach_CCHC.pdf'), 'I.2.b.1');
  assert.equal(extractCriterionCodeFromText('I.6.c.2_infographic.png'), 'I.6.c.2');
  assert.equal(extractCriterionCodeFromText('VII.4.b_so_hoa_ho_so.pdf'), 'VII.4.b');
});

test('extractCriterionCodeFromText handles underscored and hyphenated filenames', () => {
  assert.equal(extractCriterionCodeFromText('minhchung_III.4.c.pdf'), 'III.4.c');
  assert.equal(extractCriterionCodeFromText('VII.6_camera_IOC.png'), 'VII.6');
  assert.equal(extractCriterionCodeFromText('IX.2.đ_nhac_nho.pdf'), 'IX.2.đ');
  assert.equal(extractCriterionCodeFromText('V_6_a_danh_gia_thang.pdf'), 'V.6.a');
  assert.equal(extractCriterionCodeFromText('TC_I.1.a.docx'), 'I.1.a');
  assert.equal(extractCriterionCodeFromText('I-1-b.pdf'), 'I.1.b');
  assert.equal(extractCriterionCodeFromText('II.2.a.pdf'), 'II.2.a');
  assert.equal(extractCriterionCodeFromText('VI.3_quy_che.pdf'), 'VI.3');
  assert.equal(extractCriterionCodeFromText('I.8_sang_kien.pdf'), 'I.8');
});

test('matchCriterionByKeywords identifies common administrative file titles', () => {
  assert.equal(matchCriterionByKeywords('Kế hoạch CCHC năm 2026.pdf'), 'I.2.a');
  assert.equal(matchCriterionByKeywords('Quy chế chi tiêu nội bộ năm 2026.docx'), 'VI.3');
  assert.equal(matchCriterionByKeywords('Báo cáo kết quả kiểm tra CCHC.pdf'), 'I.4.b');
  assert.equal(matchCriterionByKeywords('Camera giám sát một cửa IOC.png'), 'VII.6');
});

test('parseDriveLinksAndFiles parses Google Drive links with file IDs', () => {
  const raw = `
    https://drive.google.com/file/d/1YGN6xTV7rtOT9dGZUbcA4HS4qGdhKsmc/view?usp=sharing - Kế hoạch I.1.a
    https://drive.google.com/file/d/1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq/view - Minh chứng VII.6
  `;
  const parsed = parseDriveLinksAndFiles(raw);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].driveFileId, '1YGN6xTV7rtOT9dGZUbcA4HS4qGdhKsmc');
  assert.equal(parsed[0].criterionCode, 'I.1.a');
  assert.equal(parsed[1].driveFileId, '1eiE_ZX12JzBm9HBMf1jvMm64SEuZUvkq');
  assert.equal(parsed[1].criterionCode, 'VII.6');
});

test('batchAttachEvidenceItems attaches files and updates criterion score', () => {
  const mockSections: CCHCSection[] = [
    {
      id: 'I',
      romanNumeral: 'I',
      title: 'Chỉ đạo điều hành',
      maxScore: 25,
      criteria: [
        {
          id: 'I.1.a',
          code: 'I.1.a',
          title: 'Kế hoạch CCHC',
          maxScore: 1.0,
          selfScore: 0,
          status: 'not_started',
          department: 'Văn phòng',
          evidenceList: [],
        },
      ],
    },
  ];

  const items = [
    {
      id: 'item-1',
      name: 'I.1.a_Ke_hoach.pdf',
      url: 'https://drive.google.com/file/d/123/view',
      driveFileId: '123',
      criterionCode: 'I.1.a',
    },
  ];

  const result = batchAttachEvidenceItems(items, mockSections);
  assert.equal(result.attachedCount, 1);
  const updatedCrit = result.updatedSections[0].criteria[0];
  assert.equal(updatedCrit.evidenceList.length, 1);
  assert.equal(updatedCrit.status, 'completed');
  assert.equal(updatedCrit.selfScore, 1.0);
});
