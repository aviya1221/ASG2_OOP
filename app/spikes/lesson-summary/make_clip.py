"""Cut one window from a video-only mp4 and an m4a audio file, with no re-encoding.

Writes clip.mp4 (video + audio, for the full-video way) and clip.wav (16 kHz mono,
the same format as the earlier audio test). Both start at the same key frame.
Usage: make_clip.py VIDEO AUDIO START_MIN MINUTES OUT_DIR
"""
import sys
import wave
from pathlib import Path

import av
import numpy as np

video_path, audio_path, start_min, minutes, out_dir = sys.argv[1:6]
start = float(start_min) * 60
end = start + float(minutes) * 60
out = Path(out_dir)

invid = av.open(video_path)
inaud = av.open(audio_path)
vs = invid.streams.video[0]
aus = inaud.streams.audio[0]
output = av.open(str(out / "clip.mp4"), "w")
ovs = output.add_stream_from_template(vs)
oas = output.add_stream_from_template(aus)

invid.seek(int(start / vs.time_base), stream=vs, backward=True, any_frame=False)
origin = None
for pkt in invid.demux(vs):
    if pkt.dts is None:
        continue
    t = float(pkt.pts * vs.time_base)
    if origin is None:
        if not pkt.is_keyframe:
            continue
        origin = t
    if t >= end:
        break
    shift = int(origin / vs.time_base)
    pkt.pts -= shift
    pkt.dts -= shift
    pkt.stream = ovs
    output.mux(pkt)

inaud.seek(int(origin / aus.time_base), stream=aus, backward=True, any_frame=False)
for pkt in inaud.demux(aus):
    if pkt.dts is None:
        continue
    t = float(pkt.pts * aus.time_base)
    if t < origin:
        continue
    if t >= end:
        break
    shift = int(origin / aus.time_base)
    pkt.pts -= shift
    pkt.dts -= shift
    pkt.stream = oas
    output.mux(pkt)
output.close()
invid.close()
inaud.close()

sr = 16000
resampler = av.AudioResampler(format="s16", layout="mono", rate=sr)
chunks = []
with av.open(audio_path) as c:
    for frame in c.decode(audio=0):
        for f in resampler.resample(frame):
            chunks.append(f.to_ndarray().reshape(-1))
    for f in resampler.resample(None):
        chunks.append(f.to_ndarray().reshape(-1))
samples = np.concatenate(chunks)[int(origin * sr):int(end * sr)]
with wave.open(str(out / "clip.wav"), "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(sr)
    w.writeframes(samples.astype("<i2").tobytes())

print(f"clip starts at {origin:.2f}s, ends at {end:.2f}s, length {(end - origin) / 60:.2f} min")
for name in ("clip.mp4", "clip.wav"):
    print(name, f"{(out / name).stat().st_size / 1e6:.1f} MB")
with av.open(str(out / "clip.mp4")) as c:
    print("mp4 duration", round(c.duration / av.time_base / 60, 2), "min; streams", [s.type for s in c.streams])
