'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
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
import { chapters, type Chapter } from '../src/chapter-data';

const progressKey = 'financial-markets-study-progress';
const lastLocationKey = 'financial-markets-study-location';
const validChapterNumbers = new Set(chapters.map((chapter) => chapter.number));
type DrawerMode = 'closed' | 'menu' | 'search';
type LessonSectionId = 'easy' | 'flow' | 'key' | 'compare' | 'formula' | 'check';
type SearchResult = {
  chapter: Chapter;
  section: LessonSectionId;
  sectionLabel: string;
  snippet: string;
};
type SearchJump = Pick<SearchResult, 'section' | 'sectionLabel' | 'snippet'> & { query: string };

const sectionLabels: Record<LessonSectionId, string> = {
  easy: '쉬운 설명',
  flow: '핵심 흐름',
  key: '핵심 개념',
  compare: '비교 정리',
  formula: '수식 이해',
  check: '이해도 확인',
};

const normalizeSearch = (value: string) => value.normalize('NFKC').toLowerCase();
const compactSearch = (value: string) => normalizeSearch(value).replace(/[^\p{L}\p{N}]+/gu, '');

const getSearchEntries = (chapter: Chapter): { section: LessonSectionId; text: string }[] => [
  ...(chapter.formula ? [{ section: 'formula' as const, text: `${chapter.formula.title} ${chapter.formula.expression} ${chapter.formula.explanation}` }] : []),
  { section: 'key', text: `${chapter.keyTitle} ${chapter.keyPoints.flatMap((point) => [point.title, point.body]).join(' ')}` },
  { section: 'compare', text: `${chapter.compareTitle} ${chapter.compareLead} ${chapter.compareHeaders.join(' ')} ${chapter.compareRows.flat().join(' ')}` },
  { section: 'easy', text: `${chapter.title} ${chapter.description} ${chapter.topics.join(' ')} ${chapter.easyTitle} ${chapter.easyBody} ${chapter.definition}` },
  { section: 'flow', text: `${chapter.flowTitle} ${chapter.flowNodes.flatMap((node) => [node.label, node.title, node.detail]).join(' ')}` },
  { section: 'check', text: `${chapter.trap} ${chapter.quiz.question} ${chapter.quiz.answer} ${chapter.quiz.explanation} ${chapter.memory} ${chapter.memories.join(' ')}` },
];

const makeSnippet = (text: string, query: string) => {
  const normalizedText = normalizeSearch(text);
  const tokens = normalizeSearch(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const matchIndex = tokens.reduce((found, token) => found >= 0 ? found : normalizedText.indexOf(token), -1);
  if (text.length <= 96) return text;

  const start = Math.max(0, matchIndex >= 0 ? matchIndex - 24 : 0);
  const end = Math.min(text.length, start + 96);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
};

const findSearchResult = (chapter: Chapter, query: string): SearchResult | null => {
  const compactQuery = compactSearch(query);
  if (!compactQuery) return null;

  const tokens = normalizeSearch(query).split(/[^\p{L}\p{N}]+/u).filter(Boolean).map(compactSearch);
  const entries = getSearchEntries(chapter);
  const scored = entries.map((entry) => {
    const compactText = compactSearch(entry.text);
    const directMatch = compactText.includes(compactQuery);
    const tokenMatches = tokens.filter((token) => compactText.includes(token)).length;
    return { ...entry, score: (directMatch ? 100 : 0) + tokenMatches };
  }).sort((a, b) => b.score - a.score);

  const wholeChapter = compactSearch(entries.map((entry) => entry.text).join(' '));
  const chapterMatches = wholeChapter.includes(compactQuery)
    || (tokens.length > 1 && tokens.every((token) => wholeChapter.includes(token)));
  if (!chapterMatches || scored[0].score === 0) return null;

  const best = scored[0];
  return {
    chapter,
    section: best.section,
    sectionLabel: sectionLabels[best.section],
    snippet: makeSnippet(best.text, query),
  };
};

const parseSectionHash = (hash: string): LessonSectionId | undefined => {
  const section = hash.replace(/^#/, '') as LessonSectionId;
  return section in sectionLabels ? section : undefined;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const readStoredProgress = (): { completed: number[]; failed: boolean } => {
  if (typeof window === 'undefined') return { completed: [], failed: false };
  try {
    const saved = window.localStorage.getItem(progressKey);
    if (!saved) return { completed: [], failed: false };
    const parsed: unknown = JSON.parse(saved);
    const rawNumbers = Array.isArray(parsed)
      ? parsed
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { completedChapterIds?: unknown }).completedChapterIds)
        ? (parsed as { completedChapterIds: unknown[] }).completedChapterIds.map((id) => typeof id === 'string' ? Number(id.replace('chapter-', '')) : id)
        : [];
    return {
      completed: [...new Set(rawNumbers.filter(
        (number): number is number => typeof number === 'number' && validChapterNumbers.has(number),
      ))],
      failed: false,
    };
  } catch {
    return { completed: [], failed: true };
  }
};

const readInitialLocation = (): { chapter: number; section?: LessonSectionId } => {
  if (typeof window === 'undefined') return { chapter: chapters[0]?.number ?? 1 };

  const url = new URL(window.location.href);
  const urlChapter = Number(url.searchParams.get('chapter'));
  if (validChapterNumbers.has(urlChapter)) return { chapter: urlChapter, section: parseSectionHash(url.hash) };

  try {
    const stored = window.localStorage.getItem(lastLocationKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { chapter?: unknown; section?: unknown };
      if (typeof parsed.chapter === 'number' && validChapterNumbers.has(parsed.chapter)) {
        const section = typeof parsed.section === 'string' ? parseSectionHash(parsed.section) : undefined;
        return { chapter: parsed.chapter, section };
      }
    }
  } catch {
    // A blocked storage API should never prevent the lesson from opening.
  }

  return { chapter: chapters[0]?.number ?? 1 };
};

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
      <div className="compare-cards" aria-label={`${chapter.compareTitle} 모바일 비교 카드`}>
        {chapter.compareRows.map((row) => (
          <article key={`card-${row.join('-')}`}>
            <h3>{row[0]}</h3>
            <dl>
              <div><dt>{chapter.compareHeaders[1]}</dt><dd>{row[1]}</dd></div>
              <div><dt>{chapter.compareHeaders[2]}</dt><dd>{row[2]}</dd></div>
            </dl>
          </article>
        ))}
      </div>
    </>
  );
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */

function SearchLocationNote({ section, jump }: { section: LessonSectionId; jump: SearchJump | null }) {
  if (!jump || jump.section !== section) return null;
  return (
    <div className="search-location-note">
      <Search size={16} aria-hidden="true" />
      <span><strong><mark>{jump.query}</mark> 검색 위치</strong>{jump.sectionLabel} · {jump.snippet}</span>
    </div>
  );
}

function ChapterLesson({
  chapter,
  completed,
  searchJump,
  onToggleCompleted,
  onSelectChapter,
  onNavigateSection,
}: {
  chapter: Chapter;
  completed: boolean;
  searchJump: SearchJump | null;
  onToggleCompleted: () => void;
  onSelectChapter: (number: number) => void;
  onNavigateSection: (section: LessonSectionId) => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const answerId = `quiz-answer-${chapter.number}`;
  const previousChapter = chapters.find((item) => item.number === chapter.number - 1);
  const nextChapter = chapters.find((item) => item.number === chapter.number + 1);

  return (
    <article className="lesson-content">
      <section className={`intro-card ${searchJump?.section === 'easy' ? 'search-highlight' : ''}`} id="easy" tabIndex={-1}>
        <SearchLocationNote section="easy" jump={searchJump} />
        <div className="section-kicker"><Lightbulb size={17} /> 가장 쉬운 설명</div>
        <h2>{chapter.easyTitle}</h2>
        <p>{chapter.easyBody}</p>
        <div className="definition-box">
          <strong>한 문장 정의</strong>
          <span>{chapter.definition}</span>
        </div>
      </section>

      <section className={`lesson-section ${searchJump?.section === 'flow' ? 'search-highlight' : ''}`} id="flow" tabIndex={-1}>
        <SearchLocationNote section="flow" jump={searchJump} />
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

      <section className={`lesson-section ${searchJump?.section === 'key' ? 'search-highlight' : ''}`} id="key" tabIndex={-1}>
        <SearchLocationNote section="key" jump={searchJump} />
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

      <section className={`lesson-section ${searchJump?.section === 'compare' ? 'search-highlight' : ''}`} id="compare" tabIndex={-1}>
        <SearchLocationNote section="compare" jump={searchJump} />
        <div className="section-heading">
          <div><span className="section-number">03</span><h2>{chapter.compareTitle}</h2></div>
          <p>{chapter.compareLead}</p>
        </div>
        <ComparisonTable chapter={chapter} />
      </section>

      {chapter.formula && (
        <section className={`lesson-section ${searchJump?.section === 'formula' ? 'search-highlight' : ''}`} id="formula" tabIndex={-1}>
          <SearchLocationNote section="formula" jump={searchJump} />
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

      <section className={`quiz-card ${searchJump?.section === 'check' ? 'search-highlight' : ''}`} id="check" tabIndex={-1}>
        <SearchLocationNote section="check" jump={searchJump} />
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

      <section className="lesson-finish" aria-label={`${chapter.title} 학습 마무리`}>
        <div>
          <span>CHAPTER {String(chapter.number).padStart(2, '0')} 마무리</span>
          <strong>{completed ? '이 장의 학습을 완료했어요.' : '복습을 마쳤다면 완료로 표시하세요.'}</strong>
        </div>
        <button type="button" className={`finish-complete ${completed ? 'done' : ''}`} onClick={onToggleCompleted} aria-pressed={completed}>
          <Target size={18} /> {completed ? '완료 취소' : '학습 완료'}
        </button>
        <nav aria-label="장 이동">
          {previousChapter
            ? <button type="button" onClick={() => onSelectChapter(previousChapter.number)}><ArrowLeft size={18} /> 이전 장</button>
            : <span />}
          <button type="button" onClick={() => onNavigateSection('easy')}><ArrowUp size={18} /> 맨 위</button>
          {nextChapter
            ? <button type="button" className="next-chapter" onClick={() => onSelectChapter(nextChapter.number)}>다음 장 <ArrowRight size={18} /></button>
            : <span />}
        </nav>
      </section>
    </article>
  );
}

function SectionNavigation({
  chapter,
  compact = false,
  onNavigate,
}: {
  chapter: Chapter;
  compact?: boolean;
  onNavigate: (section: LessonSectionId) => void;
}) {
  const sections = (Object.keys(sectionLabels) as LessonSectionId[])
    .filter((section) => section !== 'formula' || chapter.formula);

  return (
    <nav className={compact ? 'compact-section-nav' : 'section-links'} aria-label="이 장의 구성">
      {compact && <strong>바로가기</strong>}
      {sections.map((section) => (
        <a
          key={section}
          href={`?chapter=${chapter.number}#${section}`}
          onClick={(event) => {
            event.preventDefault();
            onNavigate(section);
          }}
        >
          {sectionLabels[section]}
        </a>
      ))}
    </nav>
  );
}

export default function Home() {
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState(() => readInitialLocation().chapter);
  const [completed, setCompleted] = useState<number[]>([]);
  const [storageError, setStorageError] = useState('');
  const [searchJump, setSearchJump] = useState<SearchJump | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('closed');
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const drawerOpenerRef = useRef<HTMLElement | null>(null);
  const queryRef = useRef(query);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return chapters.map((item) => findSearchResult(item, query)).filter((result): result is SearchResult => result !== null);
  }, [query]);

  const chapter = chapters.find((item) => item.number === activeChapter) ?? chapters[0];
  const navigationItems: SearchResult[] = query.trim()
    ? searchResults
    : chapters.map((item) => ({ chapter: item, section: 'easy', sectionLabel: sectionLabels.easy, snippet: item.description }));
  const drawerOpen = isMobile && drawerMode !== 'closed';
  const menuModalOpen = isMobile && drawerMode === 'menu';
  const searchResultsOpen = isMobile && drawerMode === 'search';
  const progressPercent = chapters.length === 0 ? 0 : (completed.length / chapters.length) * 100;

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const closeDrawer = useCallback((restoreFocus = true) => {
    setDrawerMode('closed');
    if (!restoreFocus) return;

    const opener = drawerOpenerRef.current;
    window.requestAnimationFrame(() => {
      if (opener?.isConnected && opener.getClientRects().length > 0) opener.focus();
    });
  }, []);

  const focusDestination = useCallback((section?: LessonSectionId, smooth = true) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = section ? document.getElementById(section) : headingRef.current;
      if (!target) return;
      target.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'start' });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }));
  }, []);

  const writeLocation = useCallback((number: number, section?: LessonSectionId, replace = false) => {
    const url = new URL(window.location.href);
    url.searchParams.set('chapter', String(number));
    url.hash = section ? `#${section}` : '';
    window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
    try {
      window.localStorage.setItem(lastLocationKey, JSON.stringify({ chapter: number, section }));
    } catch {
      setStorageError('이 브라우저에서는 마지막 학습 위치를 저장할 수 없습니다.');
    }
  }, []);

  const openMenu = () => {
    setQuery('');
    drawerOpenerRef.current = menuButtonRef.current;
    setDrawerMode('menu');
  };

  const clearSearch = useCallback((focusInput = true) => {
    setQuery('');
    setDrawerMode('closed');
    if (focusInput) {
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
    } else {
      window.requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
    }
  }, []);

  useEffect(() => {
    const initialLocation = readInitialLocation();
    const savedProgress = readStoredProgress();
    const currentUrl = new URL(window.location.href);
    const hasValidUrlChapter = validChapterNumbers.has(Number(currentUrl.searchParams.get('chapter')));

    // oxlint-disable-next-line react/react-compiler -- hydrate device-local study state after the server render
    setActiveChapter(initialLocation.chapter);
    setCompleted(savedProgress.completed);
    if (savedProgress.failed) setStorageError('저장된 학습 진도를 읽지 못해 새 진도로 시작했습니다.');
    if (!hasValidUrlChapter) writeLocation(initialLocation.chapter, initialLocation.section, true);
    if (initialLocation.section) focusDestination(initialLocation.section, false);

    const syncFromBrowser = () => {
      const url = new URL(window.location.href);
      const number = Number(url.searchParams.get('chapter'));
      const nextChapter = validChapterNumbers.has(number) ? number : chapters[0]?.number ?? 1;
      const section = parseSectionHash(url.hash);
      setActiveChapter(nextChapter);
      setQuery('');
      setSearchJump(null);
      setDrawerMode('closed');
      focusDestination(section, false);
      try {
        window.localStorage.setItem(lastLocationKey, JSON.stringify({ chapter: nextChapter, section }));
      } catch {
        setStorageError('이 브라우저에서는 마지막 학습 위치를 저장할 수 없습니다.');
      }
    };

    const syncProgressAcrossTabs = (event: StorageEvent) => {
      if (event.key !== progressKey) return;
      const synced = readStoredProgress();
      setCompleted(synced.completed);
      if (synced.failed) setStorageError('다른 탭의 학습 진도를 불러오지 못했습니다.');
    };

    window.addEventListener('popstate', syncFromBrowser);
    window.addEventListener('storage', syncProgressAcrossTabs);
    return () => {
      window.removeEventListener('popstate', syncFromBrowser);
      window.removeEventListener('storage', syncProgressAcrossTabs);
    };
  }, [focusDestination, writeLocation]);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 760px)');
    const syncMobileState = () => {
      setIsMobile(mobileQuery.matches);
      if (mobileQuery.matches && queryRef.current.trim()) {
        drawerOpenerRef.current = searchInputRef.current;
        setDrawerMode('search');
      } else if (!mobileQuery.matches) {
        if (sidebarRef.current?.contains(document.activeElement)) searchInputRef.current?.focus();
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
      clearSearch(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (sidebarRef.current?.contains(target) || searchBoxRef.current?.contains(target)) return;
      clearSearch(false);
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [clearSearch, searchResultsOpen]);

  const toggleCompleted = () => {
    setCompleted((current) => {
      const next = current.includes(chapter.number)
        ? current.filter((number) => number !== chapter.number)
        : [...current, chapter.number];
      try {
        window.localStorage.setItem(progressKey, JSON.stringify({
          version: 1,
          completedChapterIds: next.map((number) => `chapter-${number}`),
        }));
        setStorageError('');
      } catch {
        setStorageError('완료 표시는 현재 화면에만 반영됐습니다. 브라우저 저장 권한을 확인해주세요.');
      }
      return next;
    });
  };

  const selectChapter = (number: number, result?: SearchResult) => {
    const jump = result && query.trim()
      ? { section: result.section, sectionLabel: result.sectionLabel, snippet: result.snippet, query: query.trim() }
      : null;
    setActiveChapter(number);
    setSearchJump(jump);
    setQuery('');
    closeDrawer(false);
    writeLocation(number, result?.section);
    focusDestination(result?.section);
  };

  const navigateSection = (section: LessonSectionId) => {
    setSearchJump(null);
    writeLocation(chapter.number, section);
    focusDestination(section);
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
        <a className="brand" href={`?chapter=${chapter.number}#easy`} onClick={(event) => { event.preventDefault(); navigateSection('easy'); }}><GraduationCap /><div><strong>금융시장론</strong><span>전 강의 공부노트</span></div></a>
        <div className="search-box" ref={searchBoxRef}>
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            value={query}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => {
              if (!isMobile || !query.trim()) return;
              drawerOpenerRef.current = searchInputRef.current;
              setDrawerMode('search');
            }}
            placeholder="개념, 상품, 제도 검색"
            aria-label="강의 내용 검색"
            aria-controls="chapter-navigation"
            aria-describedby="search-results-status"
          />
          {query && <button type="button" className="search-clear" aria-label="검색어 지우기" onClick={() => clearSearch()}><X size={17} /></button>}
        </div>
        <output className="sr-only" id="search-results-status" aria-live="polite" aria-atomic="true">
          {query.trim() ? (searchResults.length === 0 ? `검색어 ${query}, 결과가 없습니다.` : `검색어 ${query}, 결과 ${searchResults.length}개`) : ''}
        </output>
        {/* Custom visual progress meter retains native progressbar semantics. */}
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
        <div className="progress-summary" role="progressbar" aria-label="학습 완료 진도" aria-valuemin={0} aria-valuemax={chapters.length} aria-valuenow={completed.length}><span>{completed.length}/{chapters.length} 완료</span><div><i style={{ width: `${progressPercent}%` }} /></div></div>
        <span className="mobile-progress" aria-live="polite">{completed.length}/{chapters.length} 완료</span>
      </header>

      {storageError && <output className="storage-warning"><TriangleAlert size={16} /> {storageError}</output>}

      <div className="app-shell" id="top">
        {menuModalOpen && <button type="button" className="sidebar-backdrop" aria-label="목차 닫기" onClick={() => closeDrawer()} />}
        <aside
          ref={sidebarRef}
          className={`sidebar ${drawerOpen ? 'open' : ''} ${menuModalOpen ? 'menu-modal' : ''} ${searchResultsOpen ? 'search-results' : ''}`}
          id="chapter-sidebar"
          role={menuModalOpen ? 'dialog' : undefined}
          aria-modal={menuModalOpen ? true : undefined}
          aria-hidden={isMobile && drawerMode === 'closed' ? true : undefined}
          aria-label={query.trim() ? '강의 검색 결과' : '전체 강의 목차'}
          inert={isMobile && drawerMode === 'closed' ? true : undefined}
        >
          <div className="sidebar-title"><BookOpen size={18} /><strong>{query.trim() ? `검색 결과 ${searchResults.length}개` : '전체 강의'}</strong><button ref={closeButtonRef} type="button" onClick={() => query.trim() ? clearSearch(false) : closeDrawer()} aria-label={query.trim() ? '검색 결과 닫기 및 검색어 지우기' : '목차 닫기'}><X /></button></div>
          <nav id="chapter-navigation" aria-label={query.trim() ? '검색된 강의 장 목록' : '강의 장 목록'}>
            {navigationItems.map((result) => (
              <button key={result.chapter.number} type="button" className={activeChapter === result.chapter.number ? 'active' : ''} onClick={() => selectChapter(result.chapter.number, query.trim() ? result : undefined)} aria-current={activeChapter === result.chapter.number ? 'page' : undefined}>
                <span className="chapter-number">{String(result.chapter.number).padStart(2, '0')}</span>
                <span>
                  <strong>{result.chapter.title}</strong>
                  {query.trim()
                    ? <small className="search-match-meta"><b>{result.sectionLabel}</b>{result.snippet}</small>
                    : <small>{result.chapter.description}</small>}
                </span>
                {completed.includes(result.chapter.number) && <Check className="chapter-check" size={16} />}
              </button>
            ))}
            {navigationItems.length === 0 && <p className="empty-search"><strong>일치하는 내용이 없습니다.</strong><span>띄어쓰기를 바꾸거나 더 짧은 핵심어로 검색해보세요.</span></p>}
          </nav>
        </aside>

        <div className="content-wrap">
          <section className="lesson-hero">
            <div>
              <span className="eyebrow">CHAPTER {String(chapter.number).padStart(2, '0')} · 강의자료 기반 초안</span>
              <h1 ref={headingRef} tabIndex={-1}>{chapter.title}</h1>
              <p>{chapter.description}</p>
              <div className="topic-row">{chapter.topics.map((topic) => <span key={topic}>{topic}</span>)}</div>
            </div>
            <button type="button" className={`complete-button ${completed.includes(chapter.number) ? 'done' : ''}`} onClick={toggleCompleted} aria-pressed={completed.includes(chapter.number)}>
              <Target size={19} /> {completed.includes(chapter.number) ? '학습 완료됨' : '학습 완료 표시'}
            </button>
          </section>

          <SectionNavigation chapter={chapter} compact onNavigate={navigateSection} />

          <div className="lesson-layout">
            <ChapterLesson
              key={chapter.number}
              chapter={chapter}
              completed={completed.includes(chapter.number)}
              searchJump={searchJump}
              onToggleCompleted={toggleCompleted}
              onSelectChapter={selectChapter}
              onNavigateSection={navigateSection}
            />
            <aside className="on-this-page">
              <strong>이 장의 구성</strong>
              <SectionNavigation chapter={chapter} onNavigate={navigateSection} />
              <div className="memory-tip"><Sparkles size={17} /><span><strong>기억 공식</strong>{chapter.memory}</span></div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
