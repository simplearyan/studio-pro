#!/usr/bin/env node

import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';
import path from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));
const appDir = resolve(__dirname, '..');

async function main() {
  const format = process.argv[2] || 'video-mp4'; // video-mp4, video-mediabunny-mp4, video-ftrt-mp4
  const testLabel = process.argv[3] || 'test';

  console.log(`🚀 Test: ${testLabel} (${format})`);
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: 'shell',  // New headless with GPU support
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[Export') || text.includes('[MB') || text.includes('error') || text.includes('Error')) {
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

  await new Promise(r => server.listen(3202, '127.0.0.1', r));

  await page.goto('http://127.0.0.1:3202/index.html', { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForFunction(() => typeof State !== 'undefined' && typeof window.startMediaBunnyExport === 'function', { timeout: 30000 });
  console.log('✅ App loaded');

  // Load script
  const md = readFileSync(resolve(__dirname, 'scripts/animal-test.md'), 'utf8');
  await page.evaluate((script) => { State.markdownText = script; parseMarkdownToClips(); }, md);
  console.log('✅ Script loaded:', await page.evaluate(() => State.clips.length), 'clips,', await page.evaluate(() => State.duration) + 's');

  // Open export modal and set format
  await page.evaluate(() => openExportModal());
  await new Promise(r => setTimeout(r, 300));

  await page.evaluate((fmt) => {
    const radio = document.querySelector(`input[name="exportFormat"][value="${fmt}"]`);
    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
    exportSelectOption();
  }, format);
  console.log(`✅ Format set: ${format}`);

  // Start export
  const startTime = Date.now();
  await page.evaluate(() => submitExport());
  console.log('📤 Export started...');

  // Monitor
  let lastProgress = '';
  for (let i = 0; i < 300; i++) { // Max 5 min
    await new Promise(r => setTimeout(r, 1000));
    const status = await page.evaluate(() => ({
      isExporting: State.isExporting,
      currentTime: State.currentTime,
      progress: document.getElementById('exportProgressText')?.textContent || '?',
      detail: document.getElementById('exportDetailLine')?.textContent || ''
    }));

    if (!status.isExporting) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Export completed in ${elapsed}s`);

      // Capture blob — the URL is set by showExportSuccess()
      await new Promise(r => setTimeout(r, 1000)); // Give blob time to settle
      const blobData = await page.evaluate(async () => {
        if (!window._exportDoneUrl) return { error: '_exportDoneUrl is null' };
        try {
          const resp = await fetch(window._exportDoneUrl);
          const blob = await resp.blob();
          return new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ data: reader.result, size: blob.size });
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          return { error: e.message };
        }
      });

      if (blobData?.error) {
        console.log(`⚠️  Blob capture failed: ${blobData.error}`);
        console.log('   The video was downloaded by Chrome to the default downloads folder.');
      } else if (blobData?.data) {
        const base64 = blobData.data.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        const ext = format === 'video-webm' ? 'webm' : 'mp4';
        const outputPath = resolve(__dirname, 'output', `${testLabel}.${ext}`);
        writeFileSync(outputPath, buffer);
        console.log(`📁 Saved: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`);
      }
      break;
    }

    // Show progress every 10%
    if (status.progress !== lastProgress) {
      lastProgress = status.progress;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      process.stdout.write(`\r   ${status.progress} (${elapsed}s) t=${status.currentTime?.toFixed(1)}s`);
    }
  }

  await browser.close();
  server.close();
}

main().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
