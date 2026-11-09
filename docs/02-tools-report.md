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

| Criterion | What we check |
|-----------|---------------|
| Cost | Works on a free tier during the pilot |
| Simplicity | How much code and maintenance it needs from us |
| Works on phones | Works from the phone's browser, with no installation |
| Time to set up | How long it takes to reach a first working version |

Every tool also records the result of a hands-on spike. We prefer existing tools and code that meet these criteria, and write something ourselves only when no alternative exists.

## 2. Candidate tools by need

### 2.1 Frontend / web framework

The need comes from the [user interface decisions](features/UI-strategy.md). A tool has to:
- reuse one lesson header and tab bar across all the screens;
- show Hebrew from right to left on every width from 320 px to 1920 px (NFR-12);
- show live updates from Supabase without a reload (NFR-02).

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. React + Vite | React 19.3 for the components, Vite 8.3 for the build, TypeScript 7.0 | MIT; TypeScript Apache-2.0 | Spike |
| Plain HTML and JavaScript | Pages with no library and no build | None needed | Rejected without a spike: we would write and maintain the shared header and the live updates of every screen ourselves |
| Next.js | A React framework with its own server | MIT | Rejected without a spike: the product already has a Node.js server, and Supabase sends data straight to the page, so a second server adds work with no gain |

### 2.2 Backend / BaaS + realtime database

The need comes from the [forum](features/F2-lesson-forum-strategy.md) and the [polls](features/F3-polls-strategy.md), and from signing in and keeping homework files. A tool has to:
- bring a new forum message or poll result to 50 connected students within 2 s (NFR-02);
- hold the data, sign users in and keep PDF files;
- work on a free tier, with no database server for us to maintain.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. Supabase | A hosted Postgres database with sign-in, file storage and live updates. Free plan: 500 MB database, 1 GB of files, 50 MB per file, 200 live connections | Open source, Apache-2.0; hosted service, free tier | Spike |
| Firebase, Spark plan | Google's hosted database, sign-in and live updates | Google service, free tier | Rejected without a spike: the free plan has no file storage |
| Postgres on Render, with our own code | A free database next to our server | Open source; hosted service, free tier | Rejected without a spike: the free database expires after 30 days, and we would write sign-in, files and live updates ourselves |

### 2.3 Spreadsheet export

The need comes from the attendance sheet that the teacher downloads (REQ-19). A tool has to:
- write a file that opens correctly in Excel, in Hebrew and from right to left;
- keep ID numbers as they are, including leading zeros;
- never turn a student's text into a formula.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. `write-excel-file` | A small library that writes `.xlsx` files, version 4.1.1, 70.8 KB minified | MIT | Spike |
| 2. ExcelJS | A full library for reading and writing `.xlsx` files, version 4.4.0, 947.7 KB minified | MIT | Spike |
| 3. CSV | Plain text with commas, written by our own code | None needed | Spike |
| SheetJS | A full spreadsheet library | Apache-2.0 | Rejected without a spike: its version on npm (0.18.5) is out of date, and current versions come only from its own server |
| Google Sheets | A sheet in the teacher's Google account | Google service, free tier | Rejected without a spike: the teacher would have to connect a Google account, and the need is only a file to download |

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

The need comes from our server, which calls Gemini, compares face-prints and receives lesson recordings. A tool has to:
- give a public address that phones can reach;
- run Node.js on a free tier;
- keep a request open for as long as the lesson summary takes (NFR-05) and accept a recording of about 40 MB.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. Render | A web service built from a Git repository. Free plan: 0.1 CPU, 512 MB of memory, 750 hours a month, and it sleeps after 15 minutes without traffic | Hosted service, free tier | Spike |
| Vercel, Hobby plan | Functions that run on request | Hosted service, free tier | Rejected without a spike: a request can carry at most 4.5 MB, and a 10-minute recording weighed 39.1 MB in the lesson summary spike |
| Railway, Free plan | Hosted containers | Hosted service, free tier | Rejected without a spike: the free plan is $1 of usage credit a month |
| Fly.io | Hosted containers | Hosted service, paid | Rejected without a spike: new organizations have no free tier |

### 2.6 LLM API (homework review)
### 2.7 Speech-to-text / video summarization

The need comes from the [lesson summary decisions](features/F4-lesson-summary-strategy.md). A tool has to:
- turn a recorded lesson in Hebrew into a transcript;
- tell the teacher's words from the students' questions;
- give a result within minutes for a recording of about 10 minutes, on a free tier.

No ready project does all of this, so we compose existing parts.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. Whisper + Gemini | Whisper large-v3-turbo, run by faster-whisper 1.2.1 on our own CPU; Gemini then analyses the transcript | MIT | Spike |
| 2. ivrit.ai + Gemini | The same model retrained on Hebrew (whisper-large-v3-turbo-ct2); Gemini then analyses the transcript | Apache-2.0 | Spike |
| 3. Sound to Gemini Flash | The sound goes directly to `gemini-3.5-flash`, which transcribes it and labels the speakers | Google service, free tier | Spike |
| 4. Sound to Gemini Flash-Lite | Option 3 with `gemini-3.5-flash-lite` | Google service, free tier | Spike |
| 5. Sound, current model | Option 3 with `gemini-3.6-flash`, through our own LLM layer | Google service, free tier | Spike |
| 6. Full video | Picture and sound go to `gemini-3.6-flash` through our own LLM layer, which also lists what is on the board | Google service, free tier | Spike |
| WhisperX | Whisper with speaker labels by voice | BSD-2-Clause | Rejected without a spike: a classroom microphone picks up students weakly, and option 3 labeled the speakers without it |
| Noter, LectureSummarizer, lecsum, vidscribe | Small open projects that transcribe and summarise lectures, mostly in English | Not checked | Rejected without a spike: none of them separates the students from the teacher |

### 2.8 Vibe-coding tools

We prefer existing tools and code, and an AI coding assistant writes what is left. A tool has to:
- work on the whole repository: read the code and the documents, change several files and run tests and spikes;
- leave the decisions and the review to the team.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. Claude Code | An AI coding assistant that works in the repository, from a terminal or an editor | Hosted service, paid plan from $17 a month | Spike |
| GitHub Copilot | An AI assistant inside the editor | Hosted service; a free plan of 2,000 completions a month, and free for verified students | Rejected without a spike: option 1 already covers the need |
| Cursor | An editor with an AI assistant | Hosted service; a free plan with limited use | Rejected without a spike: option 1 already covers the need |
| Lovable | Generates a whole app from a description | Hosted service; a free plan of up to 30 build credits a month | Rejected without a spike: the product needs face tools in the browser, a server that calls Gemini and traceable documents, which a generated app does not give |

### 2.9 Form builder

The need comes from the [forum decisions](features/F2-lesson-forum-strategy.md) and from REQ-60 to REQ-69. A tool has to:
- let the teacher build a form of the four question types inside the product (REQ-61);
- show it in a window over the forum (REQ-63), from right to left;
- add little to the page, which starts at 122.5 KB compressed.

| Option | What it is | License | Status |
|--------|------------|---------|--------|
| 1. Our own code | A builder and an answer window in React, 85 lines | Ours | Spike |
| 2. SurveyJS form library | Shows a form from JSON, version 3.2.4. Its builder, Survey Creator, is sold separately | MIT; the builder needs a paid license | Spike |
| 3. Form.io | A builder and a form renderer, version 5.7.0 | MIT | Spike |
| FormEngine | Shows a form from JSON | MIT; the visual designer is paid | Rejected without a spike: the free part has no builder |
| react-jsonschema-form | Shows a form from a JSON Schema | Apache-2.0 | Rejected without a spike: it has no builder |
| react-form-builder2 | A drag-and-drop form builder | MIT | Rejected without a spike: no release since May 2025 |

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

### Spike: lesson summary from a recorded video (F4)

- **Goal:** find the way that turns a recorded lesson in Hebrew into a transcript that tells the teacher from the students, and find out whether sending the picture adds anything over sound alone.
- **What we did:** we used a public recording of a probability tutorial in Hebrew, with a noisy start and real student questions. In every way, Gemini then analysed the transcript into a summary, topics, the teacher's points and the students' questions. Code: [app/spikes/lesson-summary/](../app/spikes/lesson-summary/).
  1. **Ways of working from sound (2026-11-06):** options 1 to 4 from section 2.7, on minutes 0 to 20. Whisper ran on a laptop CPU with 8 threads and no graphics card.
  2. **Sound against full video (2026-11-08):** options 5 and 6, on minutes 5 to 15, through the product's own LLM layer on the free tier, with a minute between requests. In option 6 the model also listed what was on the board, and we compared that list with frames from the video.
- **Result:**

  | Measure, minutes 0 to 20 | 1. Whisper + Gemini | 2. ivrit.ai + Gemini | 3. Sound to Flash | 4. Sound to Flash-Lite |
  |---------|-----------|----------|-------------------|-------------------|
  | Total time | 23.1 min | 19.7 min | 127 s | 45 s |
  | The word for "events" written correctly | 0 of 6 | 7 of 7 | 7 of 7 | 7 of 7 |
  | Invented foreign words | 6 | 0 | 0 | 0 |
  | Speaker labels | None | None | Teacher and student, 17 student lines | Teacher and student, 3 student lines |
  | Student questions found | 4 | 3 | 3 | 3, missing those at 07:31 and 13:08 |

  | Measure, minutes 5 to 15 | 5. Sound | 6. Full video, 720p |
  |---------|-----------|----------|
  | Total time, without pauses | 129 s | 141 s |
  | Total tokens | 32,017 | 75,530 |
  | Student lines | 14 | 16 |
  | Student questions found | 3 | The same 3 |
  | Items listed from the board | Not available | 8 |

  **Limits we found:**
  - Text quality was judged by reading it. Nobody compared the transcripts with the recording.
  - Two frames from the video confirmed the 8 board items, except for one line that merged later writing and dropped a term.
  - The written summaries of options 5 and 6 came out almost the same, because the analysis step hardly used the board list. So the board gets its own part on the summary page.
  - Option 5 gave one student's sentence to the teacher, and option 6 labeled it correctly.
  - In the noisy first two minutes, option 3 marked every line as the teacher.
  - Options 5 and 6 both misheard the term "inclusion-exclusion".
  - One question appears at 13:37 in option 3's transcript and at 13:08 in options 1 and 2, so Gemini's timestamps can be off by about 30 s.
  - A plain-text request for a transcript returned one line ("Transcribed as requested."). A JSON schema of the utterances fixed it.
  - `gemini-3.8-flash` returned error 503 on all six tries, over two runs, and `gemini-3.5-flash` returned it once.
  - `gemini-3.5-flash` is no longer listed on Google's pricing page, so we repeated option 3 as option 5 on the current model.
  - A full lesson was not tested. The target for the pilot is a recording of about 10 minutes.
- **Evidence:** [the measured results](../app/spikes/lesson-summary/results/summary.md). The transcripts hold the words of real students, so they stay out of the repository and only the numbers are recorded.
- **Time spent:** about an hour of run time over all the runs.

### Spike: database and live updates on Supabase

- **Goal:** find out whether the free plan brings a forum message or a poll result to a class of 50 within 2 s (NFR-02), and whether sign-in and file storage work on it.
- **What we did (2026-11-09):** we opened a free project in Frankfurt and connected 50 clients with `supabase-js` 2.119.0, each with its own connection, all on one laptop. Messages went out in two ways and at four paces, from one message every 2 s to the whole class sending within 1 s. Code: [app/spikes/backend-realtime/](../app/spikes/backend-realtime/).
  - **Database changes:** a client writes a row, and everyone connected receives it.
  - **Direct broadcast:** a client sends a message to everyone connected, with no write to the database.
- **Result:**

  | Pace | Deliveries per method | Database changes: 95% within | Database changes: slowest | Direct broadcast: 95% within | Direct broadcast: slowest |
  |------|-----------------------|------------------------------|---------------------------|------------------------------|---------------------------|
  | One message every 2 s | 1,500 | 650 ms | 1,154 ms | 93 ms | 368 ms |
  | One message every second | 1,000 | 753 ms | 1,049 ms | 81 ms | 360 ms |
  | The whole class sends within 10 s | 2,500 | 615 ms | 713 ms | 79 ms | 306 ms |
  | The whole class sends within 1 s | 2,500 | 708 ms | 1,130 ms | 89 ms | 182 ms |

  A delivery is one message reaching one client. All 15,000 deliveries arrived within 2 s, no send failed and no connection was lost. All 50 clients connected in under 1 s in every test. An earlier run at one message every 2 s gave the same picture: all 3,000 deliveries arrived, 95% within 677 ms and 87 ms, and the clients connected within 1.9 s.

  Sign-in took 220 ms at the median over 5 attempts. A 5 MB file took 2.4 s to upload and 2.0 s to download, and came back identical.

  **Limits we found:**
  - All 50 clients ran on one laptop and one network, so the times do not include real phones.
  - The test table lets every client read it. A real rule, such as only the students linked to the lesson, has to be checked for each client on each change, so database changes will be slower.
  - The free plan officially allows 100 events per second, and each delivery counts as an event. The two paces of the whole class went above that (about 250 and 2,500 per second) with no dropped connection, but only for 10 s and 1 s, so a longer burst is still untested.
  - The free plan allows files of up to 50 MB and pauses a project after 1 week without activity.
- **Evidence:** [the measured results](../app/spikes/backend-realtime/results/summary.md).
- **Time spent:** the two runs took about 10 minutes.

### Spike: web client with React and Vite

- **Goal:** confirm that the stack shows the lesson page in Hebrew on every screen width (NFR-12), and shows live updates without a reload (NFR-02).
- **What we did (2026-11-09):** we built the lesson header, the three tabs and a sample of each tab. Code: [app/spikes/client-react/](../app/spikes/client-react/).
  - **Stack:** React 19.3.1, Vite 8.3.7, TypeScript 7.0.2, `@supabase/supabase-js` 2.119.0, plain CSS with media queries.
  - **Measurement:** a Playwright 1.49.1 script in Edge, on emulated phones. The slow-phone profile is 150 ms latency, 1.6 Mbit/s and a CPU four times slower.
  - **Screens:** 8 sizes from 320 × 568 to 1920 × 1080, including a phone on its side, on all 3 tabs.
  - **Live updates:** per run, 30 messages at one per second and 50 within 1 s, timed until they appear on the page.
- **Result:**

  | Measure | Result |
  |---------|--------|
  | First install | 39 s |
  | Production build | 4.4 s |
  | Page weight, compressed | 122.5 KB |
  | Screen checks with no sideways scrolling of the page | 24 of 24 |
  | First content on the slow phone, median of 5 loads | 1.4 to 1.7 s in 3 runs; 4.2 and 5.0 s in 2 runs |
  | Database changes: 240 messages over 3 runs | All arrived; 95% within 832 ms at worst; slowest 1,214 ms |
  | Direct broadcast: 400 messages over 5 runs | All arrived; 95% within 814 ms at worst; slowest 854 ms |
  | Page reloads during the live updates | 0 |

  **Limits we found:**
  - The phones were emulated on a laptop, so real phones are still to be timed.
  - The slower load times came from the first 2 runs, probably because the laptop was busy.
  - One page received the messages, not 50. The Supabase spike covers 50 clients.
  - The sample page has no feature code, so the real page will be heavier.
- **Evidence:** [the measured results of the last run](../app/spikes/client-react/results/summary.md) and screenshots at [320 px](../app/spikes/client-react/results/forum-320.png), [390 px](../app/spikes/client-react/results/forum-390.png) and [1280 px](../app/spikes/client-react/results/forum-1280.png).
- **Time spent:** 5 runs of about 3 minutes each.

### Spike: hosting our server on Render

- **Goal:** find out whether a free web service can run our server: waking up, a long wait, a large upload and a class of attendance responses.
- **What we did (2026-11-09):** we deployed a small test server, with no keys and no data, to a free Render service in Frankfurt, and measured it from a laptop. Code: [app/spikes/hosting/](../app/spikes/hosting/).
- **Result:**

  | Measure | Result |
  |---------|--------|
  | 50 attendance responses within 60 s | All answered; 95% within 182 ms, the slowest 413 ms |
  | 50 attendance responses within 1 s | All answered; 95% within 249 ms, the slowest 295 ms |
  | Upload of 40 MB to the temporary disk | 11.8 s, identical to the original, 72 MB of memory |
  | Upload of 200 MB to the temporary disk | 60.3 s, identical to the original, 74 MB of memory |
  | A request with no reply for 330 s | Answered normally after 330.1 s |
  | Waking after 16 minutes without traffic, 3 tries | 92.3 s, 22.3 s and 12.3 s |
  | A reply once awake | 129 to 170 ms |

  **Limits we found:**
  - The first request after a quiet period waits for up to 92 s, so the 2 s target (NFR-03) holds only while the server is awake.
  - The attendance test compared face-prints and did not save the result to the database.
  - The upload test did not pass the file on to Gemini.
  - All requests came from one laptop, not from phones.
  - The disk is emptied on every restart, and Render may restart a free service at any time.
- **Evidence:** [the measured results](../app/spikes/hosting/results/summary.md).
- **Time spent:** the runs took about an hour, most of it waiting for the server to fall asleep.

### Spike: attendance sheet export

- **Goal:** find the format and the tool that give a Hebrew attendance sheet that opens correctly in Excel (REQ-19).
- **What we did (2026-11-09):** we wrote the sheet of a made-up class of 50 in each of the three ways on Node 22, and read each file in real Excel. Five rows hold hard cases: ID numbers that start with zeros, names with an apostrophe, a comma or quotation marks, and notes that look like formulas. Code: [app/spikes/spreadsheet-export/](../app/spikes/spreadsheet-export/).
- **Result:**

  | Measure | 1. `write-excel-file` | 2. ExcelJS | 3. CSV |
  |---------|-----------------------|------------|--------|
  | Rows in Excel | 51 of 51 | 51 of 51 | 51 of 51 |
  | ID numbers shown correctly | 5 of 5 | 5 of 5 | 0 of 5 |
  | Names shown correctly | 5 of 5 | 5 of 5 | 5 of 5 |
  | Notes kept as written | 5 of 5 | 5 of 5 | 1 of 5 |
  | Notes run as formulas | 0 of 5 | 0 of 5 | 3 of 5 |
  | The file sets right to left | Yes | Yes | Not possible in CSV |
  | File size | 4.6 KB | 8.4 KB | 3.5 KB |
  | Time to write | 10 ms | 15 ms | Under 1 ms |

  **Limits we found:**
  - In the CSV file Excel showed the ID number 012345678 as 12345678 and 123456782 as 1.23E+08, and it ran `=1+1` as a formula.
  - Only Excel on Windows was checked.
  - The libraries ran on a server, not in a browser.
- **Evidence:** [the measured results](../app/spikes/spreadsheet-export/results/summary.md).
- **Time spent:** about 15 minutes.

### Spike: form builder (F6)

- **Goal:** find out whether existing code can give us the form builder and the answer window, at a reasonable cost to the page.
- **What we did (2026-11-09):** we bundled and minified each option with esbuild and measured what it adds to the page, leaving out React, which the page has already. For option 1 we wrote a builder and an answer window for the four question types, and rendered them on a server to check them. Code: [app/spikes/form-builder/](../app/spikes/form-builder/).
- **Result:**

  | Measure | 1. Our own code | 2. SurveyJS form library | 3. Form.io |
  |---------|-----------------|--------------------------|------------|
  | Added to the page, compressed | 1.1 KB | 498.7 KB | 509.2 KB |
  | Added to the page, minified | 2.6 KB | 2,478.3 KB | 1,780.9 KB |
  | A form builder for the teacher, free | Yes | No | Yes |

  For a form of the four question types, option 1 rendered 7 radio buttons, 3 checkboxes and 1 text box from right to left, and it found every unanswered question.

  **Limits we found:**
  - Option 1 was rendered on a server and was not clicked through in a browser or on a phone, and it has no styling yet.
  - Options 2 and 3 were measured for size only.
- **Evidence:** [the measured results](../app/spikes/form-builder/results/summary.md).
- **Time spent:** about 20 minutes.

### Spike: AI coding assistant

- **Goal:** find out whether an AI coding assistant can carry the work on a product like ours, and where the team still has to check it.
- **What we did:** we used Claude Code for the project's documents, for the server's LLM layer and for the spikes in [app/spikes/](../app/spikes/). We counted its share in the commit history and noted where it went wrong.
- **Result:** on 2026-11-09, all 172 commits carried its co-author line, and it had written 8 spikes.

  **Limits we found:**
  - The co-author line shows that the assistant took part in a commit, not how much of it the assistant wrote.
  - It can be wrong about earlier work: it once said that a test did not exist, and once overstated what a test had shown. The team caught both.
  - It needs a paid plan.
- **Evidence:** the commit history of this repository.
- **Time spent:** not measured.

## 4. Comparison table

| Need | Option | Cost / free tier | Simplicity | Works on phones | Spike result | Chosen? |
|------|--------|------------------|------------|-----------------|--------------|---------|
| Attendance face tool | 1. OpenCV (YuNet + SFace) | Free, open source | Two models and about 100 lines of our code (loading, aligning each face) | Runs in the browser; download of about 64 MB; not yet timed on a phone (laptop: 83 ms per face) | Found 82.1% of crowd faces; recognised 97.0% at 35 px | Yes (ADR-1) |
| Attendance face tool | 2. Human | Free, open source | One library with ready examples | Runs in the browser; laptop: 758 ms per face | Found 13.6%; recognised 1.7% at 35 px | No |
| Attendance face tool | 2b. Human + tiles | Free, open source | One library plus our tiling code | Runs in the browser; laptop: 2,573 ms per face | Found 27.8%; recognised 58.3% at 35 px | No |
| Lesson summary | 1. Whisper + Gemini | Transcription free and open source; Gemini on the free tier | A Python service and a model to host, next to our server | Runs on the server; the teacher only uploads a file | 23.1 min for 20 min; wrong terms, invented words, no speaker labels | No |
| Lesson summary | 2. ivrit.ai + Gemini | Transcription free and open source; Gemini on the free tier | A Python service and a model to host, next to our server | Runs on the server; the teacher only uploads a file | 19.7 min for 20 min; correct terms, no speaker labels | No |
| Lesson summary | 3. Sound to Flash | Free tier | One call through our LLM layer | Runs on the server; the teacher only uploads a file | 127 s for 20 min; cleanest Hebrew, speaker labels; model no longer listed by Google | No |
| Lesson summary | 4. Sound to Flash-Lite | Free tier | One call through our LLM layer | Runs on the server; the teacher only uploads a file | 45 s for 20 min; missed student questions | No |
| Lesson summary | 5. Sound, current model | Free tier | One call through our LLM layer, plus extracting the sound | Runs on the server; the teacher only uploads a file | 129 s and 32,017 tokens for 10 min; 3 student questions; no board | As the fallback (ADR-2) |
| Lesson summary | 6. Full video | Free tier | One call through our LLM layer | Runs on the server; the teacher only uploads a file | 141 s and 75,530 tokens for 10 min; the same 3 questions; board list; better speaker labels | Yes (ADR-2) |
| Database and live updates | 1. Supabase | Free plan: 500 MB database, 1 GB of files, 50 MB per file, 200 live connections; paused after 1 week without activity | One service and its client library for data, sign-in, files and live updates | The client library runs in the browser, with nothing to install; not yet timed on a phone | 50 of 50 connected; all 18,000 deliveries within 2 s; 95% within 753 ms at worst with database changes and 93 ms with direct broadcast | Yes (ADR-3) |
| Web client | 1. React + Vite | Free, open source | One install and one build step; the lesson header is written once | Runs in the browser, with nothing to install; 122.5 KB compressed; not yet timed on a real phone | 24 of 24 screen checks passed; first content in 1.4 to 5.0 s on an emulated slow phone; all 240 database-change messages arrived, the slowest at 1,214 ms | Yes (ADR-4) |
| Server hosting | 1. Render | Free plan: 0.1 CPU, 512 MB of memory, 750 hours a month; sleeps after 15 minutes without traffic | One service built from a Git repository, with no machine of our own to maintain | A public address for any phone browser; not yet tested from a phone | 50 of 50 attendance responses answered, 95% within 249 ms at worst; a 200 MB upload arrived identical; a 330 s wait was answered; woke in 12 to 92 s | Yes (ADR-5) |
| Attendance sheet | 1. `write-excel-file` | Free, open source | One call; a library of 70.8 KB | Runs in the browser or on a server, with nothing to install; the browser was not tested | In Excel: 5 of 5 ID numbers correct, 0 of 5 notes run as formulas, right to left | Yes (ADR-6) |
| Attendance sheet | 2. ExcelJS | Free, open source | One call; a library of 947.7 KB | Runs in the browser or on a server, with nothing to install; the browser was not tested | In Excel: 5 of 5 ID numbers correct, 0 of 5 notes run as formulas, right to left | No |
| Attendance sheet | 3. CSV | Free, no library | A few lines of our own code | A plain text file | In Excel: 0 of 5 ID numbers correct, 3 of 5 notes run as formulas | No |
| Form builder | 1. Our own code | Free | 85 lines to write and maintain | Runs in the browser, with nothing to install; not yet tried on a phone | Adds 1.1 KB compressed; rendered all four question types from right to left; found every unanswered question | Yes (ADR-7) |
| Form builder | 2. SurveyJS form library | The form library is free; the builder is paid | One library for the answer window; the builder would still be ours or paid | Not tested | Adds 498.7 KB compressed | No |
| Form builder | 3. Form.io | Free, open source | One library with a builder and a renderer | Not tested | Adds 509.2 KB compressed | No |

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

### ADR-2: Source and service for the lesson summary

- **Context:** the lesson summary needs a transcript that tells the teacher from the students, and the content of the board ([decisions](features/F4-lesson-summary-strategy.md)). The target for the pilot is a recording of about 10 minutes.
- **Decision:** option 6, with option 5 as the fallback.
  - The server uploads the full video through the LLM layer and asks `gemini-3.6-flash` for the transcript, the speaker labels and the board list, as JSON by a schema.
  - A second request writes the four parts of the summary page from them, and a third checks them against the transcript and the board list.
  - If the file is over the size limit or a usage limit is reached, the server sends only the sound.
- **Alternatives rejected:**
  - Options 1 and 2 (open Whisper models) took 19 to 23 minutes for 20 minutes of sound on our CPU, and gave no speaker labels.
  - Option 3 uses a model that Google no longer lists, and option 5 replaces it.
  - Option 4 missed student questions.
  - The tools rejected without a spike are listed in section 2.7.
- **Consequences:**
  - The feature depends on an outside service and is not open source. It stays behind the `LlmClient` interface, so the provider can be replaced and the pilot can fall back to `FakeLlmClient`.
  - The transcript and the summary of a 10-minute recording take about 76,000 tokens, and the review adds to that.
  - The server has to extract the sound from the video for the fallback.
  - The Gemini SDK already retries overload errors, but the feature still needs a second model for when Gemini stays overloaded (R7).
  - The server deletes the recording, here and at Google, once the summary is ready.

### ADR-3: Database, sign-in, files and live updates

- **Context:** the forum, the polls and the forms have to reach 50 connected students within 2 s (NFR-02). The product also has to hold its data, sign users in and keep homework files, on a free tier.
- **Decision:** option 1 from section 2.2, Supabase on the free plan, in the Frankfurt region.
  - One service holds the database, the sign-in, the files and the live updates.
  - New forum messages and poll results reach the clients as database changes, so one write both saves a message and publishes it.
  - Direct broadcast stays as the faster alternative.
- **Alternatives rejected:**
  - The free plan of Firebase has no file storage.
  - A database of our own on Render expires after 30 days on the free plan, and we would write sign-in, files and live updates ourselves.
- **Consequences:**
  - The page connects directly with the public key, so every table needs access rules.
  - The secret key stays on our server.
  - Lesson recordings are not kept in Supabase, because the free plan allows 50 MB per file. They go from our server straight to Google (ADR-2).

### ADR-4: Web client

- **Context:** the screens share one lesson header and tab bar, and must fit every width from 320 px to 1920 px (NFR-12) with live updates from Supabase (NFR-02).
- **Decision:** option 1 from section 2.1: React 19.3 with Vite 8.3, in TypeScript 7.0. `@supabase/supabase-js` connects the page to Supabase, and plain CSS with media queries fits the page to the screen.
- **Alternatives rejected:**
  - Plain HTML and JavaScript would leave the shared header and the live updates of every screen for us to write and maintain.
  - Next.js adds a second server next to our Node.js server, with no gain, because Supabase sends data straight to the page.
- **Consequences:**
  - The client has a build step, and its output is static files.
  - Client and server share one language, TypeScript.
  - The page starts at 122.5 KB compressed, before the feature code.
  - Only the public Supabase key goes into the page.

### ADR-5: Hosting the server

- **Context:** the server calls Gemini, compares face-prints and receives recordings of about 40 MB. Phones have to reach it, and it has to run on a free tier.
- **Decision:** option 1 from section 2.5: a free Render web service in the Frankfurt region, the same region as Supabase.
- **Alternatives rejected:**
  - On the free plan of Vercel a request can carry at most 4.5 MB, and a 10-minute recording weighed 39.1 MB.
  - The free plan of Railway is $1 of usage credit a month.
  - Fly.io has no free tier for new organizations.
- **Consequences:**
  - The server sleeps after 15 minutes without traffic and took up to 92 s to wake, so the page wakes it when the teacher opens the lesson.
  - The disk is temporary, so all lasting data goes to Supabase (ADR-3).

### ADR-6: Attendance sheet file

- **Context:** the teacher downloads a lesson's attendance sheet as a spreadsheet file (REQ-19), with Hebrew names and ID numbers that may start with zeros.
- **Decision:** option 1 from section 2.3: an `.xlsx` file written with `write-excel-file`. Every cell is written as text, and the sheet is set right to left.
- **Alternatives rejected:**
  - In CSV, Excel showed no ID number correctly and ran 3 of 5 notes as formulas.
  - ExcelJS gave the same result with a library 13 times larger.
  - The tools rejected without a spike are listed in section 2.3.
- **Consequences:**
  - A student's text cannot run as a formula in the teacher's Excel.
  - ID numbers stay text, so they cannot be used for calculations in the sheet.

### ADR-7: Form builder

- **Context:** the teacher builds forms of four question types inside the product, and students answer them in a window over the forum (REQ-60 to REQ-69).
- **Decision:** option 1 from section 2.9: we write the builder and the answer window ourselves, in React.
- **Alternatives rejected:**
  - The SurveyJS form library adds 498.7 KB compressed, and its builder needs a paid license.
  - Form.io adds 509.2 KB compressed, about 4 times the size of the whole page.
  - The tools rejected without a spike are listed in section 2.9.
- **Consequences:**
  - A form is kept as plain data: a list of questions with their types and options.
  - The styling of the builder and the window is still to be written.

### ADR-8: Way of building

- **Context:** the team has limited time, and the product combines many parts. We prefer existing tools and code that meet the criteria in section 1.
- **Decision:** we use existing tools and code wherever they meet the criteria (ADR-1 to ADR-6), and Claude Code writes what is left, such as the form builder (ADR-7). The team reviews each result, and the document check runs before every commit.
- **Alternatives rejected:** the tools rejected without a spike are listed in section 2.8.
- **Consequences:**
  - Development needs a paid plan of the assistant. The product itself does not depend on it.
  - Any claim about a test has to be checked against the results in the repository.

## 6. Technology risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R1 | Photos of a real lecture hall give worse results than the simulation, which used shrunk press photos | Medium | High | Shoot in a real hall with our team before the design is final; students who are not matched use the row-and-seat step |
| R2 | Finding the faces in a full-resolution photo takes too long on the teacher's phone | Medium | Medium | Time it on phones with the hands-on page; if it is too slow, shrink the photo only while the back-row faces stay at 28 px or more |
| R3 | The 64 MB first download is slow on a weak network | Medium | Low | Download the models before the lesson (students at registration, the teacher on the first visit) and keep them in the browser; test the 10 MB version of SFace (not tested yet) |
| R4 | The face finder fails on photos above about 12 MP, and some phones save larger photos | High | High | Before finding faces, shrink a larger photo to 12 MP, or split it into two overlapping halves; test on phones |
| R5 | In real hall photos, different people pass the match threshold more often than in the benchmark (1.2% against 0.1% of pairs), so an absent student could match someone else's face | Medium | High | Measure it again with registration photos and camera originals; use a stricter threshold for faces under 30 px; a face claimed by two students goes to the teacher |
| R6 | Students with their heads bent down, or faces under 25 px, are not recognised | High | Medium | Ask the class to raise their heads before the photo; take 2 or 3 photos; students who are not matched use the row-and-seat step |
| R7 | Gemini stays overloaded or a usage limit is reached during the pilot (error 503 in the spike) | Medium | High | A second model, the sound-only fallback, and `FakeLlmClient` with a ready result as plan B |
| R8 | Mistakes in the transcript or the board list reach the summary page | High | Medium | The second review against the transcript and the board list; the teacher can edit the text or upload again |
| R9 | A full lesson behaves differently from the 10-minute clip we tested, in limits, time or quality | Medium | Medium | Keep the pilot to recordings of about 10 minutes; test a full lesson before allowing longer ones |
| R10 | Google retires or changes the model we tested | Medium | Low | The model is a setting (`GEMINI_TEXT_MODEL`); repeat the spike after any change |
| R11 | A class stays above the free plan's 100 events per second for longer than we tested, and connections are dropped | Low | Medium | Send poll results as one combined update per second |
| R12 | The free project is paused after 1 week without activity | Medium | High | Open and check the project before every use |
| R13 | Real phones and real access rules are slower than in the spike | Medium | Low | Measure again in the system tests; switch to direct broadcast if needed |
| R14 | Real phones load the page more slowly than the emulated phones, and feature code makes it heavier | Medium | Medium | Time the page on real phones before the pilot; load each tab's code on demand if it is too slow |
| R15 | The server is still asleep when a lesson starts, and the first request waits for up to 92 s | High | Medium | The page wakes the server when the teacher opens the lesson |
| R16 | Render restarts the free service in the middle of a job | Low | Medium | The teacher uploads the file again |
| R17 | The sheet was checked only in Excel on Windows and may look different elsewhere | Low | Low | Open the file in Google Sheets and on a phone before the pilot |
| R18 | A need we find later does not fit our own form code | Low | Low | The code is small, so it can be extended or replaced |
