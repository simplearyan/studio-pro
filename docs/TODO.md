# Parent Preset Feature - 

- Where ecah text elment can inherit a parent preset - and if user change preset - the text will change realtime as it's children 


# Adjustment Layer 


- Scene Creator 
- Text - Image - creator with markdown 

markdown clips dual mode - 

capcut dark gray mode 

analysis of editor and comparison with remotion 

- new katex elmeetn 

✅ for vector math when user adds 3d extrude shadow with big depth - the clips on timeline becomes lag - to drag - and not smooth - can we fix thi issue 

- the user noticed when it increase vector math element size with transfrom scale - it increase and decrease smoothly - but when it increase with forumla size slider - it is not smooth - fix this 

✅ letter by letter custmization like thumb-maker 
✅ add background and cutmize border radius and background color - stroke - drop shadow and 3d extrude for that background for text element 
✅ add texture for shape - text - background - like thumb maker 

✅ for markdown style - add more script presets - one with math element - also add styles for it in styles sub tab 
✅ captions animtions like kalakar.io - each text pop up - 
✅ Subtitle timeing config sync - forward backward - 

- cutom animtion - tab - add ability to seek to keyframe with arrow icons - add reset icon for property to default 

✅ for slide up animtion - add 
✅ the slide up animtion for markdown style animtions - is no more working fix this 

- add finzar subtitle animtions for text and captions - Add sinzar styel sase in out option - advanced ease in out more options - 
- add more finzar type transfrom such as character animtions styles 
- make caption animtion word by word stay fro whole clip duration - add option for it 
✅ add ability select empty space between clips on a track a delte it and move clips like premier pro - add a toggle icon in header for that 
- add ability to select one clip and when user move it also move

✅ Add ability to use audio for specifi text - shape - image - math - elment 

✅ the hold option is not working for opacity property - fix this 
✅ overhauled preset - like thumb maker - store webp images 

✅ Overhauled Preset Tab - Add ability to use text preset for markdown text styles - 

✅ for markdown style - add mock video and mock image - with alt text - for markdown add more porsition options - like top left - cenrter left - bottom left ✅ and similar for right - also add ability - lets say two text are at left center - add gap between them - 

- Add ability to custmize and video and audio speed 
- overhauled properties panel - re-ogransied - in clean structure 

# Before implementing, add console.log(el.error.code) at the ~20696 recovery branch and run a live 20-scrub session on the two broken files to capture exact before-numbers for the plan doc.

# Build a small Node script that parses the moov/stss table of an MP4 to prove the keyframe-index approach works on the two broken files before touching index.html.

# Implement Phase 1 of Video-Stream-Stability-Plan.md: error-code classification, exponential retry backoff, last-good-frame cache in drawCanvas, and proactive re-attempt on play/scrub-idle.





## Suggestions

- The text background works great for regular text clips. Can we add the same Background controls to the Markdown style tab (global heading style + text style) so markdown-generated clips can get an auto background box?
- Can we let the texture respect the clip's borderRadius for images/videos too, and add a texture card for image and video clips so any element can get a material overlay?
- Since textures are data URLs stored in clip effects, they bloat saved projects. Can we add a 'strip textures on export' option and warn when project size grows?
- Can we let the texture respect the clip's borderRadius for images/videos too, and add a texture card for image and video clips so any element can get a material overlay?
- Vector math is smooth now. Can we apply the same quantized-bake + throttle trick to the image-based math mode (getOrRenderMathImage) so its Formula Size slider is equally smooth?
- The bake throttle caps at ~12/sec. Can we offload the MathJax parse + mask bake to a Web Worker so even that never blocks the UI thread at all?
- Since re-baking is now quantized, can we show the baked-resolution level (e.g., 'crisp / streaming / smooth') in the math properties panel so users understand the tradeoff?
- Now that vector math scales smoothly via sprite scaling, can we also cache the tinted sprite per size so color changes during a drag don't re-composite every frame?

- Add ready-made Puzzle presets (Fireship-style top sweep, random snap, block-by-block from center) as one-click options in the Animation tab so users don't have to configure direction/blocks/delay manually.


- Wire the Puzzle animation into the Markdown tab's global heading/text/image style so generated slides automatically get the puzzle block reveal without per-clip setup.

- Add a second action to the gap toggle: a 'close all gaps' button that ripple-closes every gap across all tracks in one click.
- Save the Gap Select mode toggle state to localStorage so it stays on/off across sessions, like the other timeline tool toggles.
- Add a right-click context menu on selected gaps with actions like 'Close Gap', 'Close All Gaps on Track', and 'Close All Gaps in Sequence' (premiere-style ripple).

- Make the standard MediaRecorder export also render embedded SFX by scheduling clip.sfx buffer sources in the live audio graph during its export loop.
- Add the same fade-in/fade-out sliders to regular timeline audio clips (music, voiceovers, and extracted SFX) so the envelope works everywhere, not just embedded element SFX, and wire it into playback and the export offline render.
- Add trim, fade-in/fade-out, and fade-curve controls to regular timeline audio clips (music, voiceovers, and extracted SFX) so the envelope system works everywhere, wired into playback and the export offline render.
✅ Draw the fade-in/fade-out curve and trim shading on the audio waveform peaks on the timeline so the envelope is visible at a glance.
✅ Add keyframe-able volume automation envelopes to timeline audio clips (rubber-band style), layered on top of the existing trim/fade envelope system.













# Export Test
for now it takes 60seconds to export a 60 seconds video in 1080p with 30fps
 
And takes 90 seconds to export the same video in 2K with 30fps 

- ALSO Take 4K Test - ALthough we know - from our previous projects - that gt740 dosen't support 4K - and it will probabaly crash.


can we show video frames in timeline - or can  we show images preview in timeline for images clips 


# more advanced animtions sysytem - with  modifers - centeralized animtions system 