# Nano Racers UI artwork

Production atlas: `nano-racers-atlas.png`. Adapted from the user's supplied `Gemini_Generated_Image_2nsbjm2nsbjm2nsb.jfif` with the built-in imagegen tool.

Generation prompt: Preserve the reference's worn gunmetal, cyan edge glow, red brake accents and Nano Racers branding. Arrange left, right, accelerator, brake, power slide, a blank speedometer, a blank information panel and the logo as a 4 by 2 atlas. Keep the live speed, position and lap readouts out of the bitmap. Request isolated transparent backgrounds.

Correction prompt: Preserve positions and artwork; remove the checkerboard backdrop and dial numbers, leaving the tick marks and blank digital display.

The generated PNG remained opaque. With explicit user authorization, `scripts/extract-ui-sprites.py` now extracts the connected backdrop, preserves enclosed highlights, feathers alpha edges, removes the pale matte and adds soft black shadows. The original atlas stays unchanged. The seven `nano-*-soft.png` sprites are used by `src/ui-art.tsx` as single alpha-blended images, replacing the stepped native geometry. Values remain live React-ECS labels. No preview scene is used.
