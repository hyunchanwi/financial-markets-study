'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, GraduationCap, Lightbulb, Menu, Search, Sparkles, Target, X } from 'lucide-react';

type Chapter = { number: number; title: string; description: string; topics: string[]; status: 'ready' | 'planned' };
const chapters: Chapter[] = [
  { number: 1, title: '금융시장 기초', description: '돈이 필요한 곳과 남는 곳을 연결하는 금융시장의 전체 지도를 배워요.', topics: ['금융시장의 역할', '직접·간접금융', '화폐·자본시장'], status: 'ready' },
  { number: 2, title: '금융시장의 효율성', description: '시장기회선과 정보효율성을 통해 좋은 금융시장의 조건을 이해해요.', topics: ['운영·배분효율성', '시장기회선', '약형·준강형·강형'], status: 'planned' },
  { number: 3, title: '금융기관', description: '은행과 여러 금융기관이 자금의 규모·만기·위험을 바꾸는 방식을 살펴봐요.', topics: ['한국은행', '은행·비은행', '금융시장 관련기관'], status: 'planned' },
  { number: 4, title: '단기금융시장', description: '1년 미만 자금이 거래되는 시장과 대표 상품을 비교해요.', topics: ['콜·RP', 'CD·CP', '전자단기사채'], status: 'planned' },
  { number: 5, title: '장기금융시장', description: '주식과 채권이 발행되고 다시 거래되는 자본시장을 연결해서 배워요.', topics: ['주식·채권', '발행시장', '유통시장'], status: 'planned' },
  { number: 6, title: '예금시장', description: '예금의 종류와 지급·청산·결제로 이어지는 돈의 이동을 공부해요.', topics: ['소비임치', '예금의 종류', '지급결제'], status: 'planned' },
  { number: 7, title: '대출시장', description: '기업·가계대출과 상거래금융, 상환 방식의 차이를 익혀요.', topics: ['기업·가계대출', 'DSR·LTV', '팩토링'], status: 'planned' },
  { number: 8, title: '여신전문금융시장', description: '예금 없이 자금을 조달하는 카드·리스·할부금융 회사를 알아봐요.', topics: ['카드', '리스·할부', '신기술금융'], status: 'planned' },
  { number: 9, title: '집합투자증권시장', description: '여러 사람의 돈을 모아 운용하는 펀드와 ETF의 구조를 이해해요.', topics: ['신탁형·회사형', 'ETF', '대체펀드'], status: 'planned' },
  { number: 10, title: '보험시장', description: '여러 사람에게 위험을 분산하는 생명·손해·재보험의 원리를 배워요.', topics: ['대수의 법칙', '생명·손해보험', '재보험'], status: 'planned' },
];
const comparisons = [
  ['누가 자금조달 증권을 발행하나?', '기업·정부 등 자금 수요자', '금융기관'],
  ['투자자가 가지는 것', '주식·회사채 등 직접증권', '예금·펀드 등 간접증권'],
  ['누가 위험을 부담하나?', '주로 투자자', '금융기관이 선별·분산'],
  ['대표적인 예', '주식 매수, 회사채 투자', '은행 예금'],
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [activeChapter, setActiveChapter] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(false);
  useEffect(() => { const saved = window.localStorage.getItem('fm-completed'); if (saved) setCompleted(JSON.parse(saved)); }, []);
  const filtered = useMemo(() => { const keyword = query.trim().toLowerCase(); return keyword ? chapters.filter((c) => [c.title, c.description, ...c.topics].join(' ').toLowerCase().includes(keyword)) : chapters; }, [query]);
  function toggleComplete(number: number) { const next = completed.includes(number) ? completed.filter((item) => item !== number) : [...completed, number]; setCompleted(next); window.localStorage.setItem('fm-completed', JSON.stringify(next)); }
  function selectChapter(number: number) { setActiveChapter(number); setMenuOpen(false); window.setTimeout(() => document.querySelector('#lesson')?.scrollIntoView({ behavior: 'smooth' }), 30); }
  const progress = Math.round((completed.length / chapters.length) * 100);
  const current = chapters.find((chapter) => chapter.number === activeChapter)!;
  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark"><GraduationCap size={21} /></span><span><b>Market Note</b><small>금융시장론 학습실</small></span></a>
        <label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="장 또는 개념 검색" aria-label="장 또는 개념 검색" />{query && <button onClick={() => setQuery('')} aria-label="검색어 지우기"><X size={16} /></button>}</label>
        <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label="목차 열기"><Menu size={21} /></button>
        <div className="header-progress" aria-label={`전체 진도 ${progress}%`}><span>{progress}%</span><div><i style={{ width: `${progress}%` }} /></div></div>
      </header>
      <div className="workspace" id="top">
        <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
          <div className="sidebar-heading"><span>강의 목차</span><small>{completed.length} / 10 완료</small></div>
          <nav aria-label="강의 목차">{filtered.map((chapter) => <button key={chapter.number} className={activeChapter === chapter.number ? 'active' : ''} onClick={() => selectChapter(chapter.number)}><span className={`chapter-dot ${completed.includes(chapter.number) ? 'done' : ''}`}>{completed.includes(chapter.number) ? <Check size={13} /> : chapter.number}</span><span><b>{chapter.title}</b><small>{chapter.topics[0]}</small></span><ChevronRight size={15} /></button>)}</nav>
          {filtered.length === 0 && <p className="empty-search">일치하는 개념이 없어요.</p>}
          <div className="sidebar-card"><Sparkles size={18} /><b>채팅에서 배운 내용</b><p>중요한 질문과 오답은 각 장의 노트에 계속 쌓아갈 거예요.</p></div>
        </aside>
        <main className="content" id="lesson">
          <section className="lesson-hero"><div><div className="eyebrow">CHAPTER {current.number} · {current.status === 'ready' ? '학습 가능' : '제작 예정'}</div><h1>{current.title}</h1><p>{current.description}</p><div className="topic-tags">{current.topics.map((topic) => <span key={topic}>{topic}</span>)}</div></div><button className={completed.includes(current.number) ? 'complete-button completed' : 'complete-button'} onClick={() => toggleComplete(current.number)}>{completed.includes(current.number) ? <><Check size={18} /> 학습 완료</> : <><Target size={18} /> 완료로 표시</>}</button></section>
          {activeChapter === 1 ? <ChapterOne answerOpen={answerOpen} setAnswerOpen={setAnswerOpen} /> : <PlannedChapter chapter={current} onBack={() => selectChapter(1)} />}
        </main>
        <aside className="right-rail"><div className="rail-block"><span className="rail-label">이 페이지에서</span><a href="#easy">한 문장으로 이해하기</a><a href="#flow">금융시장의 흐름</a><a href="#compare">직접·간접금융 비교</a><a href="#check">확인 문제</a></div><div className="memory-card"><Lightbulb size={18} /><b>오늘의 기억 문장</b><p>금융시장은 남는 돈을 필요한 곳으로 보내는 경제의 혈관이다.</p></div></aside>
      </div>
    </div>
  );
}

function ChapterOne({ answerOpen, setAnswerOpen }: { answerOpen: boolean; setAnswerOpen: (value: boolean) => void }) {
  return <div className="lesson-stack">
    <section className="note-card intro-card" id="easy"><span className="section-kicker"><Sparkles size={16} /> 먼저 쉽게</span><h2>금융시장은 돈의 ‘환승역’이에요</h2><p className="lead">누군가는 지금 쓰지 않는 돈이 있고, 누군가는 사업이나 생활을 위해 지금 돈이 필요합니다. 금융시장은 이 둘을 만나게 해주는 모든 체계예요.</p><div className="definition"><span>시험용 정의</span><p>금융시장은 경제주체들이 금융상품을 거래함으로써 자금을 조달하거나 운용하는 조직화된 체계이다.</p></div></section>
    <section className="note-card" id="flow"><span className="section-kicker"><BookOpen size={16} /> 흐름으로 이해하기</span><h2>돈은 어디에서 어디로 갈까?</h2><div className="flow-diagram" role="img" aria-label="가계의 여유자금이 금융시장을 거쳐 기업과 정부로 이동하는 그림"><div className="flow-node supply"><small>자금 공급자</small><b>가계</b><span>저축 · 투자</span></div><div className="flow-arrow"><span>여유자금</span><ArrowRight /></div><div className="flow-node market"><small>연결과 가격 결정</small><b>금융시장</b><span>은행 · 증권시장</span></div><div className="flow-arrow"><span>조달자금</span><ArrowRight /></div><div className="flow-node demand"><small>자금 수요자</small><b>기업 · 정부</b><span>투자 · 공공사업</span></div></div><div className="insight"><Lightbulb size={18} /><p><b>핵심:</b> 가계가 항상 공급자이고 기업이 항상 수요자인 것은 아니지만, 경제 전체에서는 대표적으로 이렇게 설명해요.</p></div></section>
    <section className="note-card"><span className="section-kicker"><Target size={16} /> 금융시장의 네 가지 역할</span><h2>연결만 하는 것이 아니에요</h2><div className="role-grid">{[['01','자금의 효율적 배분','수익성 있는 기업과 필요한 사업에 자금이 흘러가도록 합니다.'],['02','금융자산의 가격 결정','수요와 공급을 통해 주가·금리·환율이 형성됩니다.'],['03','위험 분산','보험, 분산투자, 파생상품으로 위험을 나누거나 이전합니다.'],['04','유동성 제공','보유한 주식이나 채권을 팔아 현금으로 바꿀 수 있게 합니다.']].map(([n,t,x]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{x}</p></article>)}</div></section>
    <section className="note-card" id="compare"><span className="section-kicker"><CircleHelp size={16} /> 가장 많이 헷갈리는 비교</span><h2>직접금융 vs 간접금융</h2><p className="subcopy">‘직접’은 증권사 없이 만난다는 뜻이 아니라, <b>자금 수요자가 발행한 증권을 투자자가 직접 보유한다</b>는 뜻이에요.</p><div className="mini-flow"><div><b>직접금융</b><span>가계</span><ArrowRight /><em>주식·채권</em><ArrowRight /><span>기업</span></div><div><b>간접금융</b><span>가계</span><ArrowRight /><em>은행</em><ArrowRight /><span>기업</span></div></div><div className="comparison-table"><div className="table-row table-head"><span>구분</span><b>직접금융</b><b>간접금융</b></div>{comparisons.map(([l,d,i]) => <div className="table-row" key={l}><span>{l}</span><p>{d}</p><p>{i}</p></div>)}</div></section>
    <section className="quiz-card" id="check"><div><span className="section-kicker"><GraduationCap size={16} /> 1분 확인 문제</span><h2>다음 설명은 맞을까요?</h2><p>“직접금융은 금융기관이나 증권회사가 거래 과정에 전혀 참여하지 않는 금융 방식이다.”</p></div><div className="quiz-action"><button onClick={() => setAnswerOpen(!answerOpen)}>{answerOpen ? '해설 닫기' : '정답 확인'}<ChevronRight size={16} /></button>{answerOpen && <div className="answer"><b>정답은 X</b><p>증권회사가 발행이나 매매를 도울 수 있습니다. 핵심은 투자자가 기업·정부가 발행한 직접증권을 보유한다는 점이에요.</p></div>}</div></section>
    <section className="memory-strip"><div><span>01</span><p><b>금융시장</b>은 자금 공급자와 수요자를 연결한다.</p></div><div><span>02</span><p><b>직접금융</b>에서는 수요자가 발행한 증권을 투자자가 보유한다.</p></div><div><span>03</span><p><b>간접금융</b>에서는 금융기관이 자금과 위험을 중개한다.</p></div></section>
  </div>;
}

function PlannedChapter({ chapter, onBack }: { chapter: Chapter; onBack: () => void }) {
  return <section className="planned-card"><span className="planned-number">{String(chapter.number).padStart(2, '0')}</span><div><span className="section-kicker"><Sparkles size={16} /> 다음 제작 노트</span><h2>{chapter.title} 노트를 준비하고 있어요</h2><p>강의자료를 기준으로 쉬운 설명, 흐름도, 비교표, 시험용 정의와 확인 문제를 같은 형식으로 채울 예정입니다.</p><div className="topic-tags">{chapter.topics.map((topic) => <span key={topic}>{topic}</span>)}</div><button onClick={onBack}>완성된 1장 먼저 보기 <ArrowRight size={16} /></button></div></section>;
}
