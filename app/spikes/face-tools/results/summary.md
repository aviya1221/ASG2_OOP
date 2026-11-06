# Face tools benchmark
- **OpenCV (YuNet + SFace)**: OpenCV.js 4.10.0, YuNet 2023mar + SFace 2021dec via ONNX Runtime Web 1.31.1 (4 threads); graphics: ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11); isolated: true; cores: 8
- **Human**: Human 3.3.6, backend webgl, BlazeFace + FaceRes; graphics: ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11); isolated: true; cores: 8
- **Human + tiles**: Human 3.3.6, backend webgl, BlazeFace + FaceRes, tiles 256/640px; graphics: ANGLE (Intel, Intel(R) UHD Graphics (0x00009B41) Direct3D11 vs_5_0 ps_5_0, D3D11); isolated: true; cores: 8

## 1. Finding faces in crowd photos (classroom, meeting, audience)
81 photos, faces counted from 10 px up. Operating point per tool: the lowest confidence with precision >= 90% (or 0.9).

| Tool | Confidence | Found 10-20 px | 20-30 | 30-50 | 50-80 | 80+ | All | False finds per photo | Time per photo |
|---|---|---|---|---|---|---|---|---|---|
| OpenCV (YuNet + SFace) | 0.5 | 64.0% | 90.9% | 93.3% | 93.0% | 83.6% | 82.1% | 2.5 | 0.8 s |
| Human | 0.9 | 0.0% | 3.1% | 28.9% | 48.0% | 60.3% | 13.6% | 0.4 | 2.3 s |
| Human + tiles | 0.9 | 3.2% | 26.1% | 49.3% | 60.7% | 69.9% | 27.8% | 3.8 | 29.6 s |

## 2. Recognising the same person when the face gets smaller (distance)
Registration photo at full size; the second photo of the same person shrunk to the given face height inside a large picture. Threshold fixed per tool so that two different people match only 0.1% of the time at full size.

| Tool | 16 px | 22 px | 28 px | 35 px | 45 px | 60 px | 80 px | 114 px |
|---|---|---|---|---|---|---|---|---|
| OpenCV (YuNet + SFace): recognised | 34.3% | 81.3% | 88.3% | 97.0% | 98.0% | 98.3% | 98.3% | 98.7% |
| Human: recognised | 0.0% | 0.0% | 0.0% | 1.7% | 7.7% | 35.3% | 60.7% | 71.7% |
| Human + tiles: recognised | 0.7% | 15.3% | 17.3% | 58.3% | 70.3% | 74.0% | 75.7% | 74.3% |
| OpenCV (YuNet + SFace): face found | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| Human: face found | 0.0% | 0.0% | 1.3% | 18.7% | 48.0% | 92.3% | 99.3% | 99.7% |
| Human + tiles: face found | 93.7% | 100.0% | 99.3% | 100.0% | 100.0% | 100.0% | 100.0% | 100.0% |
| OpenCV (YuNet + SFace): false match | 0.05% | 0.04% | 0.04% | 0.08% | 0.10% | 0.11% | 0.11% | 0.10% |
| Human: false match | 0.00% | 0.00% | 0.00% | 0.00% | 0.01% | 0.05% | 0.08% | 0.10% |
| Human + tiles: false match | 0.00% | 0.01% | 0.01% | 0.07% | 0.08% | 0.10% | 0.10% | 0.10% |

## 3. A whole class with our rules (40 present, 8 absent, 500 simulated lessons)

| Tool | Hall | Present: marked automatically | Present: to review | Present: matched to someone else | Absent: marked present by mistake |
|---|---|---|---|---|---|
| OpenCV (YuNet + SFace) | lecture hall, full-resolution photo (faces 28-80 px) | 94.9% | 5.1% | 0.0% | 0.1% |
| OpenCV (YuNet + SFace) | large hall or reduced photo (faces 16-45 px) | 78.7% | 21.2% | 0.0% | 0.3% |
| Human | lecture hall, full-resolution photo (faces 28-80 px) | 20.6% | 79.2% | 0.2% | 0.2% |
| Human | large hall or reduced photo (faces 16-45 px) | 1.8% | 98.2% | 0.0% | 0.0% |
| Human + tiles | lecture hall, full-resolution photo (faces 28-80 px) | 57.7% | 42.1% | 0.2% | 0.5% |
| Human + tiles | large hall or reduced photo (faces 16-45 px) | 31.0% | 68.8% | 0.2% | 0.3% |

## 4. Speed on this laptop (Intel UHD graphics, 8 cores)

| Tool | Find faces in a crowd photo | Full job per face (find + face-print) |
|---|---|---|
| OpenCV (YuNet + SFace) | 0.82 s | 83 ms |
| Human | 2.27 s | 758 ms |
| Human + tiles | 29.60 s | 2573 ms |
