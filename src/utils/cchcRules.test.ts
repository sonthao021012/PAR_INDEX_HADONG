import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSectionScore,
  calculateOverallEvaluation,
  getRankingDetails,
  validateCriterionScore,
  generateGoogleAppsScriptCode,
  getDriveFolderPath
} from './cchcRules.ts';
import type { CCHCSection } from '../types/cchc.ts';

test('calculateSectionScore sums up criteria scores without exceeding maxScore', () => {
  const mockSection: CCHCSection = {
    id: 'SEC_1',
    romanNumeral: 'I',
    title: 'Công tác chỉ đạo điều hành',
    maxScore: 2.0,
    criteria: [
      {
        id: '1',
        code: 'I.1',
        title: 'Kế hoạch CCHC',
        maxScore: 1.5,
        selfScore: 1.5,
        status: 'completed',
        department: 'Văn phòng',
        scoringGuide: 'Đúng hạn',
        evidenceList: []
      },
      {
        id: '2',
        code: 'I.2',
        title: 'Nhiệm vụ',
        maxScore: 1.0,
        selfScore: 1.0,
        status: 'completed',
        department: 'Văn phòng',
        scoringGuide: 'Đầy đủ',
        evidenceList: []
      }
    ]
  };

  // sum is 2.5, but maxScore is 2.0
  const score = calculateSectionScore(mockSection);
  assert.equal(score, 2.0);
});

test('calculateOverallEvaluation calculates base, bonus, penalty and rank correctly', () => {
  const sections: CCHCSection[] = [
    {
      id: 'I',
      romanNumeral: 'I',
      title: 'Chỉ đạo điều hành',
      maxScore: 27,
      criteria: [
        {
          id: 'c1',
          code: 'I.1',
          title: 'Tiêu chí 1',
          maxScore: 20,
          selfScore: 20,
          status: 'completed',
          department: 'Văn phòng',
          scoringGuide: 'Hướng dẫn',
          evidenceList: [
            {
              id: 'ev1',
              name: 'Quyết định.pdf',
              type: 'pdf',
              uploadDate: '2026-03-01',
              url: 'https://drive.google.com/test'
            }
          ]
        }
      ]
    },
    {
      id: 'IX_BONUS',
      romanNumeral: 'IX.1',
      title: 'Điểm thưởng',
      maxScore: 10,
      type: 'bonus',
      criteria: [
        {
          id: 'b1',
          code: 'IX.1.a',
          title: 'Sáng kiến',
          maxScore: 2,
          selfScore: 2,
          status: 'completed',
          department: 'Văn phòng',
          scoringGuide: 'Sáng kiến',
          evidenceList: []
        }
      ]
    },
    {
      id: 'IX_PENALTY',
      romanNumeral: 'IX.2',
      title: 'Điểm trừ',
      maxScore: 10,
      type: 'penalty',
      criteria: [
        {
          id: 'p1',
          code: 'IX.2.a',
          title: 'Điểm trừ vi phạm',
          maxScore: 1,
          selfScore: 1,
          status: 'completed',
          department: 'Văn phòng',
          scoringGuide: 'Trừ điểm',
          evidenceList: []
        }
      ]
    }
  ];

  const evalResult = calculateOverallEvaluation(sections);
  // Base score = 20, Bonus = 2, Penalty = 1 -> Final = 21
  assert.equal(evalResult.totalBaseScore, 20);
  assert.equal(evalResult.totalBonusScore, 2);
  assert.equal(evalResult.totalPenaltyScore, 1);
  assert.equal(evalResult.finalScore, 21);
  assert.equal(evalResult.totalEvidenceCount, 1);
  assert.equal(evalResult.totalCriteriaCount, 3);
  assert.equal(evalResult.completedCriteriaCount, 3);
});

test('getRankingDetails returns proper administrative classification', () => {
  assert.equal(getRankingDetails(95).ranking, 'Xuất sắc');
  assert.equal(getRankingDetails(85).ranking, 'Tốt');
  assert.equal(getRankingDetails(75).ranking, 'Khá');
  assert.equal(getRankingDetails(65).ranking, 'Trung bình');
});

test('validateCriterionScore prevents negative or overflowing scores', () => {
  assert.equal(validateCriterionScore(-5, 2), 0);
  assert.equal(validateCriterionScore(5, 2), 2);
  assert.equal(validateCriterionScore(1.25, 2), 1.25);
});

test('generateGoogleAppsScriptCode outputs valid script content with folder name', () => {
  const code = generateGoogleAppsScriptCode({ driveFolderName: 'CCHC_HOI_AN_DONG_TEST' });
  assert.ok(code.includes('CCHC_HOI_AN_DONG_TEST'));
  assert.ok(code.includes('function doPost(e)'));
  assert.ok(code.includes('DriveApp.getFoldersByName'));
});

test('getDriveFolderPath sanitizes Vietnamese characters cleanly', () => {
  const path = getDriveFolderPath('I', 'Chỉ đạo, điều hành', 'I.1.a');
  assert.ok(path.startsWith('CCHC_HoiAnDong_2026/I_'));
  assert.ok(path.endsWith('/I.1.a'));
});
