#!/usr/bin/env node

/**
 * Test headless: true vs headless: false for MediaBunny and FTRT
 * Purpose: Determine if GPU acceleration works in headless mode
 */

import puppeteer from 'puppeteer-core';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf8'));

async function testExport(mode, format, headless) {
  const label = `${format} (headless:${headless})`;
  console.log(`\n=== Testing ${label} ===`);
  
  const browser = await puppeteer.launch({
    executablePath: config.chromePath,
    headless: headless,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--enable-webcodecs']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[MB') || text.includes('[FTRT') || text.includes('[Export')) {
      console.log(`  [browser] ${text}`);
    }
  });

  try {
    // Load dev server
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
    await page.waitForFunction(() => typeof State !== 'undefined' && typeof window.startMediaBunnyExport === 'function', { timeout: 20000 });

    // Load script
    const md = `---
slideDuration: 5
bg: #0a0a0f
---

# Quick Test

Testing ${label}

---

# Done

Short test`;
    
    await page.evaluate((script) => { State.markdownText = script; parseMarkdownToClips(); }, md);
    console.log('  Script loaded:', await page.evaluate(() => State.clips.length), 'clips');

    // Open export modal and set format
    await page.evaluate(() => openExportModal());
    await new Promise(r => setTimeout(r, 300));
    await page.evaluate((fmt) => {
      const radio = document.querySelector(`input[name="exportFormat"][value="${fmt}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      exportSelectOption();
    }, format);

    // Start export
    const startTime = Date.now();
    await page.evaluate(() => submitExport());
    console.log('  Export started...');

    // Monitor for 90s max
    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await page.evaluate(() => ({
        done: !State.isExporting,
        progress: parseInt(document.getElementById('exportProgressText')?.textContent) || 0,
        currentTime: State.currentTime || 0
      }));

      if (status.done) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`  ✅ Completed in ${elapsed}s`);
        
        // Check blob
        const blob = await page.evaluate(() => ({
          hasBlob: !!window._exportBlob,
          hasUrl: !!window._exportDoneUrl,
          size: window._exportBlob?.size || 0
        }));
        console.log(`  Blob: ${blob.hasBlob ? 'yes' : 'no'}, size: ${blob.size} bytes`);
        
        await browser.close();
        return { success: true, time: parseFloat(elapsed), blob };
      }

      if (i % 5 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        console.log(`  [${elapsed}s] ${status.progress}% t=${status.currentTime.toFixed(1)}s`);
      }
    }

    console.log('  ❌ Timeout after 90s');
    await browser.close();
    return { success: false, time: 90 };

  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`);
    await browser.close();
    return { success: false, error: err.message };
  }
}

async function main() {
  const results = [];

  // Test 1: MediaBunny with headless: true
  results.push({ mode: 'MediaBunny', headless: 'true', ...await testExport('MediaBunny', 'video-mediabunny-mp4', 'new') });

  // Test 2: MediaBunny with headless: false
  results.push({ mode: 'MediaBunny', headless: 'false', ...await testExport('MediaBunny', 'video-mediabunny-mp4', false) });

  // Test 3: FTRT with headless: true
  results.push({ mode: 'FTRT', headless: 'true', ...await testExport('FTRT', 'video-ftrt-mp4', 'new') });

  // Test 4: FTRT with headless: false
  results.push({ mode: 'FTRT', headless: 'false', ...await testExport('FTRT', 'video-ftrt-mp4', false) });

  // Summary
  console.log('\n\n=== SUMMARY ===');
  console.log('Mode'.padEnd(12) + 'Headless'.padEnd(12) + 'Status'.padEnd(10) + 'Time'.padEnd(10) + 'Blob');
  console.log('-'.repeat(54));
  for (const r of results) {
    console.log(
      r.mode.padEnd(12) +
      String(r.headless).padEnd(12) +
      (r.success ? '✅' : '❌').padEnd(10) +
      (r.time ? `${r.time}s` : 'N/A').padEnd(10) +
      (r.blob?.hasBlob ? 'yes' : 'no')
    );
  }
}

main().catch(console.error);
