'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { courseName, scopeOptions, studyNotes } from '../src/claude-study-data';
import { lectureSummaries } from '../src/lecture-summaries';

export function StudyNotesJump({ children }: { children: ReactNode }) {
  return <a className="claude-notes-jump" href="#study-conversation-notes" onClick={(event) => {
    event.preventDefault();
    document.getElementById('study-conversation-notes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }}>{children}</a>;
}

export function ClaudeStudyNotes({ initialScope = 'all', locked = false }: { initialScope?: string; locked?: boolean }) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(initialScope);
  const currentScope = locked ? initialScope : scope;
  const scopeLabel = scopeOptions.find((item) => item.id === currentScope)?.label ?? (currentScope.startsWith('ch') ? `${currentScope.slice(2)}장 · 추가 학습 정리 미확인` : '전체 강의');
  const terms = useMemo(() => query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean), [query]);
  const scopedLectures = useMemo(() => lectureSummaries.filter((lecture) => currentScope === 'all' || lecture.scopes.includes(currentScope)), [currentScope]);
  const scopedNotes = useMemo(() => studyNotes.filter((note) => currentScope === 'all' || note.scopes.includes(currentScope)), [currentScope]);
  const lectures = useMemo(() => scopedLectures.filter((lecture) => {
    const searchable = [lecture.title, lecture.overview, lecture.location, lecture.recordingStatus, ...lecture.sources,
      ...lecture.sections.flatMap((section) => [section.title, ...section.paragraphs, section.formula, section.example, section.code])].join(' ').toLocaleLowerCase();
    return terms.every((term) => searchable.includes(term));
  }), [scopedLectures, terms]);
  const results = useMemo(() => scopedNotes.filter((note) => terms.every((term) =>
    [note.title, note.chapter, note.source, note.location, ...note.questionsAsked, ...note.explanation, note.question, note.answer].join(' ').toLocaleLowerCase().includes(term),
  )), [scopedNotes, terms]);

  return (
    <section className="claude-notes-inline" id="study-conversation-notes" aria-labelledby="claude-notes-title">
      <header className="claude-notes-header">
        <p className="claude-notes-label">{courseName} · {scopeLabel}</p>
        <h2 id="claude-notes-title">함께 공부한 내용 총정리 + 내 질문·혼동 노트</h2>
      </header>
      <div className="claude-notes-body">
        <p className="claude-notes-notice">기존 본문에 이어, 내보내기에서 확인한 학습 대화의 개념·풀이를 강의별로 상세 재구성했습니다. 아래 ① 전체 학습 정리와 ② 내가 질문·헷갈린 부분은 별개입니다. 강의 번호를 주차 번호로 임의 변환하지 않았습니다. 페이지와 녹음 언급은 과거 대화 기준이며 이번 작업에서 원본을 재검증한 표시는 아닙니다. 내보내기에 없는 그림·산출물·Cowork 내용까지 모두 복원한 것은 아닙니다. 일반 보충과 편집 예제는 구분합니다.</p>
        <div className="claude-notes-filters">
          <label>이 범위에서 검색<input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="학습 개념, 질문, 코드, 페이지 검색" /></label>
          {!locked && <label>학습 강의 선택<select value={scope} onChange={(event) => { setScope(event.target.value); setQuery(''); }}><option value="all">전체 강의</option>{scopeOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>}
        </div>
        <output aria-live="polite" className="claude-notes-count">{scopeLabel} · 학습 정리 {lectures.length} / {scopedLectures.length}개 · 질문·혼동 노트 {results.length} / {scopedNotes.length}개</output>
        {scopedLectures.length === 0 && scopedNotes.length === 0 && <p>이 범위에 추가할 학습 대화는 아직 확인되지 않았습니다. 기존 본문은 그대로 유지합니다.{locked ? ' 다른 장은 왼쪽 장 목록에서 선택하세요.' : ' 확인된 다른 강의는 위 선택 목록에서 볼 수 있습니다.'}</p>}
        {(scopedLectures.length > 0 || scopedNotes.length > 0) && lectures.length === 0 && results.length === 0 && <p>일치하는 학습 정리나 질문이 없습니다. 검색어를 바꿔보세요.</p>}
        {lectures.length > 0 && <section aria-labelledby="claude-learning-summary">
          <h3 className="claude-notes-group-title" id="claude-learning-summary">① 함께 공부한 내용 · 강의별 상세 정리</h3>
          <p>개념 → 원리·풀이 순서 → 수식·작은 예제의 순서로 읽습니다. 검색 시 일치한 강의의 전체 설명을 유지합니다.</p>
          <nav className="claude-notes-outline" aria-label="상세 학습 정리 목차">{lectures.map((lecture) => <a key={lecture.id} href={`#learning-${lecture.id}`} onClick={(event) => {
            event.preventDefault();
            document.getElementById(`learning-${lecture.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>{lecture.title}</a>)}</nav>
          {lectures.map((lecture) => <article key={lecture.id} className="claude-notes-card claude-notes-lecture" id={`learning-${lecture.id}`}>
            <h4>{lecture.title}</h4>
            <div className="claude-notes-detail">
              <p className="claude-notes-overview">{lecture.overview}</p>
              <p className="claude-notes-source-status"><strong>자료 위치:</strong> {lecture.location}<br /><strong>녹음 근거 상태:</strong> {lecture.recordingStatus}</p>
              {lecture.sections.map((section, sectionIndex) => <section key={section.title} className="claude-notes-topic">
                <h5><span>{String(sectionIndex + 1).padStart(2, '0')}</span>{section.title}</h5>
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.formula && <pre className="claude-notes-formula">{section.formula}</pre>}
                {section.example && <p className="claude-notes-example">{section.example}</p>}
                {section.code && <pre className="claude-notes-code"><code>{section.code}</code></pre>}
              </section>)}
              <footer><strong>학습 대화 출처:</strong> {lecture.sources.join(' / ')}<br />과거 대화의 설명을 편집하여 재구성 / 현재 원본 PDF·전사본 대조 전</footer>
            </div>
          </article>)}
        </section>}
        {results.length > 0 && <section aria-labelledby="claude-personal-questions">
          <h3 className="claude-notes-group-title" id="claude-personal-questions">② 내가 질문·헷갈렸던 부분</h3>
          <p>실제 질문의 요지를 개인 식별정보 없이 바꿔 적었습니다. 아래 접힌 확인 문제는 별도로 편집한 복습 문제이며 실제 질문 원문과 구분합니다.</p>
          {results.map((note) => <article key={note.id} className="claude-notes-card" id={`conversation-${note.id}`}>
            <h4><span>{note.chapter}</span>{note.title}</h4>
            <div className="claude-notes-detail">
              <div className="claude-notes-asked"><strong>내가 물었던 질문 · 요지</strong><ul>{note.questionsAsked.map((question) => <li key={question}>{question}</li>)}</ul></div>
              {note.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              <details className="claude-notes-check"><summary>복습 확인 · {note.question}</summary><p>{note.answer}</p></details>
              <footer><strong>대화 출처:</strong> {note.source}<br /><strong>자료 위치:</strong> {note.location}<br />페이지·진도 표기는 과거 대화 기준 / 원본 재대조 전</footer>
            </div>
          </article>)}
        </section>}
      </div>
    </section>
  );
}
