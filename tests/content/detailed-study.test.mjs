import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { lectureSummaries } from '../../src/lecture-summaries.ts';
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
  assert.ok(component.includes('section.formula, section.example, section.code'));
  assert.ok(component.includes('note.questionsAsked'));
  assert.ok(component.includes('복습 확인 ·'));
  assert.ok(component.includes('원본을 재검증한 표시는 아닙니다'));
});
