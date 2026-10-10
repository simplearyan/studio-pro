'use strict';
/**
 * verify.cjs — read a finished video back with MediaBunny IN NODE and refuse
 * to call it a video unless it is one.
 *
 * Extracted from export-films.cjs (Track T1.1). Demuxing needs no WebCodecs,
 * so this runs anywhere. Both containers are covered (MP4 and WebM, T1.3):
 * a file of the wrong length, the wrong size, or short a frame count is a
 * failed export, not a warning — the batch already spent minutes rendering it.
 *
 * No ffprobe in any code path: MediaBunny is the only reader.
 */

const fs = require('fs');

const FORMATS_BY_EXT = { '.mp4': 'mp4', '.webm': 'webm' };

async function verify(file, expect) {
  const mb = require('mediabunny');
  const buf = fs.readFileSync(file);
  const kind = FORMATS_BY_EXT[String(file).slice(-5).toLowerCase()] || 'mp4';
  const format = kind === 'webm' ? mb.WEBM : mb.MP4; /* note: WEBM, not WebM */
  const input = new mb.Input({ formats: [format], source: new mb.BufferSource(buf) });
  /* No input.dispose(): it races the demuxer's own metadata reads and turns a
     late read into an unhandled InputDisposedError that kills the process —
     this script exits via process.exit right after anyway. */
  const track = await input.getPrimaryVideoTrack();
  if (!track) return { ok: false, why: 'no video track' };
  const dur = await input.computeDuration();
  let packets = null;
  try { packets = (await track.computePacketStats()).packetCount; } catch (e) { /* optional */ }
  const errs = [];
  if (expect.width && (track.codedWidth !== expect.width || track.codedHeight !== expect.height)) {
    errs.push(`size ${track.codedWidth}x${track.codedHeight} != ${expect.width}x${expect.height}`);
  }
  if (expect.duration != null && Math.abs(dur - expect.duration) > 0.15) {
    errs.push(`duration ${dur.toFixed(3)}s != ${expect.duration}s`);
  }
  if (expect.frames != null && packets !== null && packets !== expect.frames) {
    errs.push(`packet count ${packets} != ${expect.frames}`);
  }
  if (buf.length < 4096) errs.push(`only ${buf.length} bytes`);
  return { ok: !errs.length, why: errs.join('; '), dur, packets, codec: track.codec, bytes: buf.length };
}

module.exports = { verify };
