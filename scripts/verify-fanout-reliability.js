import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const TARGET_DIRECTORIES = ['entrypoints', 'src'];
const TARGET_FILES = ['package.json'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const FANOUT_RELIABILITY_CHECKS = [
  {
    name: 'COLUMN_DISPATCH_TIMEOUT_MS',
    test: (records) => records.some((record) => /COLUMN_DISPATCH_TIMEOUT_MS\s*=\s*\d/.test(record.content)),
    message: 'COLUMN_DISPATCH_TIMEOUT_MS is missing. Keep the timeout-based failure detector in the fanout workspace.',
  },
  {
    name: 'resolveColumnDispatch',
    test: (records) => records.some((record) => /resolveColumnDispatch/.test(record.content)),
    message: 'resolveColumnDispatch is missing. Keep the per-column isolation state update in place.',
  },
  {
    name: 'retryColumnDispatch',
    test: (records) => records.some((record) => /retryColumnDispatch/.test(record.content)),
    message: 'retryColumnDispatch is missing. Keep the per-column recovery action in place.',
  },
  {
    name: 'role="alert"',
    test: (records) => records.some((record) => /role=["']alert["']/.test(record.content)),
    message: 'role="alert" error UI is missing. Failed providers need a visible column-level error state.',
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

export function findFanoutReliabilityViolations(records) {
  return FANOUT_RELIABILITY_CHECKS.filter((definition) => !definition.test(records)).map((definition) => ({
    path: 'fanout reliability policy',
    message: definition.message,
  }));
}

function run() {
  const records = collectProjectRecords();

  if (records.length === 0) {
    console.error('Fanout reliability check failed: no scannable project files found.');
    process.exit(1);
  }

  const violations = findFanoutReliabilityViolations(records);

  if (violations.length > 0) {
    console.error('Fanout reliability check failed:');
    for (const violation of violations) {
      console.error(`- ${violation.path}: ${violation.message}`);
    }
    process.exit(1);
  }

  console.log('Fanout reliability check passed.');
}

const isExecutedAsScript = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedAsScript) {
  run();
}
