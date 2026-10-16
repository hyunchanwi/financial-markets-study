import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { findLectureSummaries, getLectureSearchText, lectureSummaries } from '../../src/lecture-summaries.ts';
import { scopeOptions, studyNotes } from '../../src/claude-study-data.ts';

test('상세 정리는 강의 전체 흐름과 출처·녹음 상태를 제공한다', () => {
  const scopeIds = scopeOptions.map((scope) => scope.id);
  const coveredScopes = new Set(lectureSummaries.flatMap((lecture) => lecture.scopes));
  assert.deepEqual([...coveredScopes].sort(), ["ch1","ch2","ch3","ch4","ch5"].sort());
  assert.equal(new Set(lectureSummaries.map((lecture) => lecture.id)).size, lectureSummaries.length);
  for (const lecture of lectureSummaries) {
    assert.ok(lecture.scopes.every((scope) => scopeIds.includes(scope)));
    assert.ok(lecture.overview && lecture.location && lecture.recordingStatus);
    assert.ok(lecture.sources.length > 0);
    assert.ok(lecture.sections.length >= 3);
    for (const section of lecture.sections) {
      assert.ok(section.title);
      assert.ok(section.paragraphs.length >= 2);
      assert.ok(section.paragraphs.every((paragraph) => paragraph.length >= 30));
    }
  }
});

test('실제 질문 요지와 별도 복습 문제를 구분하고 상세 본문도 검색한다', () => {
  for (const note of studyNotes) {
    assert.ok(note.questionsAsked.length > 0);
    assert.ok(note.questionsAsked.every((question) => question.trim().length > 0));
    assert.ok(note.question && note.answer);
  }
  const component = readFileSync(new URL('../../app/claude-study-notes.tsx', import.meta.url), 'utf8');
  assert.ok(component.includes('함께 공부한 내용 · 강의별 상세 정리'));
  assert.ok(component.includes('내가 질문·헷갈렸던 부분'));
  assert.ok(component.includes('findLectureSummaries(currentScope, query)'));
  assert.ok(component.includes('section.checks?.map'));
  assert.ok(component.includes('note.questionsAsked'));
  assert.ok(component.includes('복습 확인 ·'));
  assert.ok(component.includes('원본을 재검증한 표시는 아닙니다'));
});

test('GPT 추가 설명·접힌 해설을 검색하되 장 경계를 넘지 않는다', () => {
  assert.deepEqual(findLectureSummaries('ch2', '공개 재무제표').map((lecture) => lecture.id), ['financial-efficiency']);
  assert.deepEqual(findLectureSummaries('ch3', '공개 재무제표'), []);
  assert.deepEqual(findLectureSummaries('ch4', '  CD   RP  ').map((lecture) => lecture.id), ['financial-money-market']);
  assert.deepEqual(findLectureSummaries('ch5', '재정증권'), []);
  assert.deepEqual(findLectureSummaries('ch99'), []);
  assert.equal(findLectureSummaries('all').length, lectureSummaries.length);
  for (const lecture of lectureSummaries) for (const section of lecture.sections) for (const check of section.checks ?? []) {
    assert.ok(check.question && check.answer);
    assert.ok(getLectureSearchText(lecture).includes(check.answer.toLocaleLowerCase()));
  }
  const component = readFileSync(new URL('../../app/claude-study-notes.tsx', import.meta.url), 'utf8');
  assert.ok(component.includes('locked ? initialScope : scope'));
  assert.ok(component.includes('별도 복습 확인'));
  assert.ok(component.includes('GPT·Claude'));
  assert.ok(component.includes('20,000자 제한'));
});

test('콜·RP 원금 단위, CD 할인 분모, 시장기회선의 공개 계산을 독립 검산한다', () => {
  const money = getLectureSearchText(lectureSummaries.find((lecture) => lecture.id === 'financial-money-market'));
  const interest = 10_000_000_000 * 0.0365 / 365;
  assert.equal(interest, 1_000_000);
  assert.ok(money.includes(`${interest / 10_000}만원`));
  assert.ok(money.includes(`${interest * 7 / 10_000}만원`));
  const face = 10_000_000;
  const price = face - face * 0.04 * 90 / 365;
  assert.ok(money.includes(`${Math.round(price).toLocaleString('en-US')}원`));
  const annualYield = (face / price - 1) * 365 / 90;
  assert.ok(annualYield > 0.04);
  assert.ok(money.includes(`${(annualYield * 100).toFixed(4)}%`));
  const efficiency = getLectureSearchText(lectureSummaries.find((lecture) => lecture.id === 'financial-efficiency'));
  assert.ok(efficiency.includes(String(121 + 26 * 1.1)));
  assert.ok(efficiency.includes(String(121 / 1.1 + 100)));
  assert.match(money, /원 표.*복원한 것이 아닌 재구성 예/);
});

test('게시용 통합 데이터에 비공개 경로·산출물 링크를 넣지 않는다', () => {
  const content = JSON.stringify({ lectureSummaries, studyNotes });
  assert.doesNotMatch(content, /sandbox:|\/Users\/|\/mnt\/data|https?:\/\/[^\s"]*chatgpt\.com\/c\//);
  assert.ok(studyNotes.some((note) => note.source.includes('GPT')));
});
