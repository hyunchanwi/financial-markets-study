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
  Clock3,
  FileText,
  GraduationCap,
  Lightbulb,
  Menu,
  Search,
  Sparkles,
  Target,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, LabelList, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer, type ChartConfig } from '../components/ui/chart';
import { chapters, type Chapter } from '../src/chapter-data';
import {
  detailedCourse,
  detailedUnitIds,
  type ContentBlock,
  type DetailedUnit,
  type DetailedVisual,
  type InlineNode,
  type RichBlock,
} from '../src/content/detailed-content';

const progressKey = 'financial-markets-study-progress';
const lastLocationKey = 'financial-markets-study-location';
const validChapterNumbers = new Set(chapters.map((chapter) => chapter.number));
const detailedChapterNumbers = new Set(detailedCourse.chapters.map((chapter) => chapter.number));
const detailedUnitsForChapter = (chapterNumber: number) => detailedCourse.units.filter((unit) => unit.chapter === chapterNumber);
const firstDetailedUnit = (chapterNumber: number) => detailedUnitsForChapter(chapterNumber)[0];
type DrawerMode = 'closed' | 'menu' | 'search';
type LessonSectionId = 'easy' | 'flow' | 'key' | 'compare' | 'formula' | 'check';
type SearchResult = {
  chapter: Chapter;
  section: string;
  sectionLabel: string;
  snippet: string;
  unitId?: string;
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
  const entries = detailedChapterNumbers.has(chapter.number)
    ? detailedCourse.searchDocuments.filter((document) => document.chapter === chapter.number).map((document) => {
      const unit = detailedCourse.units.find((item) => item.id === document.unitId)!;
      const matchingBlock = unit.blocks.find((block) => compactSearch(JSON.stringify(block)).includes(compactQuery));
      return {
        section: matchingBlock?.id ?? unit.id,
        sectionLabel: unit.title,
        text: document.text,
        unitId: unit.id,
      };
    })
    : getSearchEntries(chapter);
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
    sectionLabel: 'sectionLabel' in best ? best.sectionLabel : sectionLabels[best.section as LessonSectionId],
    snippet: makeSnippet(best.text, query),
    unitId: 'unitId' in best ? best.unitId : undefined,
  };
};

const parseTargetHash = (hash: string): string | undefined => {
  const target = decodeURIComponent(hash.replace(/^#/, ''));
  return /^[a-z0-9-]+$/.test(target) ? target : undefined;
};

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const readStoredProgress = (): { completed: number[]; completedUnits: string[]; failed: boolean } => {
  if (typeof window === 'undefined') return { completed: [], completedUnits: [], failed: false };
  try {
    const saved = window.localStorage.getItem(progressKey);
    if (!saved) return { completed: [], completedUnits: [], failed: false };
    const parsed: unknown = JSON.parse(saved);
    const versionTwo = typeof parsed === 'object' && parsed !== null && (parsed as { schemaVersion?: unknown }).schemaVersion === 2;
    const rawNumbers = Array.isArray(parsed)
      ? parsed
      : versionTwo && Array.isArray((parsed as { legacyCompletedChapters?: unknown }).legacyCompletedChapters)
        ? (parsed as { legacyCompletedChapters: unknown[] }).legacyCompletedChapters
      : typeof parsed === 'object' && parsed !== null && Array.isArray((parsed as { completedChapterIds?: unknown }).completedChapterIds)
        ? (parsed as { completedChapterIds: unknown[] }).completedChapterIds.map((id) => typeof id === 'string' ? Number(id.replace('chapter-', '')) : id)
        : [];
    const rawUnits = versionTwo && Array.isArray((parsed as { completedUnitIds?: unknown }).completedUnitIds)
      ? (parsed as { completedUnitIds: unknown[] }).completedUnitIds
      : [];
    return {
      completed: [...new Set(rawNumbers.filter(
        (number): number is number => typeof number === 'number' && validChapterNumbers.has(number),
      ))],
      completedUnits: [...new Set(rawUnits.filter((id): id is string => typeof id === 'string' && detailedUnitIds.has(id)))],
      failed: false,
    };
  } catch {
    return { completed: [], completedUnits: [], failed: true };
  }
};

const readInitialLocation = (): { chapter: number; targetId?: string; unitId?: string } => {
  if (typeof window === 'undefined') return { chapter: chapters[0]?.number ?? 1 };

  const url = new URL(window.location.href);
  const urlChapter = Number(url.searchParams.get('chapter'));
  const urlUnit = url.searchParams.get('unit');
  if (validChapterNumbers.has(urlChapter)) return {
    chapter: urlChapter,
    targetId: parseTargetHash(url.hash),
    unitId: detailedChapterNumbers.has(urlChapter) && urlUnit && detailedUnitIds.has(urlUnit)
      && detailedCourse.units.some((unit) => unit.id === urlUnit && unit.chapter === urlChapter) ? urlUnit : undefined,
  };

  try {
    const stored = window.localStorage.getItem(lastLocationKey);
    if (stored) {
      const parsed = JSON.parse(stored) as { chapter?: unknown; targetId?: unknown; unitId?: unknown };
      if (typeof parsed.chapter === 'number' && validChapterNumbers.has(parsed.chapter)) {
        const targetId = typeof parsed.targetId === 'string' ? parseTargetHash(`#${parsed.targetId}`) : undefined;
        const unitId = typeof parsed.unitId === 'string' && detailedUnitIds.has(parsed.unitId)
          && detailedCourse.units.some((unit) => unit.id === parsed.unitId && unit.chapter === parsed.chapter) ? parsed.unitId : undefined;
        return { chapter: parsed.chapter, targetId, unitId };
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

function SearchLocationNote({ section, jump }: { section: string; jump: SearchJump | null }) {
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

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
  return nodes.map((node, index) => {
    const key = `${node.type}-${index}`;
    if (node.type === 'text') return <span key={key}>{node.value}</span>;
    if (node.type === 'code') return <code key={key}>{node.value}</code>;
    if (node.type === 'strong') return <strong key={key}><InlineContent nodes={node.children} /></strong>;
    if (node.type === 'emphasis') return <em key={key}><InlineContent nodes={node.children} /></em>;
    if (node.type === 'delete') return <del key={key}><InlineContent nodes={node.children} /></del>;
    return <a key={key} href={node.url} target="_blank" rel="noreferrer"><InlineContent nodes={node.children} /></a>;
  });
}

/* oxlint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions -- horizontal comparison tables need keyboard panning */
function RichContent({ blocks }: { blocks: RichBlock[] }) {
  return blocks.map((block, index) => {
    const key = `${block.type}-${index}`;
    if (block.type === 'paragraph') return <p key={key}><InlineContent nodes={block.children} /></p>;
    if (block.type === 'quote') return <blockquote key={key}><RichContent blocks={block.content} /></blockquote>;
    if (block.type === 'list') {
      const List = block.ordered ? 'ol' : 'ul';
      return <List key={key}>{block.items.map((item, itemIndex) => <li key={`${key}-${itemIndex}`}><RichContent blocks={item} /></li>)}</List>;
    }
    return (
      <section
        className="detail-table-scroll"
        tabIndex={0}
        aria-label="비교표"
        key={key}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
          const area = event.currentTarget;
          const direction = event.key === 'ArrowRight' ? 1 : -1;
          const canScroll = direction > 0 ? area.scrollLeft < area.scrollWidth - area.clientWidth - 1 : area.scrollLeft > 0;
          if (!canScroll) return;
          event.preventDefault();
          area.scrollBy({ left: direction * 90, behavior: 'auto' });
        }}
      >
        <table className="compare-table detailed-compare-table">
          <thead><tr>{block.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={`${key}-row-${rowIndex}`}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th scope="row" key={cell}>{cell}</th> : <td key={`${cell}-${cellIndex}`}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </section>
    );
  });
}
/* oxlint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */

const assetChartConfig = {
  financial: { label: '금융자산', color: '#1f6b50' },
  nonfinancial: { label: '비금융자산', color: '#c8dc62' },
} satisfies ChartConfig;

function DetailedVisualBlock({ visual }: { visual: DetailedVisual }) {
  if (visual.type === 'bar') {
    return (
      <figure className="detail-visual quantitative-visual" aria-labelledby={`${visual.id}-title`}>
        <div className="visual-heading"><span>자료를 그림으로</span><h3 id={`${visual.id}-title`}>{visual.title}</h3></div>
        <ChartContainer config={assetChartConfig} className="asset-chart" initialDimension={{ width: 680, height: 330 }}>
          <BarChart data={visual.series} layout="vertical" margin={{ left: 10, right: 12 }} accessibilityLayer>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
            <YAxis dataKey="category" type="category" width={52} />
            <Tooltip formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name === 'financial' ? '금융자산' : '비금융자산']} />
            <Legend formatter={(value) => value === 'financial' ? '금융자산' : '비금융자산'} />
            <Bar dataKey="financial" stackId="assets" fill="var(--color-financial)" />
            <Bar dataKey="nonfinancial" stackId="assets" fill="var(--color-nonfinancial)" radius={[0, 5, 5, 0]} />
          </BarChart>
        </ChartContainer>
        <div className="visual-data-table">
          <table><thead><tr><th scope="col">국가</th><th scope="col">금융자산</th><th scope="col">비금융자산</th></tr></thead><tbody>{visual.series.map((row) => <tr key={row.category}><th scope="row">{row.category}</th><td>{row.financial.toFixed(1)}%</td><td>{row.nonfinancial.toFixed(1)}%</td></tr>)}</tbody></table>
        </div>
        <figcaption>{visual.caption}</figcaption>
      </figure>
    );
  }

  if (visual.type === 'line') {
    const lineConfig = { consumption: { label: '시장기회선', color: '#1f6b50' } } satisfies ChartConfig;
    return (
      <figure className="detail-visual quantitative-visual" aria-labelledby={`${visual.id}-title`}>
        <div className="visual-heading"><span>계산을 그래프로</span><h3 id={`${visual.id}-title`}>{visual.title}</h3></div>
        <ChartContainer config={lineConfig} className="opportunity-chart" initialDimension={{ width: 680, height: 380 }}>
          <LineChart data={visual.points} margin={{ top: 22, right: 24, bottom: 12, left: 4 }} accessibilityLayer>
            <CartesianGrid strokeDasharray="4 4" />
            <XAxis type="number" dataKey="x" domain={[0, 220]} label={{ value: visual.x_label, position: 'insideBottom', offset: -8 }} />
            <YAxis type="number" domain={[0, 240]} label={{ value: visual.y_label, angle: -90, position: 'insideLeft' }} />
            <Tooltip formatter={(value, name, item) => [name === 'y' ? `${Number(value).toFixed(1)}만원` : value, item.payload?.label]} labelFormatter={() => ''} />
            <Line dataKey="y" name="미래소비" type="linear" stroke="var(--color-consumption)" strokeWidth={3} dot={{ r: 5, fill: '#1f6b50' }} activeDot={{ r: 7 }}>
              <LabelList dataKey="label" position="top" />
            </Line>
          </LineChart>
        </ChartContainer>
        <div className="visual-data-table">
          <table><thead><tr><th scope="col">점</th><th scope="col">현재소비 C₀</th><th scope="col">미래소비 C₁</th></tr></thead><tbody>{visual.points.map((point) => <tr key={point.label}><th scope="row">{point.label}</th><td>{point.x}만원</td><td>{point.y}만원</td></tr>)}</tbody></table>
        </div>
        <figcaption>{visual.caption}</figcaption>
      </figure>
    );
  }

  const nodeNames = new Map(visual.nodes.map((node) => [node.id, node.label]));
  return (
    <figure className={`detail-visual network-visual ${visual.type}`} aria-labelledby={`${visual.id}-title`}>
      <div className="visual-heading"><span>{visual.type === 'tree' ? '분류 지도' : visual.type === 'decision' ? '판별 순서' : '흐름 그림'}</span><h3 id={`${visual.id}-title`}>{visual.title}</h3></div>
      <div className="visual-node-grid">
        {visual.nodes.map((node, index) => <div className="visual-node" key={node.id}><span>{String(index + 1).padStart(2, '0')}</span><strong>{node.label}</strong>{node.detail && <small>{node.detail}</small>}</div>)}
      </div>
      <div className="visual-edge-list" aria-label="연결 관계">
        {visual.edges.map((edge, index) => <div key={`${edge.from}-${edge.to}-${index}`}><strong>{nodeNames.get(edge.from)}</strong><ArrowRight aria-hidden="true" /><strong>{nodeNames.get(edge.to)}</strong>{edge.label && <span>{edge.label}</span>}</div>)}
      </div>
      <figcaption>{visual.caption}</figcaption>
    </figure>
  );
}

function PracticeBlock({ block, searchJump }: { block: ContentBlock; searchJump: SearchJump | null }) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const answerId = `${block.id}-answer`;
  return (
    <section className={`quiz-card detailed-block ${searchJump?.section === block.id ? 'search-highlight' : ''}`} id={block.id} tabIndex={-1}>
      <SearchLocationNote section={block.id ?? ''} jump={searchJump} />
      <div className="quiz-label"><CircleHelp size={18} /> {block.title}</div>
      <h2>{block.question}</h2>
      <button type="button" className="answer-button" onClick={() => setAnswerOpen((open) => !open)} aria-expanded={answerOpen} aria-controls={answerId}>
        {answerOpen ? '정답 닫기' : '정답 확인'} <ChevronRight size={17} />
      </button>
      <section className="quiz-answer" id={answerId} hidden={!answerOpen} aria-label="연습문제 정답">
        <strong>{block.answer}</strong><RichContent blocks={block.content ?? []} />
      </section>
    </section>
  );
}

function DetailedContentBlock({ block, searchJump }: { block: ContentBlock; searchJump: SearchJump | null }) {
  if (block.type === 'practice') return <PracticeBlock block={block} searchJump={searchJump} />;
  if (block.type === 'visual') {
    const visual = block.ref ? detailedCourse.visuals[block.ref] : undefined;
    return visual ? <DetailedVisualBlock visual={visual} /> : null;
  }
  const className = block.type === 'explain'
    ? 'intro-card detailed-block'
    : block.type === 'misconception'
      ? 'trap-card detailed-block'
      : block.type === 'source-note'
        ? 'draft-note detailed-block source-note'
        : block.type === 'recap'
          ? 'memory-section detailed-block recap-block'
          : 'lesson-section detailed-block';
  return (
    <section className={`${className} ${searchJump?.section === block.id ? 'search-highlight' : ''}`} id={block.id} tabIndex={-1}>
      <SearchLocationNote section={block.id ?? ''} jump={searchJump} />
      {block.type === 'misconception' && <TriangleAlert size={22} aria-hidden="true" />}
      <div className="detail-block-heading">
        <span>{block.type === 'explain' ? '가장 쉬운 설명' : block.type === 'formula' ? '수식 이해' : block.type === 'source-note' ? block.label : block.type === 'recap' ? '한 번에 복습' : block.type === 'comparison' ? '비교 정리' : '차근차근 이해'}</span>
        <h2>{block.title}</h2>
      </div>
      {block.expression && <div className="formula-expression">{block.expression}</div>}
      <div className="detail-rich-content"><RichContent blocks={block.content ?? []} /></div>
    </section>
  );
}

function DetailedUnitNavigation({ units, activeUnitId, completedUnits, onSelect }: { units: DetailedUnit[]; activeUnitId: string; completedUnits: string[]; onSelect: (unitId: string) => void }) {
  return (
    <nav className="unit-navigation" aria-label="이 장의 세부 학습 순서">
      {units.map((unit) => <button type="button" key={unit.id} className={unit.id === activeUnitId ? 'active' : ''} onClick={() => onSelect(unit.id)} aria-current={unit.id === activeUnitId ? 'step' : undefined}><span>{String(unit.order).padStart(2, '0')}</span><strong>{unit.title}</strong>{completedUnits.includes(unit.id) && <Check size={15} aria-label="완료" />}</button>)}
    </nav>
  );
}

function DetailedChapterLesson({ unit, chapterUnits, completed, searchJump, onToggleCompleted, onSelectUnit, onSelectChapter }: {
  unit: DetailedUnit;
  chapterUnits: DetailedUnit[];
  completed: boolean;
  searchJump: SearchJump | null;
  onToggleCompleted: () => void;
  onSelectUnit: (unitId: string) => void;
  onSelectChapter: (number: number) => void;
}) {
  const previous = chapterUnits[unit.order - 2];
  const next = chapterUnits[unit.order];
  return (
    <article className="lesson-content detailed-lesson" aria-labelledby={`${unit.id}-title`}>
      <header className="unit-hero" id={unit.id} tabIndex={-1}>
        <div><span>학습 {unit.order}/{chapterUnits.length}</span><h2 id={`${unit.id}-title`}>{unit.title}</h2><p>{unit.summary}</p></div>
        <dl><div><dt><Clock3 size={15} /> 예상 시간</dt><dd>{unit.estimated_minutes}분</dd></div><div><dt><FileText size={15} /> 근거</dt><dd>{unit.source_pages.join(', ')}</dd></div></dl>
      </header>
      {unit.blocks.map((block, index) => <DetailedContentBlock key={block.id ?? `${block.type}-${index}`} block={block} searchJump={searchJump} />)}
      <section className="lesson-finish" aria-label={`${unit.title} 학습 마무리`}>
        <div><span>세부 학습 {unit.order} 마무리</span><strong>{completed ? '이 학습 단위를 완료했어요.' : '직접 설명할 수 있다면 완료로 표시하세요.'}</strong></div>
        <button type="button" className={`finish-complete ${completed ? 'done' : ''}`} onClick={onToggleCompleted} aria-pressed={completed}><Target size={18} /> {completed ? '완료 취소' : '단위 완료'}</button>
        <nav aria-label="세부 학습 이동">
          {previous ? <button type="button" onClick={() => onSelectUnit(previous.id)}><ArrowLeft size={18} /> 이전 학습</button> : <span />}
          <button type="button" onClick={() => { window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); }}><ArrowUp size={18} /> 맨 위</button>
          {next ? <button type="button" className="next-chapter" onClick={() => onSelectUnit(next.id)}>다음 학습 <ArrowRight size={18} /></button> : <button type="button" className="next-chapter" onClick={() => onSelectChapter(unit.chapter + 1)}>{unit.chapter + 1}장으로 <ArrowRight size={18} /></button>}
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
  const initialLocation = readInitialLocation();
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState(initialLocation.chapter);
  const [activeUnitId, setActiveUnitId] = useState(initialLocation.unitId ?? firstDetailedUnit(initialLocation.chapter)?.id ?? detailedCourse.units[0].id);
  const [completed, setCompleted] = useState<number[]>([]);
  const [completedUnits, setCompletedUnits] = useState<string[]>([]);
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
  const detailedChapter = detailedCourse.chapters.find((item) => item.number === chapter.number);
  const activeChapterUnits = detailedUnitsForChapter(chapter.number);
  const activeUnit = activeChapterUnits.find((unit) => unit.id === activeUnitId) ?? activeChapterUnits[0] ?? detailedCourse.units[0];
  const navigationItems: SearchResult[] = query.trim()
    ? searchResults
    : chapters.map((item) => ({ chapter: item, section: 'easy', sectionLabel: sectionLabels.easy, snippet: item.description }));
  const drawerOpen = isMobile && drawerMode !== 'closed';
  const menuModalOpen = isMobile && drawerMode === 'menu';
  const searchResultsOpen = isMobile && drawerMode === 'search';
  const legacyCompleted = completed.filter((number) => !detailedChapterNumbers.has(number));
  const isDetailedChapter = Boolean(detailedChapter);
  const detailedCompletedForChapter = completedUnits.filter((id) => activeChapterUnits.some((unit) => unit.id === id));
  const progressValue = isDetailedChapter ? detailedCompletedForChapter.length : legacyCompleted.length;
  const progressMaximum = isDetailedChapter ? activeChapterUnits.length : chapters.length - detailedChapterNumbers.size;
  const progressPercent = progressMaximum === 0 ? 0 : (progressValue / progressMaximum) * 100;
  const progressLabel = isDetailedChapter ? `세부 ${progressValue}/${progressMaximum}` : `요약 장 ${progressValue}/${progressMaximum}`;
  const isChapterCompleted = (chapterNumber: number) => {
    const detailedUnits = detailedUnitsForChapter(chapterNumber);
    return detailedUnits.length > 0 ? detailedUnits.every((unit) => completedUnits.includes(unit.id)) : completed.includes(chapterNumber);
  };

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

  const focusDestination = useCallback((targetId?: string, smooth = true) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const target = targetId ? document.getElementById(targetId) : headingRef.current;
      if (!target) return;
      target.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'start' });
      if (target instanceof HTMLElement) target.focus({ preventScroll: true });
    }));
  }, []);

  const writeLocation = useCallback((number: number, targetId?: string, replace = false, unitId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('chapter', String(number));
    if (detailedChapterNumbers.has(number) && unitId) url.searchParams.set('unit', unitId);
    else url.searchParams.delete('unit');
    url.hash = targetId ? `#${targetId}` : '';
    window.history[replace ? 'replaceState' : 'pushState']({}, '', `${url.pathname}${url.search}${url.hash}`);
    try {
      window.localStorage.setItem(lastLocationKey, JSON.stringify({ chapter: number, targetId, unitId }));
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
  }, [setDrawerMode, setQuery]);

  useEffect(() => {
    const restoredLocation = readInitialLocation();
    const savedProgress = readStoredProgress();
    const currentUrl = new URL(window.location.href);
    const hasValidUrlChapter = validChapterNumbers.has(Number(currentUrl.searchParams.get('chapter')));
    const needsDetailedUnit = detailedChapterNumbers.has(restoredLocation.chapter) && !restoredLocation.unitId;

    // oxlint-disable-next-line react/react-compiler -- hydrate device-local study state after the server render
    setActiveChapter(restoredLocation.chapter);
    setActiveUnitId(restoredLocation.unitId ?? firstDetailedUnit(restoredLocation.chapter)?.id ?? detailedCourse.units[0].id);
    setCompleted(savedProgress.completed);
    setCompletedUnits(savedProgress.completedUnits);
    if (savedProgress.failed) setStorageError('저장된 학습 진도를 읽지 못해 새 진도로 시작했습니다.');
    if (!hasValidUrlChapter || needsDetailedUnit) {
      const canonicalUnit = restoredLocation.unitId ?? firstDetailedUnit(restoredLocation.chapter)?.id;
      writeLocation(restoredLocation.chapter, restoredLocation.targetId ?? canonicalUnit, true, canonicalUnit);
    }
    if (restoredLocation.targetId) focusDestination(restoredLocation.targetId, false);

    const syncFromBrowser = () => {
      const url = new URL(window.location.href);
      const number = Number(url.searchParams.get('chapter'));
      const nextChapter = validChapterNumbers.has(number) ? number : chapters[0]?.number ?? 1;
      const targetId = parseTargetHash(url.hash);
      const unitParam = url.searchParams.get('unit');
      const unitId = detailedChapterNumbers.has(nextChapter) && unitParam && detailedUnitIds.has(unitParam)
        && detailedCourse.units.some((unit) => unit.id === unitParam && unit.chapter === nextChapter)
        ? unitParam
        : firstDetailedUnit(nextChapter)?.id ?? detailedCourse.units[0].id;
      setActiveChapter(nextChapter);
      setActiveUnitId(unitId);
      setQuery('');
      setSearchJump(null);
      setDrawerMode('closed');
      focusDestination(targetId, false);
      try {
        window.localStorage.setItem(lastLocationKey, JSON.stringify({ chapter: nextChapter, targetId, unitId: detailedChapterNumbers.has(nextChapter) ? unitId : undefined }));
      } catch {
        setStorageError('이 브라우저에서는 마지막 학습 위치를 저장할 수 없습니다.');
      }
    };

    const syncProgressAcrossTabs = (event: StorageEvent) => {
      if (event.key !== progressKey) return;
      const synced = readStoredProgress();
      setCompleted(synced.completed);
      setCompletedUnits(synced.completedUnits);
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
          schemaVersion: 2,
          legacyCompletedChapters: next,
          completedUnitIds: completedUnits,
        }));
        setStorageError('');
      } catch {
        setStorageError('완료 표시는 현재 화면에만 반영됐습니다. 브라우저 저장 권한을 확인해주세요.');
      }
      return next;
    });
  };

  const toggleUnitCompleted = () => {
    setCompletedUnits((current) => {
      const next = current.includes(activeUnit.id) ? current.filter((id) => id !== activeUnit.id) : [...current, activeUnit.id];
      try {
        window.localStorage.setItem(progressKey, JSON.stringify({ schemaVersion: 2, legacyCompletedChapters: completed, completedUnitIds: next }));
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
    const defaultUnit = firstDetailedUnit(number);
    if (defaultUnit) setActiveUnitId(result?.unitId ?? defaultUnit.id);
    setSearchJump(jump);
    setQuery('');
    closeDrawer(false);
    writeLocation(number, result?.section, false, defaultUnit ? result?.unitId ?? defaultUnit.id : undefined);
    focusDestination(result?.section);
  };

  const selectUnit = (unitId: string, targetId?: string) => {
    const unit = detailedCourse.units.find((item) => item.id === unitId);
    if (!unit) return;
    setActiveChapter(unit.chapter);
    setActiveUnitId(unitId);
    setSearchJump(null);
    writeLocation(unit.chapter, targetId ?? unitId, false, unitId);
    focusDestination(targetId ?? unitId);
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
        <a className="brand" href={isDetailedChapter ? `?chapter=${chapter.number}&unit=${activeChapterUnits[0].id}#${activeChapterUnits[0].id}` : `?chapter=${chapter.number}#easy`} onClick={(event) => { event.preventDefault(); if (isDetailedChapter) selectUnit(activeChapterUnits[0].id); else navigateSection('easy'); }}><GraduationCap /><div><strong>금융시장론</strong><span>전 강의 공부노트</span></div></a>
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
        <div className="progress-summary" role="progressbar" aria-label={`${progressLabel} 완료 진도`} aria-valuemin={0} aria-valuemax={progressMaximum} aria-valuenow={progressValue}><span>{progressLabel} 완료</span><div><i style={{ width: `${progressPercent}%` }} /></div></div>
        <span className="mobile-progress" aria-live="polite">{progressLabel}</span>
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
          <a className="hub-back" href="https://hyunchanwi.github.io/study-hub/"><ArrowLeft size={15} /> 전체 과목</a>
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
                {isChapterCompleted(result.chapter.number) && <Check className="chapter-check" size={16} />}
              </button>
            ))}
            {navigationItems.length === 0 && <p className="empty-search"><strong>일치하는 내용이 없습니다.</strong><span>띄어쓰기를 바꾸거나 더 짧은 핵심어로 검색해보세요.</span></p>}
          </nav>
        </aside>

        <div className="content-wrap">
          <section className="lesson-hero">
            <div>
              <span className="eyebrow">CHAPTER {String(chapter.number).padStart(2, '0')} · {isDetailedChapter ? '상세 학습 파일럿' : '강의자료 기반 초안'}</span>
              <h1 ref={headingRef} tabIndex={-1}>{detailedChapter?.title ?? chapter.title}</h1>
              <p>{detailedChapter?.description ?? chapter.description}</p>
              <div className="topic-row">{(detailedChapter?.topics ?? chapter.topics).map((topic) => <span key={topic}>{topic}</span>)}</div>
            </div>
            {isDetailedChapter
              ? <div className="detail-progress-pill"><Target size={19} /><span><strong>{detailedCompletedForChapter.length}/{activeChapterUnits.length}</strong> 세부 학습 완료</span></div>
              : <button type="button" className={`complete-button ${completed.includes(chapter.number) ? 'done' : ''}`} onClick={toggleCompleted} aria-pressed={completed.includes(chapter.number)}><Target size={19} /> {completed.includes(chapter.number) ? '학습 완료됨' : '학습 완료 표시'}</button>}
          </section>

          {isDetailedChapter
            ? <DetailedUnitNavigation units={activeChapterUnits} activeUnitId={activeUnit.id} completedUnits={completedUnits} onSelect={selectUnit} />
            : <SectionNavigation chapter={chapter} compact onNavigate={navigateSection} />}

          <div className="lesson-layout">
            {isDetailedChapter
              ? <DetailedChapterLesson key={activeUnit.id} unit={activeUnit} chapterUnits={activeChapterUnits} completed={completedUnits.includes(activeUnit.id)} searchJump={searchJump} onToggleCompleted={toggleUnitCompleted} onSelectUnit={selectUnit} onSelectChapter={selectChapter} />
              : <ChapterLesson key={chapter.number} chapter={chapter} completed={completed.includes(chapter.number)} searchJump={searchJump} onToggleCompleted={toggleCompleted} onSelectChapter={selectChapter} onNavigateSection={navigateSection} />}
            <aside className="on-this-page">
              <strong>이 장의 구성</strong>
              {isDetailedChapter
                ? <nav className="section-links" aria-label="현재 세부 학습의 구성">{activeUnit.blocks.filter((block) => block.id).map((block) => <a key={block.id} href={`?chapter=${chapter.number}&unit=${activeUnit.id}#${block.id}`} onClick={(event) => { event.preventDefault(); selectUnit(activeUnit.id, block.id); }}>{block.title}</a>)}</nav>
                : <SectionNavigation chapter={chapter} onNavigate={navigateSection} />}
              <div className="memory-tip"><Sparkles size={17} /><span><strong>기억 공식</strong>{detailedChapter?.memory ?? chapter.memory}</span></div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}
