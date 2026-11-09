# Sourced by record-framed.sh and screenshot-framed.sh: ffmpeg filters that turn a capture of the simulator window into
# just the phone. Fractions come from measuring a Device Hub window: bezel_crop cuts the title bar and toolbar off the top
# and bottom plus the dark side margins; bezel_mask makes the window background transparent outside the phone's rounded
# outline (corner radius 17.4% of its width). The mask is per-pixel and slow, so run it last, on the smallest frames.
# Override CROP_TOP / CROP_BOTTOM when the window layout differs.
top=${CROP_TOP:-0.043}
bottom=${CROP_BOTTOM:-0.041}
bezel_crop="crop=trunc(iw/2)*2:trunc(ih*(1-$top-$bottom)/2)*2:0:trunc(ih*$top/2)*2,crop=trunc(iw*0.9365/2)*2:ih:trunc(iw*0.0313):0"
bezel_mask="format=rgba,geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip(128+255*(0.174*W-hypot(max(0,max(0.174*W-X-0.5,X+0.5-W+0.174*W)),max(0,max(0.174*W-Y-0.5,Y+0.5-H+0.174*W)))),0,255)'"
