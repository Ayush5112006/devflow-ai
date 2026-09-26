/**
 * Extraction patterns. Everything here is deliberately conservative: a false
 * positive costs confidence, and the root-cause engine weighs evidence.
 */

export const ROUTE_PATTERNS: { framework: string; re: RegExp }[] = [
  // Any object literal method that takes a path-shaped first argument.
  // Requiring the path to start with `/` keeps `response.json(...)` out.
  { framework: 'router', re: /\b([A-Za-z_$][\w$]*)\s*\.\s*(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"`])(\/[^'"`\s]*)\3/g },
  // Next.js App Router / Pages Router handlers
  { framework: 'next', re: /export\s+default\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(/g },
];

/** Imports that identify the web framework behind a router. */
export const FRAMEWORK_IMPORTS: { name: string; re: RegExp }[] = [
  { name: 'express', re: /from\s+['"]express['"]|require\(['"]express['"]\)/ },
  { name: 'fastify', re: /from\s+['"]fastify['"]|require\(['"]fastify['"]\)/ },
  { name: 'koa', re: /from\s+['"]koa['"]|require\(['"]koa['"]\)/ },
  { name: 'hono', re: /from\s+['"]hono['"]|require\(['"]hono['"]\)/ },
  { name: 'next', re: /from\s+['"]next\/|require\(['"]next\// },
  { name: 'node:http', re: /from\s+['"]node:http['"]|require\(['"]node:http['"]\)/ },
];

export const CLIENT_CALL_PATTERNS: { client: string; re: RegExp }[] = [
  { client: 'fetch', re: /\bfetch\s*\(/g },
  { client: 'axios', re: /\b(?:axios|http|apiClient|client)\s*\.\s*(get|post|put|patch|delete)\s*\(/g },
  { client: 'superagent', re: /\brequest\s*\.\s*(get|post|put|patch|delete)\s*\(/g },
  { client: 'ky', re: /\bky\s*\.\s*(get|post|put|patch|delete)\s*\(/g },
];

/** `res.json(...)`, `res.send(...)`, `reply.send(...)`, `return {...}` */
export const RESPONSE_SINK = /\b(?:res|reply|response|ctx\.body)\s*\.\s*(json|send|end)\s*\(|^\s*return\s*\{/gm;

export const ENV_ACCESS_PATTERNS = [
  /process\.env\.([A-Z][A-Z0-9_]*)/g,
  /process\.env\[['"]([A-Z][A-Z0-9_]*)['"]\]/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]*)/g,
  /Deno\.env\.get\(['"]([A-Z][A-Z0-9_]*)['"]\)/g,
];

export const ENV_DECL_PATTERN = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/;

export const CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["'`\[]?(\w+)["'`\]]?\s*\(([\s\S]*?)\)\s*;/gi;

export const SQL_STATEMENT = /\b(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+([\s\S]{0,400}?)(?=\bFROM\b|\bSET\b|\bINTO\b|["'`;]|$)/gi;

export const PREPARED_SQL = /\b(?:prepare|query|exec|raw|execute|all|get|run)\s*\(\s*(['"`])((?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER)[\s\S]*?)\1/gi;

export const MONGOOSE_FIELD = /^\s*(\w+)\s*:\s*\{\s*type\s*:\s*(\w+)/gm;
export const SEQUELIZE_FIELD = /^\s*(\w+)\s*:\s*\{\s*type\s*:\s*DataTypes\.(\w+)/gm;
export const PRISMA_FIELD = /^\s+(\w+)\s+(String|Int|Float|Boolean|DateTime|Json|BigInt|Bytes)\b/gm;

export const FUNCTION_PATTERNS = [
  /(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g,
  /(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g,
  /(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  /(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/gm,
];

export const CLASS_METHOD = /^\s{2,}(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/gm;

export const TEST_PATTERNS = [
  /\b(?:it|test)\s*\(\s*(['"`])([^'"`]+)\1/g,
  /\bdescribe\s*\(\s*(['"`])([^'"`]+)\1/g,
];

export const IMPORT_FROM = /^\s*import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/gm;
export const REQUIRE_CALL = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** `TypeError: Cannot read properties of undefined (reading 'prediction')` */
export const RUNTIME_ERROR_PATTERNS: { re: RegExp; kind: string; capture: (m: RegExpMatchArray) => Record<string, string> }[] = [
  {
    re: /TypeError:\s*Cannot read (?:property|properties) (?:of )?(\w+|undefined|null)(?: \(reading '([^']+)'\))?/,
    kind: 'null-property-access',
    capture: (m) => ({ object: m[1] ?? '', property: m[2] ?? '' }),
  },
  {
    re: /TypeError:\s*(\w+)\s+is not (?:a function|iterable|defined)/,
    kind: 'not-a-function',
    capture: (m) => ({ symbol: m[1] ?? '' }),
  },
  {
    re: /TypeError:\s*Cannot set (?:property|properties) of (?:undefined|null)/,
    kind: 'set-on-null',
    capture: () => ({}),
  },
  {
    re: /(\w*Error):\s*(.+)/,
    kind: 'generic-error',
    capture: (m) => ({ errorName: m[1] ?? '', message: (m[2] ?? '').trim() }),
  },
];

export const STACK_FRAME = /at\s+(?:async\s+)?(?:([A-Za-z_$][\w$.<>\[\]]*)\s+\()?([^\s(]+):(\d+):(\d+)\)?/g;

export const HTTP_LINE = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s+(\d{3})\b/;
export const HTTP_ERROR_LINE = /\b(4\d\d|5\d\d)\b\s*[|>]?\s*(.*)$/;

/** Common-language normalisation for "is this a different name for the same thing". */
export const SEMANTIC_GROUPS: string[][] = [
  ['prediction', 'label', 'class', 'category', 'output', 'result', 'answer', 'score', 'value'],
  ['user', 'account', 'member', 'customer', 'person', 'profile', 'owner', 'auth'],
  ['name', 'title', 'displayname', 'fullname', 'username', 'label', 'text'],
  ['email', 'mail', 'emailaddress', 'contact'],
  ['id', 'identifier', 'key', 'uuid', 'guid', 'pk', 'ref'],
  ['price', 'cost', 'amount', 'total', 'value', 'charge'],
  ['createdat', 'created', 'timestamp', 'date', 'time', 'datetime'],
  ['status', 'state', 'stage', 'phase'],
  ['count', 'total', 'num', 'number', 'quantity', 'length'],
  ['message', 'msg', 'error', 'detail', 'description', 'reason'],
  ['url', 'uri', 'link', 'href', 'endpoint', 'baseurl', 'apibase'],
  ['token', 'key', 'secret', 'apikey', 'auth', 'session'],
  ['item', 'product', 'record', 'row', 'entity', 'entry'],
  ['order', 'booking', 'purchase', 'cart'],
  ['location', 'city', 'country', 'address', 'region', 'place'],
];

export const STOPWORDS = new Set([
  'console', 'window', 'document', 'globalThis', 'process', 'json', 'string', 'number',
  'boolean', 'object', 'array', 'math', 'date', 'promise', 'map', 'set', 'error',
  'this', 'self', 'module', 'exports', 'require', 'undefined', 'null', 'true', 'false',
  'length', 'prototype', 'constructor', 'toString', 'valueOf', 'name', 'message',
]);

export const FRAMEWORK_SIGNATURES: { name: string; deps: string[]; files?: RegExp }[] = [
  { name: 'React', deps: ['react'], files: /\.jsx?$/ },
  { name: 'Next.js', deps: ['next'] },
  { name: 'Vue', deps: ['vue'] },
  { name: 'Angular', deps: ['@angular/core'] },
  { name: 'Svelte', deps: ['svelte'] },
  { name: 'Express', deps: ['express'] },
  { name: 'Fastify', deps: ['fastify'] },
  { name: 'Koa', deps: ['koa'] },
  { name: 'Hapi', deps: ['@hapi/hapi'] },
  { name: 'NestJS', deps: ['@nestjs/core'] },
  { name: 'Hono', deps: ['hono'] },
  { name: 'Mongoose', deps: ['mongoose'] },
  { name: 'Prisma', deps: ['prisma', '@prisma/client'] },
  { name: 'Sequelize', deps: ['sequelize'] },
  { name: 'TypeORM', deps: ['typeorm'] },
  { name: 'Knex', deps: ['knex'] },
  { name: 'better-sqlite3', deps: ['better-sqlite3'] },
  { name: 'node:sqlite', deps: [], files: /node:sqlite/ },
  { name: 'pg', deps: ['pg'] },
  { name: 'mysql2', deps: ['mysql2'] },
  { name: 'Vitest', deps: ['vitest'] },
  { name: 'Jest', deps: ['jest'] },
  { name: 'node:test', deps: [], files: /from ['"]node:test['"]|require\(['"]node:test['"]\)/ },
  { name: 'Vite', deps: ['vite'] },
  { name: 'Tailwind CSS', deps: ['tailwindcss'] },
  { name: 'Zod', deps: ['zod'] },
  { name: 'Jest/Supertest', deps: ['supertest'] },
];
