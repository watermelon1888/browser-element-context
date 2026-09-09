#!/usr/bin/env node

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = { workspace: process.cwd(), workspaceStorage: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--workspace') {
      args.workspace = argv[++index];
    } else if (arg === '--workspace-storage') {
      args.workspaceStorage = argv[++index];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.workspace) throw new Error('--workspace requires a path.');
  if (argv.includes('--workspace-storage') && !args.workspaceStorage) {
    throw new Error('--workspace-storage requires a path.');
  }

  return args;
}

function defaultStorageRoots() {
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA;
    if (!appData) return [];
    return ['Code', 'Code - Insiders'].map((product) =>
      path.join(appData, product, 'User', 'workspaceStorage'),
    );
  }

  if (process.platform === 'darwin') {
    return ['Code', 'Code - Insiders'].map((product) =>
      path.join(
        os.homedir(),
        'Library',
        'Application Support',
        product,
        'User',
        'workspaceStorage',
      ),
    );
  }

  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return ['Code', 'Code - Insiders'].map((product) =>
    path.join(configHome, product, 'User', 'workspaceStorage'),
  );
}

function normalizeFilePath(filePath) {
  const normalized = path.resolve(filePath).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function pathFromWorkspaceUri(uri) {
  if (typeof uri !== 'string' || !uri.startsWith('file:')) return undefined;
  try {
    return fileURLToPath(uri);
  } catch {
    return undefined;
  }
}

function workspaceMatchScore(target, candidate) {
  const normalizedTarget = normalizeFilePath(target);
  const normalizedCandidate = normalizeFilePath(candidate);
  if (normalizedTarget === normalizedCandidate) return normalizedCandidate.length + 1;

  const relative = path.relative(normalizedCandidate, normalizedTarget);
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return normalizedCandidate.length;
  }

  return -1;
}

async function existingDirectories(paths) {
  const results = [];
  for (const candidate of paths) {
    try {
      if ((await fs.stat(candidate)).isDirectory()) results.push(candidate);
    } catch {
      // Try the next standard location.
    }
  }
  return results;
}

async function findWorkspaceStorage(workspace, roots) {
  let bestMatch;

  for (const root of roots) {
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const storagePath = path.join(root, entry.name);
      try {
        const metadata = JSON.parse(
          await fs.readFile(path.join(storagePath, 'workspace.json'), 'utf8'),
        );
        const candidates = [metadata.folder, metadata.workspace]
          .map(pathFromWorkspaceUri)
          .filter(Boolean);

        for (const candidate of candidates) {
          const score = workspaceMatchScore(workspace, candidate);
          if (score >= 0 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = { storagePath, score };
          }
        }
      } catch {
        // Ignore unrelated or unreadable workspace entries.
      }
    }
  }

  if (!bestMatch) {
    throw new Error(
      `Could not find VS Code workspace storage for: ${path.resolve(workspace)}`,
    );
  }

  return bestMatch.storagePath;
}

function readElementAttachments(jsonl) {
  let attachments = [];

  for (const rawLine of jsonl.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line) continue;

    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    if (record.kind === 0) {
      attachments = Array.isArray(record.v?.inputState?.attachments)
        ? record.v.inputState.attachments
        : [];
    } else if (
      record.kind === 1 &&
      Array.isArray(record.k) &&
      record.k.join('/') === 'inputState/attachments'
    ) {
      attachments = Array.isArray(record.v) ? record.v : [];
    }
  }

  return attachments.filter(
    (attachment) =>
      attachment?.kind === 'element' ||
      (typeof attachment?.id === 'string' && attachment.id.startsWith('element-')),
  );
}

async function latestSessionFile(workspaceStorage) {
  const chatSessions = path.join(workspaceStorage, 'chatSessions');
  const entries = await fs.readdir(chatSessions, { withFileTypes: true });
  const candidates = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map(async (entry) => {
        const filePath = path.join(chatSessions, entry.name);
        return { filePath, modified: (await fs.stat(filePath)).mtimeMs };
      }),
  );

  candidates.sort((a, b) => b.modified - a.modified);
  if (!candidates[0]) throw new Error('No VS Code Chat session was found.');
  return candidates[0].filePath;
}

function renderContext(elements) {
  const sections = elements.map((element, index) => {
    const name = element.fullName || element.name || element.id || `Element ${index + 1}`;
    const value = typeof element.value === 'string' ? element.value.trim() : '';
    return `## ${index + 1}. ${name}\n\n${value}`;
  });

  return [
    '# Browser Element Context',
    '',
    'Selected from VS Code Integrated Browser.',
    '',
    ...sections,
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const roots = args.workspaceStorage
    ? [path.resolve(args.workspaceStorage)]
    : await existingDirectories(defaultStorageRoots());

  if (roots.length === 0) {
    throw new Error(
      'No standard VS Code workspaceStorage directory was found. Use --workspace-storage for a custom user-data directory.',
    );
  }

  const workspaceStorage = await findWorkspaceStorage(args.workspace, roots);
  const sessionFile = await latestSessionFile(workspaceStorage);
  const elements = readElementAttachments(await fs.readFile(sessionFile, 'utf8'));

  if (elements.length === 0) {
    throw new Error(
      'No browser elements are attached to the current VS Code Chat input.',
    );
  }

  process.stdout.write(`${renderContext(elements)}\n`);
}

const isMain = process.argv[1]
  ? import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
  : false;

if (isMain) {
  main().catch((error) => {
    process.stderr.write(`browser-element: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export {
  defaultStorageRoots,
  findWorkspaceStorage,
  readElementAttachments,
  renderContext,
  workspaceMatchScore,
};
