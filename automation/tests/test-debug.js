#!/usr/bin/env node

/**
 * Debug script — test Chrome headless loading of Studio Pro
 */

import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));

const appDir = resolve(__dirname, '..');

async function main() {
  console.log('🚀 Launching Chrome...');
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs', '--use-angle=swiftshader']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Start HTTP server
  const server = http.createServer((req, res) => {
    let filePath = path.join(appDir, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise(r => server.listen(3199, '127.0.0.1', r));
  console.log('📂 HTTP server on 3199');

  console.log('📂 Loading index.html...');
  await page.goto('http://127.0.0.1:3199/index.html', {
    waitUntil: 'domcontentloaded',
    timeout: 30000
  });
  console.log('✅ Page loaded');

  // Wait for State
  console.log('⏳ Waiting for State...');
  await page.waitForFunction(() => typeof State !== 'undefined', { timeout: 30000 });
  console.log('✅ State defined');

  // Check functions
  const checks = await page.evaluate(() => ({
    State: typeof State !== 'undefined',
    startMediaBunnyExport: typeof window.startMediaBunnyExport,
    openExportModal: typeof openExportModal,
    submitExport: typeof submitExport,
    parseMarkdownToClips: typeof parseMarkdownToClips,
    drawCanvas: typeof drawCanvas,
    exportSelectOption: typeof exportSelectOption,
    setExportQuality: typeof setExportQuality,
    applyDesignTemplate: typeof window.applyDesignTemplate,
    isExporting: State?.isExporting,
    duration: State?.duration,
    clipsCount: State?.clips?.length
  }));

  console.log('\n📋 Function checks:');
  for (const [key, val] of Object.entries(checks)) {
    console.log(`   ${key}: ${val}`);
  }

  // Load a script
  console.log('\n📜 Loading animal-test.md...');
  const md = readFileSync(resolve(__dirname, 'scripts/animal-test.md'), 'utf8');
  await page.evaluate((script) => {
    State.markdownText = script;
    parseMarkdownToClips();
  }, md);

  const afterLoad = await page.evaluate(() => ({
    clipsCount: State?.clips?.length,
    duration: State?.duration,
    markdownText: State?.markdownText?.substring(0, 50)
  }));
  console.log('✅ Script loaded:', afterLoad);

  await browser.close();
  server.close();
  console.log('\n✅ Debug complete');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
