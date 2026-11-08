# Lesson summary spike: measured results

The raw numbers of each run are in [metrics/](metrics/). Text quality was judged by reading the transcripts, not by comparing them with the recording.

## Ways of working from sound, minutes 0 to 20, 2026-11-06

| Measure | 1. Whisper + Gemini | 2. ivrit.ai + Gemini | 3. Sound to 3.5 Flash | 4. Sound to 3.5 Flash-Lite |
|---|---|---|---|---|
| Total time | 23.1 min | 19.7 min | 127 s | 45 s |
| The word for "events" written correctly | 0 of 6 | 7 of 7 | 7 of 7 | 7 of 7 |
| Invented foreign words | 6 | 0 | 0 | 0 |
| Speaker labels | None | None | Teacher and student, 17 student lines | Teacher and student, 3 student lines |
| Student questions found | 4 | 3 | 3 | 3, missing those at 07:31 and 13:08 |

## Sound against full video, minutes 5 to 15, `gemini-3.6-flash`, 2026-11-08

| Measure | 5. Sound | 6. Full video, 720p |
|---|---|---|
| File size | 19.4 MB | 39.1 MB |
| Upload | 7 s | 28 s |
| Transcript | 76 s | 85 s |
| Analysis | 46 s | 28 s |
| Total time, without pauses | 129 s | 141 s |
| Input tokens, transcript request | 15,270 | 55,336 |
| Total tokens, both requests | 32,017 | 75,530 |
| Student lines | 14 | 16 |
| Student questions found | 3 | The same 3 |
| Items listed from the board | Not available | 8 |

The clip is 10.1 minutes long, because a video can be cut only at a key frame.

Two frames from the video, at 03:25 and 09:25, confirmed the board items, except for the line at 03:13, which merged later writing and dropped a term.
