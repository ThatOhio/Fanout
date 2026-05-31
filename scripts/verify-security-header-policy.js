import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const TARGET_DIRECTORIES = ['entrypoints', 'src', 'public'];
const TARGET_FILES = ['wxt.config.ts', 'wxt.config.js', 'manifest.json'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

const HEADER_POLICY_PATTERNS = [
  {
    pattern: 'webRequest.onHeadersReceived',
    test: (content) => /webRequest\.onHeadersReceived/i.test(content),
    message: 'Detected global response header interception hook.',
  },
  {
    pattern: 'declarativeNetRequest header modification',
    test: (content) =>
      /declarativeNetRequest/i.test(content) &&
      /(?:modifyHeaders|responseHeaders|header\s*:\s*['"]?(?:content-security-policy|strict-transport-security))/i.test(
        content,
      ),
    message: 'Detected declarativeNetRequest header modification.',
  },
  {
    pattern: 'content-security-policy tampering',
    test: (content) =>
      /(?:filter|remove|delete|strip|modify|splice)\s*\([^)]*content-security-policy/i.test(content) ||
      /(?:filter|remove|delete|strip|modify|splice)\s*\([^)]*['"]content-security-policy['"]/i.test(content) ||
      /\.name\s*!==?\s*['"]content-security-policy['"]/i.test(content),
    message: 'Detected content-security-policy modification pattern.',
  },
  {
    pattern: 'strict-transport-security tampering',
    test: (content) =>
      /(?:filter|remove|delete|strip|modify|splice)\s*\([^)]*strict-transport-security/i.test(content) ||
      /(?:filter|remove|delete|strip|modify|splice)\s*\([^)]*['"]strict-transport-security['"]/i.test(content) ||
      /\.name\s*!==?\s*['"]strict-transport-security['"]/i.test(content),
    message: 'Detected strict-transport-security modification pattern.',
  },
];

function hasAllowedExtension(filePath) {
  for (const extension of FILE_EXTENSIONS) {
    if (filePath.endsWith(extension)) {
      return true;
    }
  }
  return false;
}

function collectFilesFromDirectory(directory) {
  const absoluteDirectory = resolve(ROOT, directory);
  const files = [];

  let entries;
  try {
    entries = readdirSync(absoluteDirectory);
  } catch {
    return files;
  }

  for (const entry of entries) {
    const absolutePath = join(absoluteDirectory, entry);

    let stats;
    try {
      stats = statSync(absolutePath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      files.push(...collectFilesFromDirectory(relative(ROOT, absolutePath)));
      continue;
    }

    if (hasAllowedExtension(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function collectProjectRecords() {
  const files = [
    ...TARGET_DIRECTORIES.flatMap((directory) => collectFilesFromDirectory(directory)),
    ...TARGET_FILES.map((file) => resolve(ROOT, file)),
  ];

  const uniqueFiles = [...new Set(files)];
  const records = [];

  for (const file of uniqueFiles) {
    try {
      const content = readFileSync(file, 'utf8');
      records.push({ path: relative(ROOT, file), content });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
  }

  return records;
}

export function findSecurityHeaderPolicyViolations(records) {
  const violations = [];

  for (const record of records) {
    for (const definition of HEADER_POLICY_PATTERNS) {
      if (definition.test(record.content)) {
        violations.push({
          path: record.path,
          pattern: definition.pattern,
          message: definition.message,
        });
      }
    }
  }

  return violations;
}

function run() {
  const records = collectProjectRecords();

  if (records.length === 0) {
    console.error('Security-header policy check failed: no scannable project files found.');
    process.exitCode = 1;
    return;
  }

  const violations = findSecurityHeaderPolicyViolations(records);

  if (violations.length > 0) {
    console.error('Security-header policy check failed:');
    for (const violation of violations) {
      console.error(`- ${violation.path}: ${violation.message} (${violation.pattern})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Security-header policy check passed.');
}

const isExecutedAsScript = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedAsScript) {
  run();
}
