# Spike: lesson summary from a recorded video (F4)

Hands-on test for the tools report: which way turns a recorded lesson in Hebrew into a transcript that tells the teacher from the students, and does sending the picture add anything over sound alone?

## Ways tested

| Way | Transcript from | Script | License |
|---|---|---|---|
| 1 | Whisper large-v3-turbo, run by faster-whisper on our CPU | `spike_video_summary.py` | MIT |
| 2 | ivrit-ai/whisper-large-v3-turbo-ct2, the same model retrained on Hebrew | `spike_video_summary.py` | Apache-2.0 |
| 3 | Sound sent directly to `gemini-3.5-flash` | `spike_gemini_audio.py` | Google service |
| 4 | Sound sent directly to `gemini-3.5-flash-lite` | `spike_gemini_audio.py` | Google service |
| 5 | Sound sent to `gemini-3.6-flash` through the server's own LLM layer | `compare.mts` | Google service |
| 6 | Full video sent to `gemini-3.6-flash` through the server's own LLM layer | `compare.mts` | Google service |

In every way Gemini then analyses the transcript into a summary, topics, the teacher's points and the students' questions.

## Test data (never committed)

A public recording of a probability tutorial in Hebrew, with a noisy start and real student questions: YouTube `pDytL-qHShg`. Ways 1 to 4 use minutes 0 to 20, and ways 5 and 6 use minutes 5 to 15.

The transcripts and summaries hold the words of real students, so they stay on the computer. Only the numbers in [results/](results/) are committed.

## Run

Needs `GEMINI_API_KEY` in the environment. `gemini-3.5-flash` is no longer listed on Google's pricing page, so ways 3 and 4 may stop working.

```sh
python -m venv venv
venv/Scripts/pip install -r requirements.txt
mkdir media

# Ways 1 and 2 (for way 2 add: --model ivrit-ai/whisper-large-v3-turbo-ct2)
venv/Scripts/python spike_video_summary.py --url "https://www.youtube.com/watch?v=pDytL-qHShg" \
  --start 0 --minutes 20 --gemini-models gemini-3.5-flash --downloads downloads --out out/way1

# Ways 3 and 4 (for way 4 use gemini-3.5-flash-lite)
venv/Scripts/python spike_gemini_audio.py --audio downloads/pDytL-qHShg.m4a \
  --start 0 --minutes 20 --gemini-models gemini-3.5-flash --out out/way3

# Ways 5 and 6: cut the same 10 minutes as video and as sound, then run both
venv/Scripts/yt-dlp -f 136 -o media/video.mp4 "https://www.youtube.com/watch?v=pDytL-qHShg"
venv/Scripts/python make_clip.py media/video.mp4 downloads/pDytL-qHShg.m4a 5 10 media
cd ../../server
npx tsx ../spikes/lesson-summary/compare.mts "$PWD" ../spikes/lesson-summary/media ../spikes/lesson-summary/out

# Pull frames from the clip, to compare the board list with the video
cd ../spikes/lesson-summary
venv/Scripts/python frames.py media/clip.mp4 media 03:25 09:25
```

## Results

See [results/summary.md](results/summary.md).
