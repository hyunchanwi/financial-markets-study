import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import { unified } from 'unified';
import remarkDirective from 'remark-directive';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { parseDocument } from 'yaml';
import { chapterSchema, courseSchema, ledgerSchema, sourcesSchema, unitFrontmatterSchema, visualSchema } from './schemas.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(currentDir, '../../..');
export const courseRoot = path.join(repoRoot, 'content/courses/financial-markets');
export const generatedRoot = path.join(repoRoot, '.generated/financial-markets');
const allowedDirectives = new Set(['explain', 'mechanism', 'comparison', 'formula', 'misconception', 'practice', 'visual', 'source-note', 'recap']);
const ajv = new Ajv({ allErrors: true, strict: true, allowUnionTypes: true });
const validators = { course: ajv.compile(courseSchema), sources: ajv.compile(sourcesSchema), chapter: ajv.compile(chapterSchema), unit: ajv.compile(unitFrontmatterSchema), visual: ajv.compile(visualSchema), ledger: ajv.compile(ledgerSchema) };

function fail(message, location = '') { throw new Error(`${location ? `${location}: ` : ''}${message}`); }
function validate(kind, value, location) {
  const validator = validators[kind];
  if (!validator(value)) fail(`${kind} schema validation failed: ${ajv.errorsText(validator.errors, { separator: '; ' })}`, location);
  return value;
}
function parseYamlStrict(source, location) {
  const document = parseDocument(source, { schema: 'core', uniqueKeys: true });
  const issues = [...document.errors, ...document.warnings];
  if (issues.length) fail(issues.map((issue) => issue.message).join('; '), location);
  return document.toJS({ maxAliasCount: 0 });
}
async function readYaml(filePath, kind) {
  const location = path.relative(repoRoot, filePath);
  return validate(kind, parseYamlStrict(await readFile(filePath, 'utf8'), location), location);
}
function inline(node, location) {
  if (node.type === 'text') return { type: 'text', value: node.value };
  if (node.type === 'inlineCode') return { type: 'code', value: node.value };
  if (node.type === 'break') return { type: 'text', value: '\n' };
  if (['strong', 'emphasis', 'delete'].includes(node.type)) return { type: node.type, children: node.children.map((child) => inline(child, location)) };
  if (node.type === 'link') {
    if (!node.url.startsWith('https://')) fail('only https links are allowed', location);
    return { type: 'link', url: node.url, children: node.children.map((child) => inline(child, location)) };
  }
  fail(`unsupported inline Markdown node "${node.type}"`, location);
}
function plainText(nodes) {
  return nodes.map((node) => 'value' in node ? node.value : 'children' in node ? plainText(node.children) : 'content' in node ? plainText(node.content) : '').join(' ');
}
function richBlock(node, location) {
  if (node.type === 'paragraph') return { type: 'paragraph', children: node.children.map((child) => inline(child, location)) };
  if (node.type === 'blockquote') return { type: 'quote', content: node.children.map((child) => richBlock(child, location)) };
  if (node.type === 'list') return { type: 'list', ordered: Boolean(node.ordered), items: node.children.map((item) => item.children.map((child) => richBlock(child, location))) };
  if (node.type === 'table') {
    const rows = node.children.map((row) => row.children.map((cell) => plainText(cell.children)));
    return { type: 'table', headers: rows[0] ?? [], rows: rows.slice(1) };
  }
  fail(`unsupported block Markdown node "${node.type}"`, location);
}
function requiredAttribute(attributes, name, location) {
  const value = attributes?.[name];
  if (typeof value !== 'string' || !value.trim()) fail(`directive attribute "${name}" is required`, location);
  return value.trim();
}

export function parseUnitMarkdown(source, location = 'unit.md') {
  const tree = unified().use(remarkParse).use(remarkFrontmatter, ['yaml']).use(remarkGfm).use(remarkDirective).parse(source);
  const yamlNodes = tree.children.filter((node) => node.type === 'yaml');
  if (yamlNodes.length !== 1 || tree.children[0]?.type !== 'yaml') fail('exactly one YAML frontmatter block must appear first', location);
  const meta = validate('unit', parseYamlStrict(yamlNodes[0].value, location), location);
  const blocks = [];
  const blockIds = new Set();
  for (const node of tree.children.slice(1)) {
    if (node.type === 'html') fail('raw HTML/JSX is not allowed', location);
    if (node.type !== 'containerDirective') fail('unit body may contain only allowlisted container directives', location);
    if (!allowedDirectives.has(node.name)) fail(`unknown directive "${node.name}"`, location);
    const attributes = node.attributes ?? {};
    const allowedAttributes = node.name === 'visual' ? new Set(['ref']) : node.name === 'practice' ? new Set(['id', 'title', 'question', 'answer']) : node.name === 'formula' ? new Set(['id', 'title', 'expression']) : new Set(['id', 'title', 'label']);
    for (const key of Object.keys(attributes)) if (!allowedAttributes.has(key)) fail(`unknown attribute "${key}" on ${node.name}`, location);
    if (node.name === 'visual') { blocks.push({ type: 'visual', ref: requiredAttribute(attributes, 'ref', location) }); continue; }
    const id = requiredAttribute(attributes, 'id', location);
    if (blockIds.has(id)) fail(`duplicate block id "${id}"`, location);
    blockIds.add(id);
    const title = requiredAttribute(attributes, 'title', location);
    const content = node.children.map((child) => richBlock(child, location));
    const block = { id, type: node.name, title, content };
    if (node.name === 'formula') block.expression = requiredAttribute(attributes, 'expression', location);
    if (node.name === 'practice') { block.question = requiredAttribute(attributes, 'question', location); block.answer = requiredAttribute(attributes, 'answer', location); }
    if (typeof attributes.label === 'string') block.label = attributes.label;
    blocks.push(block);
  }
  if (!blocks.length) fail('at least one content block is required', location);
  return { ...meta, blocks };
}
function extractSearchText(unit) {
  const values = [unit.title, unit.summary];
  for (const block of unit.blocks) {
    values.push(block.title ?? '', block.question ?? '', block.answer ?? '');
    for (const content of block.content ?? []) values.push(plainText([content]));
  }
  return values.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}
function hash(value) { return createHash('sha256').update(value).digest('hex'); }

export async function compileCourse({ write = false } = {}) {
  const course = await readYaml(path.join(courseRoot, 'course.yaml'), 'course');
  const sources = await readYaml(path.join(courseRoot, 'sources.yaml'), 'sources');
  if (new Set(sources.packets.map((packet) => packet.id)).size !== sources.packets.length) fail('source packet ids must be unique');
  const totalSourcePages = sources.packets.reduce((total, packet) => total + packet.pages, 0);
  if (sources.packets.length !== 14 || totalSourcePages !== 402) fail('source registry must contain the 14 lecture packets and 402 total pages');
  const detailedEntries = course.chapters.filter((entry) => entry.delivery === 'pilot' || entry.delivery === 'detailed');
  const chapters = [];
  const units = [];
  const visuals = {};
  for (const entry of detailedEntries) {
    const chapterRoot = path.join(courseRoot, 'chapters', entry.slug);
    const chapter = await readYaml(path.join(chapterRoot, 'chapter.yaml'), 'chapter');
    if (chapter.number !== entry.number || chapter.delivery !== entry.delivery) fail(`course and chapter metadata disagree for ${entry.slug}`);
    chapters.push(chapter);
    const unitDirectory = path.join(chapterRoot, 'units');
    const visualDirectory = path.join(chapterRoot, 'visuals');
    const unitFiles = (await readdir(unitDirectory)).filter((file) => file.endsWith('.md')).sort();
    const visualFiles = (await readdir(visualDirectory)).filter((file) => file.endsWith('.json')).sort();
    const chapterUnits = [];
    for (const file of unitFiles) {
      const location = path.join('content/courses/financial-markets/chapters', entry.slug, 'units', file);
      const unit = parseUnitMarkdown(await readFile(path.join(unitDirectory, file), 'utf8'), location);
      if (unit.chapter !== chapter.number) fail(`unit ${unit.id} has the wrong chapter number`, location);
      chapterUnits.push(unit);
      units.push(unit);
    }
    for (const file of visualFiles) {
      const location = path.join('content/courses/financial-markets/chapters', entry.slug, 'visuals', file);
      const visual = validate('visual', JSON.parse(await readFile(path.join(visualDirectory, file), 'utf8')), location);
      if (visuals[visual.id]) fail(`duplicate visual id "${visual.id}"`, location);
      const ids = new Set(visual.nodes?.map((node) => node.id) ?? []);
      for (const edge of visual.edges ?? []) if (!ids.has(edge.from) || !ids.has(edge.to)) fail('visual edge references an unknown node', location);
      visuals[visual.id] = visual;
    }
    chapterUnits.sort((a, b) => a.order - b.order);
    if (new Set(chapterUnits.map((unit) => unit.order)).size !== chapterUnits.length) fail(`unit order values must be unique within chapter ${chapter.number}`);
    if (chapter.units.join('|') !== chapterUnits.map((unit) => unit.id).join('|')) fail(`chapter ${chapter.number} unit order does not match compiled units`);
  }
  if (new Set(units.map((unit) => unit.id)).size !== units.length) fail('unit ids must be unique');
  for (const unit of units) for (const block of unit.blocks) if (block.type === 'visual' && !visuals[block.ref]) fail(`unit ${unit.id} references unknown visual "${block.ref}"`);
  const packetById = new Map(sources.packets.map((packet) => [packet.id, packet]));
  for (const unit of units) {
    for (const range of unit.source_pages) {
      const [sourceId, pageRange] = range.split(':');
      const packet = packetById.get(sourceId);
      if (!packet || packet.chapter !== unit.chapter) fail(`unit ${unit.id} references an unknown or wrong-chapter source "${range}"`);
      const [start, end = start] = pageRange.split('-').map(Number);
      if (start < 1 || end < start || end > packet.pages) fail(`unit ${unit.id} has an invalid source range "${range}"`);
    }
  }
  const ledgerLines = (await readFile(path.join(courseRoot, 'page-ledger.jsonl'), 'utf8')).split(/\r?\n/).filter(Boolean);
  const ledger = ledgerLines.map((line, index) => validate('ledger', JSON.parse(line), `page-ledger.jsonl:${index + 1}`));
  const unitIds = new Set(units.map((unit) => unit.id));
  const ledgerKeys = new Set();
  for (const row of ledger) {
    const key = `${row.source_id}:${row.page}`;
    if (ledgerKeys.has(key)) fail(`duplicate ledger row "${key}"`);
    ledgerKeys.add(key);
    if (row.disposition === 'unit' && row.unit_id === null) fail(`ledger row ${key} must reference a unit`);
    if (row.disposition !== 'unit' && row.unit_id !== null) fail(`ledger row ${key} must not reference a unit`);
    if (row.unit_id !== null && !unitIds.has(row.unit_id)) fail(`ledger row ${key} references unknown unit "${row.unit_id}"`);
  }
  const detailedPackets = sources.packets.filter((packet) => detailedEntries.some((entry) => entry.number === packet.chapter));
  for (const packet of detailedPackets) {
    const rows = ledger.filter((row) => row.source_id === packet.id).sort((a, b) => a.page - b.page);
    if (rows.length !== packet.pages || rows.some((row, index) => row.page !== index + 1 || row.chapter !== packet.chapter)) fail(`ledger must cover ${packet.id} pages 1 through ${packet.pages} exactly once`);
  }
  const expectedLedgerRows = detailedPackets.reduce((total, packet) => total + packet.pages, 0);
  if (ledger.length !== expectedLedgerRows) fail(`ledger has ${ledger.length} rows but ${expectedLedgerRows} are required for detailed chapters`);
  const source = JSON.stringify({ course, sources, chapters, units, visuals, ledger });
  const output = {
    compilerVersion: 2, contentHash: hash(source), generatedAt: new Date().toISOString(), course, chapter: chapters[0], chapters, units, visuals,
    searchDocuments: units.map((unit) => ({ unitId: unit.id, chapter: unit.chapter, text: extractSearchText(unit) })),
    coverage: { sourceId: 'detailed-packets', pages: ledger.length, mapped: ledger.filter((row) => row.unit_id).length, registeredPackets: sources.packets.length, registeredPages: totalSourcePages },
  };
  if (write) {
    const temporary = `${generatedRoot}.tmp-${process.pid}`;
    await rm(temporary, { recursive: true, force: true });
    await mkdir(temporary, { recursive: true });
    await writeFile(path.join(temporary, 'course.json'), `${JSON.stringify(output, null, 2)}\n`);
    await writeFile(path.join(temporary, 'manifest.json'), `${JSON.stringify({ compilerVersion: 2, contentHash: output.contentHash }, null, 2)}\n`);
    await rm(generatedRoot, { recursive: true, force: true });
    await rename(temporary, generatedRoot);
  }
  return output;
}
