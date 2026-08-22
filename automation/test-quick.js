#!/usr/bin/env node

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
  console.log('🚀 Launching Chrome with headless: false (GPU)...');
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: false,  // Canvas-labs-portal approach: visible window = GPU access
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[MB') || text.includes('[Export') || text.includes('error') || text.includes('Error')) {
      console.log(`  [browser] ${text}`);
    }
  });

  // HTTP server
  const server = http.createServer((req, res) => {
    let filePath = path.join(appDir, req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(filePath);
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  await new Promise(r => server.listen(3203, '127.0.0.1', r));
  console.log('📂 HTTP server on 3203');

  await page.goto('http://127.0.0.1:3203/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => typeof State !== 'undefined' && typeof window.startMediaBunnyExport === 'function', { timeout: 30000 });
  console.log('✅ App loaded');

  // Load a SHORT script (3 seconds only for quick test)
  const md = `---
slideDuration: 3
bg: #0a0a0f
---

# Test

Hello World`;
  
  await page.evaluate((script) => { State.markdownText = script; parseMarkdownToClips(); }, md);
  console.log('✅ Script loaded:', await page.evaluate(() => State.clips.length), 'clips,', await page.evaluate(() => State.duration) + 's');

  // Open export modal and set MediaBunny MP4
  await page.evaluate(() => openExportModal());
  await new Promise(r => setTimeout(r, 300));
  await page.evaluate(() => {
    const radio = document.querySelector('input[name="exportFormat"][value="video-mediabunny-mp4"]');
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
    exportSelectOption();
  });
  console.log('✅ Format set to MediaBunny MP4');

  // Start export
  const startTime = Date.now();
  await page.evaluate(() => submitExport());
  console.log('📤 Export started...');

  // Monitor for 60 seconds max
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await page.evaluate(() => ({
      isExporting: State.isExporting,
      currentTime: State.currentTime,
      progress: document.getElementById('exportProgressText')?.textContent || '?'
    }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    console.log(`  [${elapsed}s] exporting=${status.isExporting} t=${status.currentTime?.toFixed(1)}s progress=${status.progress}`);

    if (!status.isExporting) {
      console.log(`\n✅ Export completed in ${elapsed}s`);
      
      // Check for blob
      const blobInfo = await page.evaluate(() => ({
        hasBlob: !!window._exportBlob,
        hasUrl: !!window._exportDoneUrl,
        blobSize: window._exportBlob?.size || 0
      }));
      console.log('📋 Blob info:', blobInfo);
      break;
    }
  }

  await browser.close();
  server.close();
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
