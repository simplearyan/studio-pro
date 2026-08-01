Even though exporting/muxing is a major use case, **Mediabunny** is a full media toolkit. Beyond just generating final files, you can use it for several other core tasks in a media or video application:

### 1. Reading and Inspecting Media Files (Demuxing & Metadata)

Instead of just writing files, Mediabunny can efficiently read and parse existing video or audio files entirely on the client side:

* **Extracting Metadata:** Instantly read a file's duration, exact resolution, rotation data, container type, track configurations, and codecs without having to load the whole file into memory.
* **Inspecting Codecs/Streams:** Check what tracks exist inside an uploaded file (e.g., finding out if an MP4 has an H.264 video track and an AAC audio track, plus any WebVTT subtitle tracks).

### 2. File-to-File Conversion & Transmuxing

Mediabunny features a robust **Conversion API** that can be used independently of a timeline editor:

* **Transmuxing:** Quickly change a media container format without re-encoding the video/audio streams (e.g., repackaging a `.mov` or `.mkv` into an `.mp4` container instantly).
* **Transcoding:** Decode media using WebCodecs and re-encode it into a different format or lower bitrate.
* **Trimming & Splitting:** Cut a specific time-range out of a large media file on the client side.

### 3. Client-Side Video & Audio Compression

* You can build a **"Simple Video Compressor"** web tool. Since it uses hardware-accelerated WebCodecs, users can drop a heavy video file into the browser, lower its resolution or quality settings, and compress it locally on their machine before uploading it to a server.

### 4. Real-Time Streaming and Network I/O

* **Streaming Playback / Chunking:** Read and write media files from memory, disk, or network streams.
* **HLS Playback/Generation:** Handle HTTP Live Streaming (`.m3u8` VOD playlists) segments directly, allowing you to ingest or output segmented video streams for adaptive bitrate playback.

### 5. Custom Frame/Sample Manipulation (Low-Level Processing)

Because Mediabunny exposes granular, microsecond-accurate tools, you can hook into its data pipeline to:

* **Extract raw frames or audio samples** from a video to build custom waveform generators, video thumbnail scrubbers, or visual effects previewers.
* **Inject custom media sources**—such as piping live data straight from a webcam, microphone, canvas animation loop, or a WebGL/Three.js render target directly into an encoder pipeline.