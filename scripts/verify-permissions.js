import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const TARGET_DIRECTORIES = ['entrypoints', 'src', 'public'];
const TARGET_FILES = ['wxt.config.ts', 'wxt.config.js', 'manifest.json'];
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);

const BROAD_PERMISSION_PATTERNS = [
  { pattern: '<all_urls>', regex: /<all_urls>/i, message: 'Detected unrestricted <all_urls> scope.' },
  { pattern: '*://*/*', regex: /\*:\/\/\*\/\*/i, message: 'Detected full wildcard protocol+host scope.' },
  { pattern: 'http://*/*', regex: /http:\/\/\*\/\*/i, message: 'Detected broad http wildcard host scope.' },
  { pattern: 'https://*/*', regex: /https:\/\/\*\/\*/i, message: 'Detected broad https wildcard host scope.' },
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

export function findBroadPermissionViolations(records) {
  const violations = [];

  for (const record of records) {
    for (const definition of BROAD_PERMISSION_PATTERNS) {
      if (definition.regex.test(record.content)) {
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

/**
 * Checks that every permission declared in wxt.config.ts has a corresponding
 * section in the permission rationale document.
 *
 * @param {string} wxtConfigContent - Content of wxt.config.ts
 * @param {string} rationaleDocContent - Content of permissions-rationale.md
 * @returns {Array<{ permission: string; message: string }>}
 */
export function findUnmappedPermissions(wxtConfigContent, rationaleDocContent) {
  const permissionsMatch = wxtConfigContent.match(/permissions:\s*\[([^\]]*)\]/);
  if (!permissionsMatch) {
    return [];
  }

  const declaredPermissions = [...permissionsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(
    (m) => m[1],
  );

  const approvedPermissions = new Set(
    [...rationaleDocContent.matchAll(/^## (\w+)/gm)].map((m) => m[1]),
  );

  return declaredPermissions
    .filter((permission) => !approvedPermissions.has(permission))
    .map((permission) => ({
      permission,
      message: `Permission '${permission}' declared in manifest has no entry in permissions-rationale.md.`,
    }));
}

function run() {
  const records = collectProjectRecords();

  if (records.length === 0) {
    console.error('Permission policy check failed: no scannable project files found.');
    process.exitCode = 1;
    return;
  }

  const violations = findBroadPermissionViolations(records);

  if (violations.length > 0) {
    console.error('Permission policy check failed:');
    for (const violation of violations) {
      console.error(`- ${violation.path}: ${violation.message} (${violation.pattern})`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Permission policy check passed.');

  const rationaleDocPath = join(ROOT, 'permissions-rationale.md');
  let rationaleDocContent;
  try {
    rationaleDocContent = readFileSync(rationaleDocPath, 'utf8');
  } catch {
    console.error(
      'Permission rationale check failed: permissions-rationale.md not found.',
    );
    process.exitCode = 1;
    return;
  }

  const wxtConfigRecord = records.find((r) => r.path === 'wxt.config.ts');
  const wxtConfigContent = wxtConfigRecord?.content ?? '';
  const unmappedViolations = findUnmappedPermissions(wxtConfigContent, rationaleDocContent);

  if (unmappedViolations.length > 0) {
    console.error('Permission rationale check failed:');
    for (const violation of unmappedViolations) {
      console.error(`- ${violation.message}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Permission rationale check passed.');
}

const isExecutedAsScript = process.argv[1] === fileURLToPath(import.meta.url);
if (isExecutedAsScript) {
  run();
}
