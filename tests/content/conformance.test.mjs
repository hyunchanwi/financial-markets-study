import assert from 'node:assert/strict';
import test from 'node:test';
import { parseUnitMarkdown } from '../../scripts/content/lib/compiler.mjs';

const frontmatter = `---\nid: ch01-test-unit\nchapter: 1\norder: 1\ntitle: 테스트\nsummary: 테스트 요약\nsource_pages:\n  - fm-p01:1\nestimated_minutes: 3\n---`;

test('accepts the restricted Markdown contract', () => {
  const unit = parseUnitMarkdown(`${frontmatter}\n\n:::explain{id="easy" title="쉬운 설명"}\n강조할 **핵심**입니다.\n:::`);
  assert.equal(unit.blocks[0].type, 'explain');
});
test('rejects raw HTML and JSX-shaped markup', () => {
  assert.throws(() => parseUnitMarkdown(`${frontmatter}\n\n<script>alert(1)</script>`), /raw HTML|only allowlisted/);
  assert.throws(() => parseUnitMarkdown(`${frontmatter}\n\n<Component />`), /raw HTML|only allowlisted/);
});
test('rejects unknown directives and attributes', () => {
  assert.throws(() => parseUnitMarkdown(`${frontmatter}\n\n:::unknown{id="x" title="X"}\ntext\n:::`), /unknown directive/);
  assert.throws(() => parseUnitMarkdown(`${frontmatter}\n\n:::explain{id="x" title="X" onclick="bad"}\ntext\n:::`), /unknown attribute/);
});
test('rejects duplicate YAML keys and extra frontmatter fields', () => {
  assert.throws(() => parseUnitMarkdown(`${frontmatter.replace('title: 테스트', 'title: 테스트\ntitle: 중복')}\n\n:::explain{id="x" title="X"}\ntext\n:::`), /Map keys must be unique/);
  assert.throws(() => parseUnitMarkdown(`${frontmatter.replace('estimated_minutes: 3', 'estimated_minutes: 3\nscript: nope')}\n\n:::explain{id="x" title="X"}\ntext\n:::`), /additional properties/);
});
