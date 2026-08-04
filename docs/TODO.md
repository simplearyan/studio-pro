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

- for markdown style - add more script presets - one with math element - also add styles for it in styles sub tab 
- captions animtions like kalakar.io - each text pop up - 
- Subtitle timeing config sync - forward backward - 

- cutom animtion - tab - add ability to seek to keyframe with arrow icons - add reset icon for property to default 

- for slide up animtion - add 

- the slide up animtion for markdown style animtions - is no more working fix this 

- add ability select empty space between clips on a track a delte it and move clips like premier pro - add a toggle icon in header for that 
- add ability to select one clip and when user move it also move

Add ability to use audio for specifi text - shape - image - math - elment 

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









# Export Test
for now it takes 60seconds to export a 60 seconds video in 1080p with 30fps
 
And takes 90 seconds to export the same video in 2K with 30fps 

- ALSO Take 4K Test - ALthough we know - from our previous projects - that gt740 dosen't support 4K - and it will probabaly crash.


can we show video frames in timeline - or can  we show images preview in timeline for images clips 


# more advanced animtions sysytem - with  modifers - centeralized animtions system 