# Technical Tools Report

<!--
LECTURER GUIDELINES: TOOLS REPORT
(Hidden on GitHub, visible when editing.)

Assignment step 2: "Perform a technical-related tools report - make sure to test
(in real life) with any suggested tool."

The slides have no separate "tools report" document. The closest definitions are:

PDR review package (lecture 03a, slide 6):
- Key technology choices, backed by spikes or prototypes
- Alternatives considered and why rejected
- Initial risk register

PDR vs CDR (lecture 03a, slide 8): at the PDR stage, prototypes are
"spikes that reduce technical risk".

Risk register example (lecture 03a, slide 13):
- R1 "Chosen library lacks a needed feature"
  Mitigation: spike before PDR; keep an alternative.
- R4 "External API delivered late"
  Mitigation: mock the API; integrate behind an interface.

SDD "Rationale" (lecture 02a, slide 12): alternatives and why this one.

Docs as code (lecture 02a, slide 21): "Record decisions: short Architecture
Decision Records for each major choice."

Three-point estimate (lecture 03a, slide 12): E = (O + 4M + P) / 6,
useful for "time to set up" per tool.

FOR OUR PROJECT
For every need: list alternatives, run a real spike (a small hands-on test),
save evidence (screenshot in docs/assets/), choose, and write down why the
others were rejected. Keep a fallback for risky choices (LLM / video APIs).
-->

## 1. Evaluation criteria

## 2. Candidate tools by need

### 2.1 Frontend / web framework
### 2.2 Backend / BaaS + realtime database
### 2.3 Spreadsheet export
### 2.4 Attendance check-in method

The method is photo attendance ([interactive mock of the flow](assets/F1-attendance-flow-demo.html)):
1. At a random time the teacher photographs the class. The teacher's page finds the faces and sends only their face-prints, never the photo.
2. Each student's page sends the face-print it saved on the phone at registration.
3. The server compares the face-prints and keeps only the result.
4. Students who are not matched choose their row and seat, and the teacher approves them.

So the need is a face tool that:
- runs inside a web page on a phone, with nothing to install;
- finds the small faces in the back rows of a lecture hall;
- recognises a person whose face is small in the photo;
- is free and open source, with a license that allows use in a product.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. OpenCV | OpenCV.js 4.10 runs the YuNet face finder (2023mar) on the full photo; ONNX Runtime Web 1.31 runs the SFace face-print model (2021dec) | OpenCV and SFace Apache-2.0, YuNet and ONNX Runtime MIT | Spike |
| 2. Human | Human 3.3.6: the BlazeFace face finder and the FaceRes face-print in one library | MIT | Spike |
| 2b. Human + tiles | Option 2, run on overlapping parts of the photo | MIT | Spike |
| face-api.js | Face finder and face-print in one library | MIT | Rejected without a spike: no release since 2020 |
| InsightFace models (SCRFD, ArcFace) | The most accurate open face models | Non-commercial research only | Rejected without a spike: the license |
| AuraFace | Open face-print model | Apache-2.0 | Rejected without a spike: hundreds of MB, too heavy for a phone |
| MediaPipe Face Detector | Face finder only | Apache-2.0 | Rejected without a spike: no face-print |
| DeepFace | Python face library for a server | MIT | Rejected without a spike: the class photo and the registration photos would have to reach the server |
| CompreFace, cloud face services | Ready face-recognition services | Apache-2.0 / paid | Rejected without a spike: they receive photos and store faces in their own database |

### 2.5 Hosting / deployment
### 2.6 LLM API (homework review)
### 2.7 Speech-to-text / video summarization
### 2.8 Vibe-coding tools

## 3. Spikes (hands-on tests)

<!-- One subsection per tool:
### Spike: <tool>
- Goal: what we wanted to check
- What we did: steps
- Result: worked / failed / limits found
- Evidence: ![screenshot](assets/<file>.png)
- Time spent
-->

### Spike: face tools for photo attendance (F1)

- **Goal:** find out which tool finds more faces in a lecture-hall photo, and still recognises a person whose face is small (back rows).
- **What we did:** we ran options 1, 2 and 2b from section 2.4 in a browser, the way the web app will run them (Edge on a laptop with Intel UHD graphics and 8 cores). The data came from public research datasets, with no client data. Code: [app/spikes/face-tools/](../app/spikes/face-tools/).
  1. **Finding faces:** 81 crowd photos close to a lecture hall, with 2,546 labelled faces of 10 px or more. They come from WIDER FACE: students, meetings, fans in stands, press conferences, ceremonies and groups.
  2. **Recognition at a distance:** 300 people with two different photos each, from Labeled Faces in the Wild. Photo 1 is the registration photo. Photo 2 is shrunk until the face is 114 down to 16 px tall. Each tool's match threshold is set so that two different people match 0.1% of the time.
  3. **A whole class:** 500 simulated lessons, each with 40 present and 8 absent students, scored with our rules. One student per face; a face claimed by two students goes to the teacher.
  4. **One full example:** a drawn lecture hall with 6 tiered rows (faces 26 to 84 px), 25 registered students, 3 guests, and 5 registered students who are absent.
- **Result:**

  | Measure | 1. OpenCV | 2. Human | 2b. Human + tiles |
  |---------|-----------|----------|-------------------|
  | Faces found in the crowd photos | 82.1% | 13.6% | 27.8% |
  | Faces found, 20-30 px faces only | 90.9% | 3.1% | 26.1% |
  | Person recognised, face 28 px | 88.3% | 0.0% | 17.3% |
  | Person recognised, face 35 px | 97.0% | 1.7% | 58.3% |
  | Class with faces 28-80 px: present students marked automatically | 94.9% | 20.6% | 57.7% |
  | Class with faces 16-45 px: present students marked automatically | 78.7% | 1.8% | 31.0% |
  | Class with faces 28-80 px: present students matched to someone else | 0.0% | 0.2% | 0.2% |
  | Class with faces 28-80 px: absent students marked present | 0.1% | 0.2% | 0.5% |
  | Time per face, finding plus face-print | 83 ms | 758 ms | 2,573 ms |

  In the full example, option 1 found all 28 faces and marked 22 of the 25 present students automatically. The other 3 went to the teacher, and no one was matched to someone else's face. All 5 absent students were marked absent, and no student was matched to a guest.

  **Limits we found:**
  - With its default confidence of 0.9, YuNet finds only 23.6% of the crowd faces. At 0.5 it finds 82.1%, with 2.5 false finds per photo. No student claims a false find, so it ends as an unclaimed face.
  - Recognition drops below 28 px (34.3% at 16 px). So the teacher's photo must be taken at full resolution.
  - SFace inside OpenCV.js took about 1 s per face. The same model in ONNX Runtime Web takes 83 ms.
  - The models and the runtime add up to about 64 MB: OpenCV.js 10 MB, SFace 39 MB, ONNX Runtime 15 MB and YuNet 0.2 MB.
  - In the benchmark, distance was simulated by shrinking press photos. The first check on real photos is below. We still need camera originals, registration photos and timing on phones, using the hands-on page in the spike folder.

  **First check in a real lecture hall (option 1):** 3 photos from the lecturer's desk, taken with the wide lens. The copies we checked were 2000 × 1500 px and compressed, not the camera originals. Each pair count below is small, so these numbers are an indication, not a measurement.
  - **Finding faces:** it found 34, 38 and 25 faces, nearly every face that was visible. Faces were 14-25 px in the back rows, 25-40 px in the middle rows and 45-75 px in the front rows.
  - **Same person in two photos:** two of the photos show the same seating. Faces of 25 px or more that looked at the camera matched 7 of 7. A head bent down did not match. Faces of 15-24 px matched 0 of 3.
  - **Different people:** two faces from the same photo passed the threshold in 1.2% of the pairs (19 of 1,564), against 0.1% in the benchmark. At a threshold of 0.45 it was 0.2%.
  - **Photo size:** OpenCV.js worked on a 4000 × 3000 photo and failed on 4080 × 3072, so its limit is about 12 MP.
- **Evidence:** [the measured results](../app/spikes/face-tools/results/summary.md). The pictures (crowd photos with the found faces, the simulated hall) contain dataset photos that are for research use only, so they stay out of the repository. `make-examples.mjs` and `make-demo-set.mjs` rebuild them. The real-hall photos show real students, so they were deleted after the check and only the numbers are recorded.
- **Time spent:** about 3.5 hours. The full run took 2 h 20 min: option 1 took 5 minutes, and option 2b took about 2 hours.

## 4. Comparison table

| Need | Option | Cost / free tier | Simplicity | Works on phones | Spike result | Chosen? |
|------|--------|------------------|------------|-----------------|--------------|---------|
| Attendance face tool | 1. OpenCV (YuNet + SFace) | Free, open source | Two models and about 100 lines of our code (loading, aligning each face) | Runs in the browser; download of about 64 MB; not yet timed on a phone (laptop: 83 ms per face) | Found 82.1% of crowd faces; recognised 97.0% at 35 px | Yes (ADR-1) |
| Attendance face tool | 2. Human | Free, open source | One library with ready examples | Runs in the browser; laptop: 758 ms per face | Found 13.6%; recognised 1.7% at 35 px | No |
| Attendance face tool | 2b. Human + tiles | Free, open source | One library plus our tiling code | Runs in the browser; laptop: 2,573 ms per face | Found 27.8%; recognised 58.3% at 35 px | No |

## 5. Decisions (ADRs)

<!-- One per major choice:
### ADR-n: <title>
- Context: what we needed
- Decision: what we chose
- Alternatives rejected and why
- Consequences: what this means for the design
-->

### ADR-1: Face tool for photo attendance

- **Context:** photo attendance needs a face tool that runs inside the web page on the teacher's phone and on the student's phone. It has to find the back-row faces and recognise them. The server never receives photos (section 2.4).
- **Decision:** option 1.
  - OpenCV.js 4.10 runs the YuNet face finder on the full-resolution photo, with a confidence of 0.5.
  - Each face is aligned to 112 × 112 px by its 5 face points. ONNX Runtime Web then runs SFace on it, which gives a face-print of 128 numbers.
  - Two face-prints match when their cosine similarity is 0.36 or more. At that threshold two different people match 0.1% of the time.
  - The same code makes the registration face-print on the student's phone and the face-prints of the class photo on the teacher's phone.
- **Alternatives rejected:**
  - Human (option 2) found 13.6% of the crowd faces and recognised 1.7% of the people at 35 px.
  - Human with tiles (option 2b) found 27.8% and recognised 58.3%, and took 2.6 s per face.
  - The tools rejected without a spike are listed in section 2.4.
- **Consequences:**
  - The teacher's page takes the photo with the phone's camera at full resolution, not from a video preview. The back-row faces have to stay at 28 px or more.
  - OpenCV.js handles photos of up to about 12 MP. The page shrinks a larger photo to that size, or splits it into two overlapping halves.
  - The page downloads about 64 MB of models once, and the browser keeps them.
  - The server needs only the cosine comparison it already has ([similarity.ts](../app/server/src/llm/similarity.ts)).
  - In a hall where faces are 28-80 px, about 5% of the present students go to the teacher. In a larger hall (16-45 px) it is about 21%. The row-and-seat step handles them.
  - Every phone must use the same model version. Changing the model means every student registers again.

## 6. Technology risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Photos of a real lecture hall give worse results than the simulation, which used shrunk press photos | Medium | High | Shoot in a real hall with our team before the design is final; students who are not matched use the row-and-seat step |
| R2 | Finding the faces in a full-resolution photo takes too long on the teacher's phone | Medium | Medium | Time it on phones with the hands-on page; if it is too slow, shrink the photo only while the back-row faces stay at 28 px or more |
| R3 | The 64 MB first download is slow on a weak network | Medium | Low | Download the models before the lesson (students at registration, the teacher on the first visit) and keep them in the browser; test the 10 MB version of SFace (not tested yet) |
| R4 | The face finder fails on photos above about 12 MP, and some phones save larger photos | High | High | Before finding faces, shrink a larger photo to 12 MP, or split it into two overlapping halves; test on phones |
| R5 | In real hall photos, different people pass the match threshold more often than in the benchmark (1.2% against 0.1% of pairs), so an absent student could match someone else's face | Medium | High | Measure it again with registration photos and camera originals; use a stricter threshold for faces under 30 px; a face claimed by two students goes to the teacher |
| R6 | Students with their heads bent down, or faces under 25 px, are not recognised | High | Medium | Ask the class to raise their heads before the photo; take 2 or 3 photos; students who are not matched use the row-and-seat step |
