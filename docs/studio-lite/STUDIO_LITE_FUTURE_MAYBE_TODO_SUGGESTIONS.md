1. Add an inset so ruler labels fade within the strip instead of being cut by its edge
2. Add an export progress estimate and a cancel path that actually stops the encoder cleanly, including the audio track.

Add trim-free export of just a selected range, so a long timeline can be exported as a short clip without splitting first.

Add a self-check probe that drives a real pointer drag on the canvas colour input and the aspect tiles using synthesised trusted input.

Reconcile the two Fade controls — the Adjust knob and the Filters entry — so they agree on one curve or are clearly distinct, with the self-check asserting whichever contract wins.

Make the Export resolution choice drive the encoder bitrate so a 480p export is not the same ~20 MB as 1080p, and add a self-check row for it.


# Studio Reel Automation

Add a compare mode to the scenes page so two or more scenes can be viewed side by side at once, for checking that a sequence holds together.

Wire all three previews (reel, scenes, design) into one npm script so they regenerate together and a stale one fails the build.

Add a chart primitive vocabulary to the reel IR — bars, lines, scatter, axes and labels — with an element type that can express a series, so a data-driven film does not have to fake every visual out of shapes.