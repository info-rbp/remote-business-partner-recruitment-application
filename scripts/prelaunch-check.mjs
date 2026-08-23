#!/usr/bin/env node
// Pre-launch validation script (spec item 58).
// Run with: npm run prelaunch
//
// Fails (non-zero exit code) if it detects any of the forbidden patterns
// below in tracked source files. This is a deliberately blunt, dependency-
// free grep-style check — it is not a substitute for the acceptance tests
// in spec items 62-67, which must be run against a real deployed instance.

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

// Directories that must never be scanned (build output, deps, vcs).
const IGNORE_DIRS = new Set(['.git', 'node_modules', 'dist', 'build', '.wrangler', 'tmp']);

// File extensions worth scanning as "source".
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.html', '.css', '.json', '.sql', '.md', '.txt']);

// Hard failure patterns — any match anywhere in a tracked source file fails the build.
const FORBIDDEN_PATTERNS = [
  { name: 'GenSpark Table API path', pattern: /\btables\/(vacancies|applications|recruitment_requests|candidate_interest)\b/g },
  { name: 'TABLES_BASE constant', pattern: /\bTABLES_BASE\b/g },
  { name: 'Legacy table helper call', pattern: /\b(fetchTable|createRecord|updateRecord|deleteRecord)\s*\(/g },
  { name: 'Base64 CV storage column', pattern: /\bresume_data\b/g },
  { name: 'Placeholder phone number', pattern: /1300\s*000\s*000/g },
  { name: 'Placeholder policy warning text', pattern: /placeholder\s+polic(y|ies)/gi },
  { name: 'example.com domain', pattern: /example\.com/gi },
  { name: 'PEM private key material', pattern: /BEGIN PRIVATE KEY/g },
  { name: 'Firebase service account file reference', pattern: /serviceAccount\.json/g }
];

const SECRET_ASSIGNMENT_PATTERNS = [
  { name: 'TURNSTILE_SECRET_KEY assignment', pattern: /TURNSTILE_SECRET_KEY\s*[:=]\s*['"][^'"]+['"]/g },
  { name: 'CLOUDFLARE_EMAIL_API_TOKEN assignment', pattern: /CLOUDFLARE_EMAIL_API_TOKEN\s*[:=]\s*['"][^'"]+['"]/g },
  { name: 'CLOUDFLARE_API_TOKEN assignment', pattern: /CLOUDFLARE_API_TOKEN\s*[:=]\s*['"][^'"]+['"]/g },
  { name: 'GOOGLE_CLIENT_SECRET assignment', pattern: /GOOGLE_CLIENT_SECRET\s*[:=]\s*['"][^'"]+['"]/g },
  { name: 'private_key assignment', pattern: /private_key\s*[:=]\s*['"][^'"]+['"]/g }
];

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (IGNORE_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function main() {
  const allFiles = walk(ROOT).filter((f) => {
    const ext = '.' + f.split('.').pop();
    return SOURCE_EXTENSIONS.has(ext);
  });

  const failures = [];

  for (const file of allFiles) {
    if (file.endsWith('scripts/prelaunch-check.mjs'.replace('/', join(''))) || file.includes('prelaunch-check.mjs')) continue;
    if (file.includes('PRELAUNCH_BLOCKERS.md') || file.includes('DEPLOYMENT.md')) continue;

    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    for (const { name, pattern } of FORBIDDEN_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = content.match(pattern);
      if (matches) {
        failures.push(`[${name}] ${relative(ROOT, file)} — ${matches.length} match(es)`);
      }
    }
    for (const { name, pattern } of SECRET_ASSIGNMENT_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = content.match(pattern);
      if (matches) {
        failures.push(`[POSSIBLE SECRET] ${name} in ${relative(ROOT, file)} — remove and use a Cloudflare Pages secret instead`);
      }
    }
  }

  if (failures.length > 0) {
    console.error('\n❌ Pre-launch check FAILED. The following issues must be resolved before deployment:\n');
    for (const f of failures) console.error('  - ' + f);
    console.error(`\n${failures.length} issue(s) found.\n`);
    process.exit(1);
  }

  console.log('✅ Pre-launch check passed — no forbidden patterns detected.');
  console.log('Reminder: this script only checks for known-bad strings. It does NOT replace');
  console.log('the acceptance tests in the specification (auth, public vacancy security,');
  console.log('application security, CV security, public form tests, and the full admin');
  console.log('end-to-end sequence). Run those against a real deployed instance before');
  console.log('declaring production readiness.');
}

main();
