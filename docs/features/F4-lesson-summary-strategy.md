# F4 Lesson summary: approach and decisions

What the team agreed about the lesson video summary, before writing its documents.
Agreed on 2026-11-08. This note feeds the video summary requirements in the SRS (F4), its use case, its EDD and the speech and video section of the tools report.

## 1. The idea

After a lesson, the teacher uploads its recording. The app creates a summary automatically, and everyone linked to the lesson opens it from the forum of that lesson date.

## 2. What we agreed

1. **A button in the forum.** The forum of each lesson date has a button that leads to the lesson's summary page.
2. **When the page opens.** Only after the lesson, and only after the teacher has uploaded the recording.
3. **The source.** The model works from the full video, picture and sound. Sound alone is the fallback when the file is too large or a usage limit is reached.
4. **The page has four parts:**
   - a summary of the lesson of up to 300 words;
   - the topics in order, each with the time it started;
   - the students' questions with the teacher's answers;
   - the formulas and other content from the board.
5. **How it is made.** The model first writes the transcript with speaker labels and the list of what was on the board. It then writes the four parts from them.
6. **Second review.** Finally the model goes over the whole summary against the transcript and the board list, mainly to catch spelling mistakes and garbled copying, and corrects them. It corrects only what the source supports and adds no new content.
7. **Teacher corrections.** The teacher can upload the recording again to create a new summary, and can edit the summary's text by hand.
8. **The recording is deleted** once the summary is ready. The page does not show the video.

## 3. What the tests showed

All tests used a recorded lesson in Hebrew with real student questions. Text quality was judged by reading it, not by comparing it with the recording. The full results are in the [tools report](../02-tools-report.md).

**Ways of working from sound, 20 minutes, 2026-11-06:**

| Way | Time | Result |
|-----|------|--------|
| Open Whisper model on a laptop CPU, then Gemini | about 23 min | Many wrong terms, invented foreign words, no speaker labels |
| Its Hebrew version from ivrit.ai, then Gemini | about 19 min | Better terms, no invented words, no speaker labels |
| Sound sent directly to `gemini-3.5-flash` | about 2 min | Cleanest Hebrew, with speaker labels |
| Sound sent directly to `gemini-3.5-flash-lite` | 45 s | Missed student questions |

**Sound against full video, 10 minutes, `gemini-3.6-flash`, 2026-11-08:**

| | Sound only | Full video |
|---|------------|------------|
| Processing time | 2 min 9 s | 2 min 21 s |
| Total tokens | about 32,000 | about 76,000 |
| Student questions found | 3 | the same 3 |

Full video also listed the formulas on the board. Checked against frames from the video they were correct, except for one line that merged later writing and dropped a term. It also labeled one student's sentence correctly where sound alone gave it to the teacher. The written summaries came out almost the same. This is one clip, from one subject, with a clear board.

## 4. Still open

- **A fallback model.** `gemini-3.8-flash` was overloaded on all six tries in the first test, so the feature needs retries and a second model.
- **Length.** The target for the pilot is a recording of about 10 minutes. A full lesson was not tested.
