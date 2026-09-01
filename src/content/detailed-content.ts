import compiled from '../../.generated/financial-markets/course.json';

export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong'; children: InlineNode[] }
  | { type: 'emphasis'; children: InlineNode[] }
  | { type: 'delete'; children: InlineNode[] }
  | { type: 'link'; url: string; children: InlineNode[] };

export type RichBlock =
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'quote'; content: RichBlock[] }
  | { type: 'list'; ordered: boolean; items: RichBlock[][] }
  | { type: 'table'; headers: string[]; rows: string[][] };

export type ContentBlock = {
  id?: string;
  type: 'explain' | 'mechanism' | 'comparison' | 'formula' | 'misconception' | 'practice' | 'visual' | 'source-note' | 'recap';
  title?: string;
  content?: RichBlock[];
  ref?: string;
  expression?: string;
  question?: string;
  answer?: string;
  label?: string;
};

export type DetailedUnit = {
  id: string;
  chapter: number;
  order: number;
  title: string;
  summary: string;
  source_pages: string[];
  estimated_minutes: number;
  blocks: ContentBlock[];
};

export type NetworkVisual = {
  id: string;
  type: 'flow' | 'tree' | 'decision';
  title: string;
  caption: string;
  nodes: { id: string; label: string; detail?: string; group?: string }[];
  edges: { from: string; to: string; label?: string }[];
};

export type BarVisual = {
  id: string;
  type: 'bar';
  title: string;
  caption: string;
  category_label: string;
  series: { category: string; financial: number; nonfinancial: number }[];
};

export type LineVisual = {
  id: string;
  type: 'line';
  title: string;
  caption: string;
  x_label: string;
  y_label: string;
  points: { label: string; x: number; y: number }[];
};

export type DetailedVisual = NetworkVisual | BarVisual | LineVisual;

export type DetailedChapter = {
  number: number;
  title: string;
  description: string;
  topics: string[];
  memory: string;
  delivery: 'pilot' | 'detailed';
};

export type DetailedCourse = {
  chapter: DetailedChapter;
  chapters: DetailedChapter[];
  units: DetailedUnit[];
  visuals: Record<string, DetailedVisual>;
  searchDocuments: { unitId: string; chapter: number; text: string }[];
  coverage: { sourceId: string; pages: number; mapped: number };
};

export const detailedCourse = compiled as DetailedCourse;
export const detailedUnitIds = new Set(detailedCourse.units.map((unit) => unit.id));
