import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const FILE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const TARGET_DIRS = ['entrypoints', 'src', 'tests', 'scripts'];

function hasAllowedExtension(filePath) {
  for (const ext of FILE_EXTENSIONS) {
    if (filePath.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

function collectFiles(directory) {
  const absoluteDirectory = resolve(ROOT, directory);
  const files = [];

  let entries = [];
  try {
    entries = readdirSync(absoluteDirectory);
  } catch {
    return files;
  }

  for (const entry of entries) {
    const absolutePath = join(absoluteDirectory, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...collectFiles(relative(ROOT, absolutePath)));
      continue;
    }

    if (hasAllowedExtension(absolutePath)) {
      files.push(absolutePath);
    }
  }

  return files;
}

function lintFile(filePath) {
  const content = readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const issues = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineNumber = index + 1;

    if (line.includes('\t')) {
      issues.push(`${relative(ROOT, filePath)}:${lineNumber} contains a tab character`);
    }

    if (/\s+$/.test(line)) {
      issues.push(`${relative(ROOT, filePath)}:${lineNumber} has trailing whitespace`);
    }
  }

  return issues;
}

const allFiles = TARGET_DIRS.flatMap((directory) => collectFiles(directory));
const lintIssues = allFiles.flatMap((filePath) => lintFile(filePath));

if (lintIssues.length > 0) {
  console.error('Lint failed. Resolve the following issues:');
  for (const issue of lintIssues) {
    console.error(`- ${issue}`);
  }
  process.exitCode = 1;
} else {
  console.log(`Lint passed (${allFiles.length} files checked).`);
}
