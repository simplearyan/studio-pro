import { Output, WebMOutputFormat, BufferTarget, VideoSampleSource, VideoSample } from 'mediabunny';

let output = null;
let sampleSource = null;

self.onmessage = async (e) => {
    const data = e.data;
    if (data.type === 'start') {
        const { width, height, fps, bitrate } = data.config;
        
        output = new Output({
            format: new WebMOutputFormat(),
            target: new BufferTarget()
        });
        
        // We use standard VP9 configuration for WebM output
        sampleSource = new VideoSampleSource({
            codec: 'vp9',
            width: width,
            height: height,
            bitrate: bitrate || 5e6
        });
        
        output.addVideoTrack(sampleSource);
        
        await output.start();
    } else if (data.type === 'frame') {
        if (!sampleSource) return;
        
        const { bitmap, timestamp, duration, index } = data;
        try {
            const sample = new VideoSample(bitmap, {
                timestamp: timestamp,
                duration: duration
            });
            
            await sampleSource.add(sample);
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
        if (!output || !sampleSource) return;
        
        await output.finalize();
        
        const buffer = output.target.buffer;
        self.postMessage({
            type: 'done',
            buffer: buffer
        }, [buffer]);
        
        output = null;
        sampleSource = null;
    } else if (data.type === 'cancel') {
        output = null;
        sampleSource = null;
    }
};
