# Media fixtures

`mock-video-3s.mp4` is a synthetic FFmpeg test pattern, not AI-generated content.
It contains 3 seconds of H.264/yuv420p video at 320×180, 12 fps, without audio.
It verifies browser decoding, explicit playback, pending state polling, and byte-identical downloads without calling a paid provider.

Recreate from `apps/web`:

```sh
ffmpeg -f lavfi -i testsrc2=size=320x180:rate=12 -t 3 -an -c:v libx264 -pix_fmt yuv420p -movflags +faststart tests/fixtures/mock-video-3s.mp4
```
