export const courseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'schema_version', 'publication', 'chapters'],
  properties: {
    id: { const: 'financial-markets' },
    title: { type: 'string', minLength: 1 },
    schema_version: { const: 1 },
    publication: { enum: ['draft', 'pilot', 'published'] },
    chapters: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['number', 'slug', 'delivery'],
        properties: {
          number: { type: 'integer', minimum: 1 },
          slug: { type: 'string', pattern: '^ch[0-9]{2}$' },
          delivery: { enum: ['legacy', 'pilot', 'detailed'] },
        },
      },
    },
  },
};

export const sourcesSchema = {
  type: 'object', additionalProperties: false, required: ['course', 'authority', 'packets'],
  properties: {
    course: { const: 'financial-markets' }, authority: { const: 'local-lecture-materials' },
    packets: {
      type: 'array', minItems: 1,
      items: {
        type: 'object', additionalProperties: false, required: ['id', 'chapter', 'pages', 'file'],
        properties: {
          id: { type: 'string', pattern: '^fm-p[0-9]{2}$' }, chapter: { type: 'integer', minimum: 1, maximum: 10 },
          pages: { type: 'integer', minimum: 1 }, file: { type: 'string', pattern: '\\.pdf$' },
        },
      },
    },
  },
};

export const chapterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['number', 'id', 'title', 'description', 'topics', 'memory', 'delivery', 'units'],
  properties: {
    number: { type: 'integer', minimum: 1 },
    id: { type: 'string', pattern: '^chapter-[0-9]+$' },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    topics: { type: 'array', minItems: 1, items: { type: 'string', minLength: 1 } },
    memory: { type: 'string', minLength: 1 },
    delivery: { enum: ['pilot', 'detailed'] },
    units: { type: 'array', minItems: 1, items: { type: 'string', pattern: '^ch[0-9]{2}-[a-z0-9-]+$' } },
  },
};

export const unitFrontmatterSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'chapter', 'order', 'title', 'summary', 'source_pages', 'estimated_minutes'],
  properties: {
    id: { type: 'string', pattern: '^ch[0-9]{2}-[a-z0-9-]+$' },
    chapter: { type: 'integer', minimum: 1 },
    order: { type: 'integer', minimum: 1 },
    title: { type: 'string', minLength: 1 },
    summary: { type: 'string', minLength: 1 },
    source_pages: {
      type: 'array', minItems: 1, uniqueItems: true,
      items: { type: 'string', pattern: '^fm-p[0-9]{2}:[0-9]+(?:-[0-9]+)?$' },
    },
    estimated_minutes: { type: 'integer', minimum: 1, maximum: 60 },
  },
};

const nodeSchema = {
  type: 'object', additionalProperties: false, required: ['id', 'label'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9-]+$' }, label: { type: 'string', minLength: 1 },
    detail: { type: 'string' }, group: { type: 'string' },
  },
};
const edgeSchema = {
  type: 'object', additionalProperties: false, required: ['from', 'to'],
  properties: { from: { type: 'string' }, to: { type: 'string' }, label: { type: 'string' } },
};

export const visualSchema = {
  oneOf: [
    {
      type: 'object', additionalProperties: false,
      required: ['id', 'type', 'title', 'caption', 'nodes', 'edges'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9-]+$' }, type: { enum: ['flow', 'tree', 'decision'] },
        title: { type: 'string', minLength: 1 }, caption: { type: 'string', minLength: 1 },
        nodes: { type: 'array', minItems: 2, items: nodeSchema }, edges: { type: 'array', minItems: 1, items: edgeSchema },
      },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['id', 'type', 'title', 'caption', 'category_label', 'series'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9-]+$' }, type: { const: 'bar' },
        title: { type: 'string', minLength: 1 }, caption: { type: 'string', minLength: 1 }, category_label: { type: 'string', minLength: 1 },
        series: {
          type: 'array', minItems: 1,
          items: {
            type: 'object', additionalProperties: false,
            required: ['category', 'financial', 'nonfinancial'],
            properties: { category: { type: 'string', minLength: 1 }, financial: { type: 'number', minimum: 0 }, nonfinancial: { type: 'number', minimum: 0 } },
          },
        },
      },
    },
    {
      type: 'object', additionalProperties: false,
      required: ['id', 'type', 'title', 'caption', 'x_label', 'y_label', 'points'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9-]+$' }, type: { const: 'line' },
        title: { type: 'string', minLength: 1 }, caption: { type: 'string', minLength: 1 },
        x_label: { type: 'string', minLength: 1 }, y_label: { type: 'string', minLength: 1 },
        points: {
          type: 'array', minItems: 2,
          items: {
            type: 'object', additionalProperties: false, required: ['label', 'x', 'y'],
            properties: { label: { type: 'string', minLength: 1 }, x: { type: 'number', minimum: 0 }, y: { type: 'number', minimum: 0 } },
          },
        },
      },
    },
  ],
};

export const ledgerSchema = {
  type: 'object', additionalProperties: false,
  required: ['source_id', 'page', 'chapter', 'unit_id', 'disposition', 'note'],
  properties: {
    source_id: { type: 'string', pattern: '^fm-p[0-9]{2}$' }, page: { type: 'integer', minimum: 1 }, chapter: { type: 'integer', minimum: 1, maximum: 10 },
    unit_id: { type: ['string', 'null'] }, disposition: { enum: ['unit', 'context', 'excluded'] }, note: { type: 'string', minLength: 1 },
  },
};
