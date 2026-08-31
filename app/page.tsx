'use client';

import { useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  GraduationCap,
  Lightbulb,
  Menu,
  Search,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from 'lucide-react';
import { chapterSearchText, chapters, type Chapter } from '../src/chapter-data';

const progressKey = 'financial-markets-study-progress';

function ChapterLesson({ chapter }: { chapter: Chapter }) {
  const [answerOpen, setAnswerOpen] = useState(false);

  return (
    <article className="lesson-content">
      <section className="intro-card" id="easy">
        <div className="section-kicker"><Lightbulb size={17} /> 가장 쉬운 설명</div>
        <h2>{chapter.easyTitle}</h2>
        <p>{chapter.easyBody}</p>
        <div className="definition-box">
          <strong>한 문장 정의</strong>
          <span>{chapter.definition}</span>
        </div>
      </section>

      <section className="lesson-section" id="flow">
        <div className="section-heading">
          <div><span className="section-number">01</span><h2>{chapter.flowTitle}</h2></div>
          <p>흐름을 먼저 잡으면 세부 용어가 훨씬 쉽게 연결됩니다.</p>
        </div>
        <div className="flow-diagram dynamic-flow">
          {chapter.flowNodes.map((node, index) => (
            <div className="flow-fragment" key={node.title}>
              <div className="flow-node">
                <span>{node.label}</span>
                <strong>{node.title}</strong>
                <small>{node.detail}</small>
              </div>
              {index < chapter.flowNodes.length - 1 && <ArrowRight className="flow-arrow" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </section>

      <section className="lesson-section" id="key">
        <div className="section-heading">
          <div><span className="section-number">02</span><h2>{chapter.keyTitle}</h2></div>
          <p>시험 전에 반드시 설명할 수 있어야 하는 핵심입니다.</p>
        </div>
        <div className="role-grid">
          {chapter.keyPoints.map((point, index) => (
            <div className="role-card" key={point.title}>
              <div className="role-icon">{String(index + 1).padStart(2, '0')}</div>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lesson-section" id="compare">
        <div className="section-heading">
          <div><span className="section-number">03</span><h2>{chapter.compareTitle}</h2></div>
          <p>{chapter.compareLead}</p>
        </div>
        <div className="table-scroll">
          <table className="compare-table">
            <thead><tr>{chapter.compareHeaders.map((header) => <th key={header}>{header}</th>)}</tr></thead>
            <tbody>
              {chapter.compareRows.map((row) => (
                <tr key={row.join('-')}>{row.map((cell, index) => <td key={`${cell}-${index}`}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {chapter.formula && (
        <section className="lesson-section" id="formula">
          <div className="section-heading">
            <div><span className="section-number">04</span><h2>{chapter.formula.title}</h2></div>
            <p>수식은 암기보다 각 기호가 뜻하는 관계를 이해하세요.</p>
          </div>
          <div className="formula-card">
            <div className="formula-expression">{chapter.formula.expression}</div>
            <p>{chapter.formula.explanation}</p>
          </div>
        </section>
      )}

      <section className="trap-card">
        <TriangleAlert size={22} />
        <div><strong>자주 틀리는 지점</strong><p>{chapter.trap}</p></div>
      </section>

      <section className="quiz-card" id="check">
        <div className="quiz-label"><CircleHelp size={18} /> 이해도 확인</div>
        <h2>{chapter.quiz.question}</h2>
        <button type="button" className="answer-button" onClick={() => setAnswerOpen((open) => !open)}>
          {answerOpen ? '정답 닫기' : '정답 확인'} <ChevronRight size={17} />
        </button>
        {answerOpen && <div className="quiz-answer"><strong>{chapter.quiz.answer}</strong><span>{chapter.quiz.explanation}</span></div>}
      </section>

      <section className="memory-section">
        <div className="section-kicker"><Sparkles size={17} /> 시험 직전 기억 카드</div>
        <div className="memory-grid">
          {chapter.memories.map((memory) => <div className="memory-card" key={memory}>{memory}</div>)}
        </div>
      </section>

      <section className="draft-note">
        <strong>이 장은 강의자료 기반 초안입니다.</strong>
        <p>공부하면서 나눈 질문, 헷갈린 지점, 계산 예시와 자세한 설명은 이 장에 계속 추가됩니다.</p>
      </section>
    </article>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState(1);
  const [completed, setCompleted] = useState<number[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.localStorage.getItem(progressKey);
    if (!saved) return [];
    try { return JSON.parse(saved); } catch { return []; }
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredChapters = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chapters;
    return chapters.filter((chapter) => chapterSearchText(chapter).toLowerCase().includes(normalized));
  }, [query]);

  const chapter = chapters.find((item) => item.number === activeChapter) ?? chapters[0];
  const toggleCompleted = () => {
    const next = completed.includes(chapter.number)
      ? completed.filter((number) => number !== chapter.number)
      : [...completed, chapter.number];
    setCompleted(next);
    window.localStorage.setItem(progressKey, JSON.stringify(next));
  };

  const selectChapter = (number: number) => {
    setActiveChapter(number);
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main>
      <header className="topbar">
        <button className="mobile-menu" type="button" onClick={() => setMenuOpen(true)} aria-label="목차 열기"><Menu /></button>
        <a className="brand" href="#top"><GraduationCap /><div><strong>금융시장론</strong><span>전 강의 공부노트</span></div></a>
        <div className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="개념, 상품, 제도 검색" aria-label="강의 내용 검색" /></div>
        <div className="progress-summary"><span>{completed.length}/10 완료</span><div><i style={{ width: `${completed.length * 10}%` }} /></div></div>
      </header>

      <div className="app-shell" id="top">
        {menuOpen && <button className="sidebar-backdrop" aria-label="목차 닫기" onClick={() => setMenuOpen(false)} />}
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-title"><BookOpen size={18} /><strong>전체 강의</strong><button type="button" onClick={() => setMenuOpen(false)} aria-label="목차 닫기"><X /></button></div>
          <nav>
            {filteredChapters.map((item) => (
              <button key={item.number} type="button" className={activeChapter === item.number ? 'active' : ''} onClick={() => selectChapter(item.number)}>
                <span className="chapter-number">{String(item.number).padStart(2, '0')}</span>
                <span><strong>{item.title}</strong><small>{item.description}</small></span>
                {completed.includes(item.number) && <Check className="chapter-check" size={16} />}
              </button>
            ))}
            {filteredChapters.length === 0 && <p className="empty-search">검색 결과가 없습니다.</p>}
          </nav>
        </aside>

        <div className="content-wrap">
          <section className="lesson-hero">
            <div>
              <span className="eyebrow">CHAPTER {String(chapter.number).padStart(2, '0')} · 강의자료 기반 초안</span>
              <h1>{chapter.title}</h1>
              <p>{chapter.description}</p>
              <div className="topic-row">{chapter.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
            </div>
            <button type="button" className={`complete-button ${completed.includes(chapter.number) ? 'done' : ''}`} onClick={toggleCompleted}>
              <Target size={19} /> {completed.includes(chapter.number) ? '학습 완료됨' : '학습 완료 표시'}
            </button>
          </section>

          <div className="lesson-layout">
            <ChapterLesson key={chapter.number} chapter={chapter} />
            <aside className="on-this-page">
              <strong>이 장의 구성</strong>
              <a href="#easy">쉬운 설명</a><a href="#flow">핵심 흐름</a><a href="#key">핵심 개념</a><a href="#compare">비교 정리</a>
              {chapter.formula && <a href="#formula">수식 이해</a>}
              <a href="#check">이해도 확인</a>
              <div className="memory-tip"><Sparkles size={17} /><span><strong>기억 공식</strong>{chapter.memory}</span></div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
