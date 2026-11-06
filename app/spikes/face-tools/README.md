# Spike: face tools for photo attendance (F1)

Hands-on test for the tools report: which face tool, running inside a plain web page, finds more faces in a crowd and still recognises a person when their face is small (far rows of a lecture hall)?

Everything runs in the browser, the way the real web app would. Nothing is installed on a phone.

## Candidates

| Option | Finds faces | Face-print | License |
|---|---|---|---|
| 1. OpenCV | YuNet 2023mar, run by OpenCV.js 4.10 on the full photo | SFace 2021dec, run by ONNX Runtime Web | Apache-2.0 / MIT |
| 2. Human 3.3.6 | BlazeFace (shrinks the photo to a small square) | FaceRes | MIT |
| 2b. Human + tiles | BlazeFace on the photo and on overlapping 256/640 px tiles, then one full check per face | FaceRes | MIT |

## Test data (research use only, never committed)

- **Crowd photos:** 81 photos from WIDER FACE (validation) in the classes closest to a classroom or an auditorium: students, meetings, sports fans in stands, press conferences, award ceremonies, groups. Every face is labelled, so we can count what each tool finds by face size.
- **Distance:** 300 people from Labeled Faces in the Wild with two different photos each. Photo 1 is the "registration selfie". Photo 2 is shrunk so the face is 114 down to 16 px tall and placed in a large picture, like a face in a far row.
- **A whole class:** from those faces, 500 simulated lessons with 40 present and 8 absent students, scored with the agreed rules (one student per face; a face claimed by two students goes to review).

## Run

```sh
npm install
node download.mjs        # models + datasets (~600 MB) into models/ and data/
node prepare-data.mjs    # picks the test subsets
node run-bench.mjs       # runs the three options in Edge without a window (about an hour); add --quick for a 5-minute sample
node analyze.mjs         # writes results/summary.md and results/summary.json
node make-examples.mjs   # optional: example pictures in results/examples/ (crowd photos with boxes, faces by size)
node make-demo-set.mjs   # optional: one whole simulated lecture hall + registration photos + the matching, in results/demo-class/
```

The pictures from the last two scripts contain dataset photos, so they stay on the computer and are not committed.

The hands-on page for our own photos (team shoot, phone timing): `node serve.mjs`, then open http://127.0.0.1:8787/.
To open it from a phone on the same Wi-Fi: `HOST=0.0.0.0 node serve.mjs` and browse to the computer's address.

## Results

See [results/summary.md](results/summary.md).
