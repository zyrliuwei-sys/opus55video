#!/usr/bin/env node
/**
 * EvoLink admin-settings integration installer for ShipAny (TanStack) projects.
 *
 * Adds an "EvoLink" card to /admin/settings → AI tab (Base URL + API Key + Test).
 *
 * Usage:
 *   node integrations/evolink/install.mjs [path/to/target-project]
 *
 * - Defaults to the current working directory.
 * - Backs up every file it touches to <target>/.evolink-backup/<timestamp>/.
 * - Idempotent: files that already mention evolink are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';

const target = path.resolve(process.argv[2] || process.cwd());
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDir = path.join(target, '.evolink-backup', stamp);

const FILES = {
  settings: 'src/modules/config/settings.ts',
  specs: 'src/modules/config/settings-test-specs.ts',
  runner: 'src/modules/config/settings-test.ts',
  en: 'messages/en.json',
  zh: 'messages/zh.json',
};

// ─── Snippets ────────────────────────────────────────────────────────────

const GROUP_SNIPPET = `    {
      name: 'evolink',
      title: 'EvoLink',
      description: 'EvoLink AI gateway (OpenAI-compatible)',
      tab: 'ai',
    },
`;

const FIELDS_SNIPPET = `
    // ─── AI / EvoLink ────────────────────────────────────────────────
    {
      name: 'evolink_base_url',
      title: 'Base URL',
      type: 'text',
      placeholder: 'https://direct.evolink.ai/v1',
      group: 'evolink',
      tab: 'ai',
    },
    {
      name: 'evolink_api_key',
      title: 'API Key',
      type: 'password',
      placeholder: 'sk-xxx',
      group: 'evolink',
      tab: 'ai',
    },
`;

const SPEC_SNIPPET = `  evolink: {
    group: 'evolink',
    fields: [],
  },
`;

const CASE_SNIPPET = `      case 'evolink':
        return await testEvolink(inputs, configs);
`;

const RUNNER_SNIPPET = `
// --- EvoLink --------------------------------------------------------------

async function testEvolink(
  _inputs: Record<string, string>,
  configs: Record<string, string>
): Promise<TestResult> {
  const missing = need(configs, ['evolink_api_key']);
  if (missing) return { success: false, message: missing };

  // Listing models is free and proves the key is valid.
  const baseUrl = (
    configs.evolink_base_url || 'https://direct.evolink.ai/v1'
  ).replace(/\\/+$/, '');
  const resp = await fetch(\`\${baseUrl}/models\`, {
    headers: { Authorization: \`Bearer \${configs.evolink_api_key}\` },
  });

  const data: any = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return {
      success: false,
      message: data?.error?.message || \`Request failed (\${resp.status})\`,
    };
  }

  const models = Array.isArray(data?.data) ? data.data : [];
  return {
    success: true,
    message: 'EvoLink accepted the API key',
    details: {
      'Base URL': baseUrl,
      Models: String(models.length),
      Sample: models
        .slice(0, 5)
        .map((m: any) => m?.id)
        .filter(Boolean)
        .join(', '),
    },
  };
}
`;

const MESSAGES = {
  en: {
    after: 'admin.settings.groups.fal.description',
    groups: {
      'admin.settings.groups.evolink.title': 'EvoLink',
      'admin.settings.groups.evolink.description':
        'EvoLink AI gateway (OpenAI-compatible)',
    },
    fieldsAfter: 'admin.settings.fields.fal_api_key',
    fields: {
      'admin.settings.fields.evolink_base_url': 'Base URL',
      'admin.settings.fields.evolink_api_key': 'API Key',
    },
  },
  zh: {
    after: 'admin.settings.groups.fal.description',
    groups: {
      'admin.settings.groups.evolink.title': 'EvoLink',
      'admin.settings.groups.evolink.description':
        'EvoLink AI 聚合网关（兼容 OpenAI）',
    },
    fieldsAfter: 'admin.settings.fields.fal_api_key',
    fields: {
      'admin.settings.fields.evolink_base_url': 'Base URL',
      'admin.settings.fields.evolink_api_key': 'API 密钥',
    },
  },
};

// ─── Helpers ─────────────────────────────────────────────────────────────

const results = [];
const pending = [];

function read(rel) {
  const file = path.join(target, rel);
  if (!fs.existsSync(file)) throw new Error(`Missing file: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

function write(rel, original, next) {
  const backup = path.join(backupDir, rel);
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  fs.writeFileSync(backup, original);
  fs.writeFileSync(path.join(target, rel), next);
}

/** Insert `snippet` right after the first match of `anchor`. */
function insertAfter(src, anchor, snippet, label) {
  const match = src.match(anchor);
  if (!match) throw new Error(`Anchor not found (${label})`);
  const at = match.index + match[0].length;
  return src.slice(0, at) + snippet + src.slice(at);
}

/** Rebuild an object inserting `extra` after key `after` (or at the end). */
function insertKeys(obj, after, extra) {
  if (!(after in obj)) return { ...obj, ...extra };
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = v;
    if (k === after) Object.assign(out, extra);
  }
  return out;
}

function patch(rel, fn) {
  const src = read(rel);
  if (/evolink/i.test(src)) {
    results.push(`skipped  ${rel} (already has evolink)`);
    return;
  }
  // Compute everything first; nothing is written until all anchors match.
  pending.push({ rel, src, next: fn(src) });
  results.push(`patched  ${rel}`);
}

// ─── Patch ───────────────────────────────────────────────────────────────

try {
  // Fail fast before touching anything.
  for (const rel of Object.values(FILES)) read(rel);

  patch(FILES.settings, (src) => {
    // Group card: after the Fal group entry (single- or multi-line).
    let next = insertAfter(
      src,
      /\{\s*name: 'fal',[^{}]*?tab: 'ai',?\s*\},?\n/,
      GROUP_SNIPPET,
      'fal group'
    );
    // Fields: after the fal_api_key field.
    next = insertAfter(
      next,
      /\{\s*name: 'fal_api_key',[^{}]*\},?\n/,
      FIELDS_SNIPPET,
      'fal_api_key field'
    );
    return next;
  });

  patch(FILES.specs, (src) =>
    insertAfter(
      src,
      /\n(?=\};\s*\n\s*export function getTestSpec)/,
      SPEC_SNIPPET,
      'end of testSpecs'
    )
  );

  patch(FILES.runner, (src) => {
    const next = insertAfter(
      src,
      /case 'fal':\s*\n\s*return await testFal\(inputs, configs\);\n/,
      CASE_SNIPPET,
      "case 'fal'"
    );
    return next.replace(/\s*$/, '\n') + RUNNER_SNIPPET;
  });

  for (const lang of ['en', 'zh']) {
    patch(FILES[lang], (src) => {
      const cfg = MESSAGES[lang];
      let obj = JSON.parse(src);
      obj = insertKeys(obj, cfg.after, cfg.groups);
      obj = insertKeys(obj, cfg.fieldsAfter, cfg.fields);
      return JSON.stringify(obj, null, 2) + '\n';
    });
  }

  for (const { rel, src, next } of pending) write(rel, src, next);

  console.log(`EvoLink integration → ${target}\n`);
  console.log(results.map((r) => '  ' + r).join('\n'));
  if (results.some((r) => r.startsWith('patched'))) {
    console.log(`\nBackups: ${path.relative(target, backupDir)}/`);
  }
  console.log('\nNext: pnpm build, then fill the key at /admin/settings → AI.');
} catch (err) {
  console.error(`\n✗ ${err.message}\nNo files were changed.`);
  process.exit(1);
}
