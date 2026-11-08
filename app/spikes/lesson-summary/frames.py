import sys, struct, zlib
from pathlib import Path
import av
clip, out, *times = sys.argv[1:]
def png(path, rgb):
    h, w, _ = rgb.shape
    raw = b"".join(b"\x00" + rgb[y].tobytes() for y in range(h))
    def chunk(t, d): return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d))
    Path(path).write_bytes(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b""))
with av.open(clip) as c:
    v = c.streams.video[0]
    for t in times:
        m, s = t.split(":"); sec = int(m) * 60 + int(s)
        c.seek(int(sec / v.time_base), stream=v, backward=True)
        for f in c.decode(video=0):
            if float(f.pts * v.time_base) >= sec:
                png(f"{out}/f_{m}{s}.png", f.to_ndarray(format="rgb24")); print(t, f.width, f.height); break
