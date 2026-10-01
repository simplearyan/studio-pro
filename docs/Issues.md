# Issue 1

1. When user export an video with video mode where we recodr video - the user export an 30 seonds video but the xported video is 3 seonds long - analyze images blow - and explain the bug and make plan to fix it 

![alt text](<Screenshot 2026-08-19 155718.png>) ![alt text](<Screenshot 2026-08-19 160005.png>) ![alt text](<Screenshot 2026-08-19 160031.png>)

## Issue 2

2. When user apply fade in or slide up animation for Images - and export them - in the exported video 
- use noticed that for slide in or fade in the image pixels are not clear and takes few frames to get stabel after slide and fade in animtion completes or ends - test this with markdown animation scrip twith mediabunny export mode and fast mode - and check exported video and make plan to fix this issue - Also test with below images with different animtions and see how they render after export 

Test media — local only, in `_demo_assets/images/` (not committed; listed by resolution, since size and format are half of what this bug is about):
`FireThumb_Pro_2K (9).png` 1920×1440 PNG · `a7496f50-8fe0-11f1-bb3b-43bf44dc94d9.jpg` 999×562 JPEG · `Cartoon_teacher_on_basketball_court_202607050805 (1).jpeg` 2400×1792 · `Cartoon_teacher_on_basketball_court_202607050805.jpeg` 2400×1792

# Isssue 3 

for html clips the border radius and stroke is not working just like it work for other elments clips - fix this 