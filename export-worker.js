import { Output, WebMOutputFormat, Mp4OutputFormat, BufferTarget, VideoSampleSource, VideoSample, AudioSampleSource, AudioSample } from 'mediabunny';

let output = null;
let videoSampleSource = null;
let audioSampleSource = null;

self.onmessage = async (e) => {
    const data = e.data;
    if (data.type === 'start') {
        const { width, height, fps, bitrate, format, hasAudio } = data.config;
        
        const outputFormat = format === 'mp4' ? new Mp4OutputFormat() : new WebMOutputFormat();
        output = new Output({
            format: outputFormat,
            target: new BufferTarget()
        });
        
        const videoCodec = format === 'mp4' ? 'avc' : 'vp9';
        videoSampleSource = new VideoSampleSource({
            codec: videoCodec,
            width: width,
            height: height,
            bitrate: bitrate || 5e6
        });
        output.addVideoTrack(videoSampleSource);
        
        // Only add audio track when there's audio data to send
        if (hasAudio) {
            // 'opus' works in both WebM and MP4 containers
            audioSampleSource = new AudioSampleSource({
                codec: 'opus',
                numberOfChannels: 2,
                sampleRate: 48000,
                bitrate: 128000
            });
            output.addAudioTrack(audioSampleSource);
        }
        
        await output.start();
        
        self.postMessage({ type: 'ready' });
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
    } else if (data.type === 'audio-data') {
        if (!audioSampleSource) return;
        
        const { audioData, timestamp, index } = data;
        try {
            const sample = new AudioSample(audioData, {
                timestamp: timestamp,
                duration: audioData.numberOfFrames / audioData.sampleRate
            });
            
            await audioSampleSource.add(sample);
            sample.close();
            audioData.close();
            
            self.postMessage({
                type: 'audio-processed',
                index: index
            });
        } catch (err) {
            self.postMessage({
                type: 'error',
                error: 'Audio error: ' + (err.message || String(err)),
                index: index
            });
        }
    } else if (data.type === 'finalize') {
        if (!output) return;
        
        try {
            // output.finalize() internally flushes and finalizes all attached tracks
            await output.finalize();
            
            const buffer = output.target.buffer;
            self.postMessage({
                type: 'done',
                buffer: buffer
            }, [buffer]);
        } catch (err) {
            self.postMessage({
                type: 'error',
                error: 'Finalize error: ' + (err.message || String(err))
            });
        }
        
        output = null;
        videoSampleSource = null;
        audioSampleSource = null;
    } else if (data.type === 'cancel') {
        try {
            if (output) output.cancel();
        } catch (_) {}
        output = null;
        videoSampleSource = null;
        audioSampleSource = null;
    }
};
