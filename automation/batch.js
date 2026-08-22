#!/usr/bin/env node

/**
 * Studio Pro — Batch Render Script
 *
 * Renders all markdown/JSON scripts in a folder to videos.
 *
 * Usage:
 *   node batch.js <input-dir> [options]
 *
 * Examples:
 *   node batch.js scripts/
 *   node batch.js scripts/ -o output/ --resolution 720p
 *   node batch.js scripts/ --parallel 2 --quality standard
 */

import { readdir } from 'fs/promises';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    inputDir: null,
    outputDir: './output',
    resolution: '1080p',
    fps: 30,
    format: 'mp4',
    quality: 'high',
    template: null,
    parallel: 1,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '-o': case '--output':
        result.outputDir = args[++i];
        break;
      case '-r': case '--resolution':
        result.resolution = args[++i];
        break;
      case '--fps':
        result.fps = parseInt(args[++i], 10);
        break;
      case '-f': case '--format':
        result.format = args[++i];
        break;
      case '-q': case '--quality':
        result.quality = args[++i];
        break;
      case '-t': case '--template':
        result.template = args[++i];
        break;
      case '--parallel':
        result.parallel = parseInt(args[++i], 10);
        break;
      case '-h': case '--help':
        result.help = true;
        break;
      default:
        if (!arg.startsWith('-') && !result.inputDir) {
          result.inputDir = arg;
        }
    }
  }

  return result;
}

function showHelp() {
  console.log(`
Studio Pro — Batch Render

Usage:
  node batch.js <input-dir> [options]

Options:
  -o, --output <dir>        Output directory (default: ./output)
  -r, --resolution <res>    Resolution: 720p, 1080p, 1440p, 2160p
  --fps <num>               Frame rate: 12, 24, 30, 60
  -f, --format <fmt>        Format: mp4, webm
  -q, --quality <preset>    Quality: draft, standard, high, ultra
  -t, --template <id>       Apply design template to all scripts
  --parallel <num>          Parallel renders (default: 1)
  -h, --help                Show this help

Examples:
  node batch.js scripts/
  node batch.js scripts/ -o output/ --quality standard
  node batch.js scripts/ --parallel 2 --resolution 720p
  `);
}

async function batch(inputDir, options) {
  const {
    outputDir,
    resolution,
    fps,
    format,
    quality,
    template,
    parallel
  } = options;

  // Find all scripts
  const files = await readdir(inputDir);
  const scripts = files.filter(f => f.endsWith('.md') || f.endsWith('.json') || f.endsWith('.spcomp'));

  if (scripts.length === 0) {
    console.log('❌ No scripts found in', inputDir);
    process.exit(1);
  }

  console.log(`\n📦 Studio Pro — Batch Render`);
  console.log(`   Scripts:   ${scripts.length}`);
  console.log(`   Output:    ${outputDir}`);
  console.log(`   Resolution: ${resolution}`);
  console.log(`   FPS:       ${fps}`);
  console.log(`   Format:    ${format}`);
  console.log(`   Quality:   ${quality}`);
  console.log(`   Parallel:  ${parallel}`);
  console.log('');

  // Ensure output directory
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const results = [];
  const startTime = Date.now();

  // Process scripts (parallel support)
  for (let i = 0; i < scripts.length; i += parallel) {
    const batch = scripts.slice(i, i + parallel);

    const promises = batch.map(async (script) => {
      const scriptStart = Date.now();
      const scriptName = basename(script).replace(/\.[^.]+$/, '');
      const outputPath = resolve(outputDir, `${scriptName}.${format}`);
      const scriptPath = resolve(inputDir, script);
      const renderJs = resolve(__dirname, 'render.js');

      try {
        const args = [renderJs, scriptPath, '-o', outputPath, '-r', resolution, '--fps', String(fps), '-f', format, '-q', quality];
        if (template) args.push('-t', template);
        await execFileAsync('node', args, { timeout: 300000 });

        const elapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);
        results.push({
          script,
          status: '✅',
          time: `${elapsed}s`,
          output: outputPath
        });
      } catch (err) {
        const elapsed = ((Date.now() - scriptStart) / 1000).toFixed(1);
        results.push({
          script,
          status: '❌',
          time: `${elapsed}s`,
          error: err.message
        });
      }
    });

    await Promise.all(promises);
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  const success = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;

  console.log('\n📊 Batch Summary');
  console.log('─'.repeat(60));
  console.table(results.map(r => ({
    Script: r.script,
    Status: r.status,
    Time: r.time,
    Error: r.error || ''
  })));
  console.log('─'.repeat(60));
  console.log(`Total: ${results.length} | ✅ ${success} | ❌ ${failed} | Time: ${totalTime}s`);
  console.log('');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const opts = parseArgs();

if (opts.help || !opts.inputDir) {
  showHelp();
  process.exit(opts.help ? 0 : 1);
}

if (!existsSync(resolve(__dirname, opts.inputDir))) {
  console.error(`❌ Input directory not found: ${opts.inputDir}`);
  process.exit(1);
}

batch(resolve(__dirname, opts.inputDir), opts).catch((err) => {
  console.error(`❌ Fatal: ${err.message}`);
  process.exit(1);
});
