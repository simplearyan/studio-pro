import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Fix for __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const OUTPUT_FILE = 'project_context.md';
const MAX_FILE_SIZE_KB = 500; // Skip files larger than 500KB

// Files and folders to completely ignore
const IGNORED_PATHS = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'package-lock.json',
  'yarn.lock',
  OUTPUT_FILE,
  'generate-context.js',
  'generate-context.cjs'
];

// File extensions to skip (binary / non-text files)
const IGNORED_EXTENSIONS = [
  '.ttf', '.woff', '.woff2', '.eot',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.zip', '.pdf', '.exe', '.min.js'
];

function buildDirectoryTree(dirPath, prefix = '') {
  let tree = '';
  const items = fs.readdirSync(dirPath).filter(item => !IGNORED_PATHS.includes(item));

  items.forEach((item, index) => {
    const isLast = index === items.length - 1;
    const itemPath = path.join(dirPath, item);
    const stats = fs.statSync(itemPath);

    tree += `${prefix}${isLast ? '└── ' : '├── '}${item}${stats.isDirectory() ? '/' : ''}\n`;

    if (stats.isDirectory()) {
      tree += buildDirectoryTree(itemPath, `${prefix}${isLast ? '    ' : '│   '}`);
    }
  });

  return tree;
}

function shouldIncludeFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);

  if (IGNORED_PATHS.includes(filename)) return false;
  if (IGNORED_EXTENSIONS.includes(ext)) return false;

  const stats = fs.statSync(filePath);
  if (stats.size > MAX_FILE_SIZE_KB * 1024) return false;

  return true;
}

function appendFileContents(dirPath) {
  let contentMarkdown = '';
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = path.relative(process.cwd(), fullPath);
    const stats = fs.statSync(fullPath);

    if (stats.isDirectory()) {
      if (!IGNORED_PATHS.includes(item)) {
        contentMarkdown += appendFileContents(fullPath);
      }
    } else if (shouldIncludeFile(fullPath)) {
      try {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const ext = path.extname(fullPath).replace('.', '') || 'text';

        contentMarkdown += `### File: \`${relativePath}\`\n\n`;
        contentMarkdown += `\`\`\`${ext}\n${fileContent}\n\`\`\`\n\n`;
        contentMarkdown += `---\n\n`;
      } catch (err) {
        console.warn(`Could not read file ${relativePath}: ${err.message}`);
      }
    }
  }

  return contentMarkdown;
}

function main() {
  console.log('Generating codebase Markdown snapshot...');

  const rootDir = process.cwd();
  
  let markdown = `# Project Codebase Context\n\n`;
  markdown += `*Generated on: ${new Date().toLocaleString()}*\n\n`;

  // 1. Directory Tree
  markdown += `## Directory Structure\n\n\`\`\`\n`;
  markdown += path.basename(rootDir) + '/\n';
  markdown += buildDirectoryTree(rootDir);
  markdown += `\`\`\`\n\n---\n\n`;

  // 2. File Contents
  markdown += `## File Contents\n\n`;
  markdown += appendFileContents(rootDir);

  // Write output
  fs.writeFileSync(path.join(rootDir, OUTPUT_FILE), markdown, 'utf8');
  console.log(`✅ Project context successfully saved to: ${OUTPUT_FILE}`);
}

main();