import { Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget, VideoSampleSource, VideoSample } from 'mediabunny';

let output = null;
let videoSampleSource = null;

self.onmessage = async (e) => {
    const data = e.data;
    if (data.type === 'start') {
        const { width, height, fps, bitrate, format } = data.config;
        
        const outputFormat = format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
        output = new Output({
            format: outputFormat,
            target: new BufferTarget()
        });
        
        const videoCodec = format === 'mp4' ? 'h264' : 'vp9';
        videoSampleSource = new VideoSampleSource({
            codec: videoCodec,
            width: width,
            height: height,
            bitrate: bitrate || 5e6
        });
        output.addVideoTrack(videoSampleSource);
        
        await output.start();
    } else if (data.type === 'frame') {
        if (!videoSampleSource) return;
        
        const { bitmap, timestamp, duration, index } = data;
        try {
            const sample = new VideoSample(bitmap, {
                timestamp: timestamp,
                duration: duration
            });
            
            await videoSampleSource.add(sample);
            sample.close();
            bitmap.close();
            
            self.postMessage({
                type: 'frame-processed',
                index: index
            });
        } catch (err) {
            if (bitmap) {
                try { bitmap.close(); } catch (_) {}
            }
            self.postMessage({
                type: 'error',
                error: err.message || String(err),
                index: index
            });
        }
    } else if (data.type === 'finalize') {
        if (!output || !videoSampleSource) return;
        
        await output.finalize();
        
        const buffer = output.target.buffer;
        self.postMessage({
            type: 'done',
            buffer: buffer
        }, [buffer]);
        
        output = null;
        videoSampleSource = null;
    } else if (data.type === 'cancel') {
        output = null;
        videoSampleSource = null;
    }
};
