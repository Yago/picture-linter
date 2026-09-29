# Fit uses the Resource bitmap, not density-corrected naturalWidth

`img.naturalWidth` on a `w` descriptor is the density-corrected CSS width. Once Sizes match Layout width it repeats the box, so a real 1400px file in a 676px box at 2× was scored 0.5× and `source-short`. Fit uses a density-1 decode of the requested Resource when that decode is available, in both directions. Otherwise it uses the Candidate’s `w`, or the density-corrected width × `x`. Other Candidates keep their `w`. `source-short` fires only when that bitmap is under 90% of the chosen `w`.
