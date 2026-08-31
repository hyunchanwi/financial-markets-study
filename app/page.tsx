'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const validChapterNumbers = new Set(chapters.map((chapter) => chapter.number));
type DrawerMode = 'closed' | 'menu' | 'search';

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- this scroll region needs explicit keyboard panning */
function ComparisonTable({ chapter }: { chapter: Chapter }) {
  const tableHintId = `compare-table-hint-${chapter.number}`;

  return (
    <>
      <p className="table-scroll-hint" id={tableHintId}>표를 좌우로 움직여 비교하세요. 첫 열은 행의 기준으로 고정됩니다.</p>
      <section
        className="table-scroll"
        aria-label={`${chapter.compareTitle} 비교표`}
        aria-describedby={tableHintId}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

          const scrollArea = event.currentTarget;
          const maxScrollLeft = scrollArea.scrollWidth - scrollArea.clientWidth;
          const canScroll = event.key === 'ArrowLeft'
            ? scrollArea.scrollLeft > 0
            : scrollArea.scrollLeft < maxScrollLeft - 1;
          if (!canScroll) return;

          event.preventDefault();
          scrollArea.scrollBy({
            left: event.key === 'ArrowRight' ? 80 : -80,
            behavior: 'auto',
          });
        }}
      >
        <table className="compare-table">
          <thead><tr>{chapter.compareHeaders.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>
            {chapter.compareRows.map((row) => (
              <tr key={row.join('-')}>
                {row.map((cell, index) => index === 0
                  ? <th scope="row" key={`${cell}-${index}`}>{cell}</th>
                  : <td key={`${cell}-${index}`}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */

function ChapterLesson({ chapter }: { chapter: Chapter }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const answerId = `quiz-answer-${chapter.number}`;

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
        <ComparisonTable chapter={chapter} />
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
        <button
          type="button"
          className="answer-button"
          onClick={() => setAnswerOpen((open) => !open)}
          aria-expanded={answerOpen}
          aria-controls={answerId}
        >
          {answerOpen ? '정답 닫기' : '정답 확인'} <ChevronRight size={17} />
        </button>
        <section className="quiz-answer" id={answerId} hidden={!answerOpen} aria-label="퀴즈 정답">
          <strong>{chapter.quiz.answer}</strong><span>{chapter.quiz.explanation}</span>
        </section>
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
    try {
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter(
        (number): number is number => typeof number === 'number' && validChapterNumbers.has(number),
      ))];
    } catch {
      return [];
    }
  });
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('closed');
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);

  const filteredChapters = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return chapters;
    return chapters.filter((chapter) => chapterSearchText(chapter).toLowerCase().includes(normalized));
  }, [query]);

  const chapter = chapters.find((item) => item.number === activeChapter) ?? chapters[0];
  const drawerOpen = isMobile && drawerMode !== 'closed';
  const menuModalOpen = isMobile && drawerMode === 'menu';
  const searchResultsOpen = isMobile && drawerMode === 'search';
  const progressPercent = chapters.length === 0 ? 0 : (completed.length / chapters.length) * 100;

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerMode('closed');
    if (!restoreFocus) return;

    const opener = drawerOpenerRef.current;
    window.requestAnimationFrame(() => {
      if (opener?.isConnected && opener.getClientRects().length > 0) opener.focus();
    });
  }, []);

  const openMenu = () => {
    setQuery('');
    drawerOpenerRef.current = menuButtonRef.current;
    setDrawerMode('menu');
  };

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const syncMobileState = () => {
      setIsMobile(mobileQuery.matches);
      if (!mobileQuery.matches) {
        setDrawerMode('closed');
        drawerOpenerRef.current = null;
      }
    };

    syncMobileState();
    mobileQuery.addEventListener('change', syncMobileState);
    return () => mobileQuery.removeEventListener('change', syncMobileState);
  }, []);

  useEffect(() => {
    if (!menuModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDrawer();
        return;
      }

      if (event.key !== 'Tab' || !sidebarRef.current) return;
      const focusableElements = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);

      if (focusableElements.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === first || !sidebarRef.current.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !sidebarRef.current.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDrawer, menuModalOpen]);

  useEffect(() => {
    if (!searchResultsOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeDrawer();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [closeDrawer, searchResultsOpen]);

  const toggleCompleted = () => {
    const next = completed.includes(chapter.number)
      ? completed.filter((number) => number !== chapter.number)
      : [...completed, chapter.number];
    setCompleted(next);
    window.localStorage.setItem(progressKey, JSON.stringify(next));
  };

  const selectChapter = (number: number) => {
    setActiveChapter(number);
    setQuery('');
    closeDrawer();
    window.scrollTo({
      top: 0,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const handleSearchChange = (value: string) => {
    setQuery(value);
    if (!isMobile) return;

    if (value.trim()) {
      drawerOpenerRef.current = searchInputRef.current;
      setDrawerMode('search');
    } else if (drawerMode === 'search') {
      closeDrawer(false);
    }
  };

  return (
    <main>
      <header className="topbar">
        <button
          ref={menuButtonRef}
          className="mobile-menu"
          type="button"
          onClick={openMenu}
          aria-label="목차 열기"
          aria-expanded={menuModalOpen}
          aria-controls="chapter-sidebar"
        ><Menu /></button>
        <a className="brand" href="#top"><GraduationCap /><div><strong>금융시장론</strong><span>전 강의 공부노트</span></div></a>
        <div className="search-box"><Search size={18} /><input ref={searchInputRef} value={query} onChange={(event) => handleSearchChange(event.target.value)} placeholder="개념, 상품, 제도 검색" aria-label="강의 내용 검색" aria-controls="chapter-navigation" aria-describedby="search-results-status" /></div>
        <output className="sr-only" id="search-results-status" aria-live="polite" aria-atomic="true">
          {query.trim() ? (filteredChapters.length === 0 ? '검색 결과가 없습니다.' : `검색 결과 ${filteredChapters.length}개`) : ''}
        </output>
        {/* Custom visual progress meter retains native progressbar semantics. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div className="progress-summary" role="progressbar" aria-label="학습 완료 진도" aria-valuemin={0} aria-valuemax={chapters.length} aria-valuenow={completed.length}><span>{completed.length}/{chapters.length} 완료</span><div><i style={{ width: `${progressPercent}%` }} /></div></div>
        <span className="mobile-progress" aria-live="polite">{completed.length}/{chapters.length} 완료</span>
      </header>

      <div className="app-shell" id="top">
        {menuModalOpen && <button type="button" className="sidebar-backdrop" aria-label="목차 닫기" onClick={() => closeDrawer()} />}
        <aside
          ref={sidebarRef}
          className={`sidebar ${drawerOpen ? 'open' : ''} ${menuModalOpen ? 'menu-modal' : ''} ${searchResultsOpen ? 'search-results' : ''}`}
          id="chapter-sidebar"
          role={menuModalOpen ? 'dialog' : undefined}
          aria-modal={menuModalOpen ? true : undefined}
          aria-hidden={isMobile && drawerMode === 'closed' ? true : undefined}
          aria-label={searchResultsOpen ? '강의 검색 결과' : '전체 강의 목차'}
          inert={isMobile && drawerMode === 'closed' ? true : undefined}
        >
          <div className="sidebar-title"><BookOpen size={18} /><strong>{searchResultsOpen ? '검색 결과' : '전체 강의'}</strong><button ref={closeButtonRef} type="button" onClick={() => closeDrawer()} aria-label={searchResultsOpen ? '검색 결과 닫기' : '목차 닫기'}><X /></button></div>
          <nav id="chapter-navigation" aria-label={searchResultsOpen ? '검색된 강의 장 목록' : '강의 장 목록'}>
            {filteredChapters.map((item) => (
              <button key={item.number} type="button" className={activeChapter === item.number ? 'active' : ''} onClick={() => selectChapter(item.number)} aria-current={activeChapter === item.number ? 'page' : undefined}>
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
            <button type="button" className={`complete-button ${completed.includes(chapter.number) ? 'done' : ''}`} onClick={toggleCompleted} aria-pressed={completed.includes(chapter.number)}>
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
