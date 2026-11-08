"""Spike F4: class video -> transcript (open-source Whisper) -> Gemini summary.

Steps:
  1. Download only the audio track of a YouTube video (yt-dlp, no ffmpeg needed).
  2. Cut a window of N minutes and transcribe it locally with faster-whisper (CPU).
  3. Send the transcript to Gemini and ask for: lecturer explanations,
     student questions + answers, topic overview and a summary (JSON).
Outputs go to --out: transcript.txt, result.json, result.md, metrics.json.
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

from pydantic import BaseModel, Field

sys.stdout.reconfigure(encoding="utf-8")


# ---------- Gemini output schema ----------
class Topic(BaseModel):
    title: str
    start: str = Field(description="mm:ss where the topic starts")
    summary: str


class LecturerPoint(BaseModel):
    time: str = Field(description="mm:ss")
    point: str


class StudentQuestion(BaseModel):
    time: str = Field(description="mm:ss")
    question: str = Field(description="the student's question, cleaned up")
    answer: str = Field(description="the lecturer's answer, summarised")


class LectureAnalysis(BaseModel):
    summary: str = Field(description="short summary of the whole segment")
    topics: list[Topic]
    lecturer_points: list[LecturerPoint]
    student_questions: list[StudentQuestion]
    transcription_issues: list[str] = Field(
        description="words or passages that look badly transcribed")


PROMPT = """You get an automatic transcript of a recorded university lecture in Hebrew.
Each line is "[mm:ss] text". The transcript has NO speaker labels and may contain
recognition errors. Mostly the lecturer speaks; sometimes a student asks a question
and the lecturer answers.

Tasks:
1. Separate the lecturer's explanations from student questions. Detect a student
   question by its content (a question addressed to the lecturer, followed by an
   answer). For each student question give its time, the question and the answer.
2. List the topics covered, in order, with start time and a short summary.
3. Give the main points the lecturer explained, with times.
4. Write a short summary of the whole segment.
5. List words or passages that look badly transcribed.

Write all text values in Hebrew. Do not invent content that is not in the transcript.

Transcript:
"""


def fmt(sec: float) -> str:
    sec = int(sec)
    return f"{sec // 60:02d}:{sec % 60:02d}"


def download_audio(url: str, dl_dir: Path) -> Path:
    import yt_dlp

    dl_dir.mkdir(parents=True, exist_ok=True)
    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio",
        "outtmpl": str(dl_dir / "%(id)s.%(ext)s"),
        "quiet": True,
        "noprogress": True,
        "noplaylist": True,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=True)
        path = Path(ydl.prepare_filename(info))
    print(f"[download] {info.get('title')} ({fmt(info.get('duration') or 0)}) -> {path.name}")
    return path


def load_audio(path: Path, sr: int = 16000):
    """Decode any audio file to 16 kHz mono float32 with PyAV.

    Own version because faster-whisper 1.2.1's decode_audio passes an argument
    that PyAV 19 no longer accepts.
    """
    import av
    import numpy as np

    resampler = av.AudioResampler(format="s16", layout="mono", rate=sr)
    chunks = []
    with av.open(str(path), mode="r") as container:
        for frame in container.decode(audio=0):
            for f in resampler.resample(frame):
                chunks.append(f.to_ndarray().reshape(-1))
        for f in resampler.resample(None):
            chunks.append(f.to_ndarray().reshape(-1))
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe(audio_path: Path, start_min: float, minutes: float, model_name: str):
    from faster_whisper import WhisperModel

    sr = 16000
    audio = load_audio(audio_path, sr)
    a, b = int(start_min * 60 * sr), int((start_min + minutes) * 60 * sr)
    clip = audio[a:b]
    clip_sec = len(clip) / sr
    print(f"[transcribe] model={model_name}, clip {fmt(start_min*60)}-{fmt(start_min*60+clip_sec)} "
          f"({clip_sec/60:.1f} min), CPU threads={os.cpu_count()}")

    t0 = time.time()
    model = WhisperModel(model_name, device="cpu", compute_type="int8",
                         cpu_threads=os.cpu_count() or 4)
    load_sec = time.time() - t0

    t1 = time.time()
    segments, _ = model.transcribe(clip, language="he", vad_filter=True, beam_size=5)
    lines = []
    for s in segments:
        line = f"[{fmt(start_min*60 + s.start)}] {s.text.strip()}"
        lines.append(line)
        print("  " + line)
    tr_sec = time.time() - t1
    metrics = {
        "model": model_name,
        "clip_minutes": round(clip_sec / 60, 2),
        "model_load_seconds": round(load_sec, 1),
        "transcribe_seconds": round(tr_sec, 1),
        "realtime_factor": round(tr_sec / clip_sec, 2),
        "segments": len(lines),
    }
    print(f"[transcribe] done in {tr_sec:.0f}s (x{metrics['realtime_factor']} of audio length)")
    return lines, metrics


def analyse(lines: list[str], gemini_models: list[str]):
    """Try each model in order; retry on 'overloaded' (503) or quota (429) errors."""
    from google import genai
    from google.genai import errors, types

    client = genai.Client()  # reads GEMINI_API_KEY
    config = types.GenerateContentConfig(
        response_mime_type="application/json",
        response_schema=LectureAnalysis,
        temperature=0.2,
    )
    contents = PROMPT + "\n".join(lines)
    failed = []
    for gemini_model in gemini_models:
        for attempt in range(1, 4):
            t0 = time.time()
            try:
                resp = client.models.generate_content(
                    model=gemini_model, contents=contents, config=config)
            except errors.APIError as e:
                failed.append(f"{gemini_model} try {attempt}: {e.code}")
                print(f"[gemini] {gemini_model} failed ({e.code}), try {attempt}/3")
                if e.code not in (429, 500, 503):
                    break  # not a temporary error: move to the next model
                time.sleep(10 * attempt)
                continue
            sec = time.time() - t0
            usage = resp.usage_metadata
            print(f"[gemini] {gemini_model} answered in {sec:.0f}s, "
                  f"tokens in={usage.prompt_token_count} out={usage.candidates_token_count}")
            return resp.parsed, {"gemini_model": gemini_model, "gemini_seconds": round(sec, 1),
                                 "tokens_in": usage.prompt_token_count,
                                 "tokens_out": usage.candidates_token_count,
                                 "gemini_failed_attempts": failed}
    raise RuntimeError(f"all Gemini models failed: {failed}")


def to_markdown(r: LectureAnalysis, title: str) -> str:
    out = [f"# סיכום שיעור: {title}", "", "## סיכום", "", r.summary, "", "## נושאים", ""]
    out += [f"- **{t.start}  {t.title}**: {t.summary}" for t in r.topics]
    out += ["", "## מה המרצה הסביר", ""]
    out += [f"- {p.time}  {p.point}" for p in r.lecturer_points]
    out += ["", "## שאלות של סטודנטים", ""]
    if r.student_questions:
        for q in r.student_questions:
            out += [f"- **{q.time} שאלה:** {q.question}", f"  **תשובה:** {q.answer}"]
    else:
        out.append("לא זוהו שאלות.")
    out += ["", "## קטעים שתומללו כנראה לא נכון", ""]
    out += [f"- {x}" for x in r.transcription_issues]
    return "\n".join(out) + "\n"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", required=True)
    p.add_argument("--start", type=float, default=0, help="start minute")
    p.add_argument("--minutes", type=float, default=10)
    p.add_argument("--model", default="large-v3-turbo",
                   help="faster-whisper model name or HF repo id")
    p.add_argument("--gemini-models", required=True,
                   help="comma-separated, tried in order (fallback when overloaded)")
    p.add_argument("--downloads", required=True, help="folder for downloaded audio")
    p.add_argument("--out", required=True)
    p.add_argument("--reuse-transcript", action="store_true",
                   help="skip download + transcription, use out/transcript.txt")
    a = p.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    if a.reuse_transcript:
        lines = (out / "transcript.txt").read_text(encoding="utf-8").splitlines()
        old = out / "metrics.json"
        m1 = json.loads(old.read_text(encoding="utf-8")) if old.exists() else {}
    else:
        audio = download_audio(a.url, Path(a.downloads))
        lines, m1 = transcribe(audio, a.start, a.minutes, a.model)
        (out / "transcript.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
        (out / "metrics.json").write_text(json.dumps(m1, indent=2), encoding="utf-8")

    result, m2 = analyse(lines, a.gemini_models.split(","))
    (out / "result.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
    (out / "result.md").write_text(to_markdown(result, a.url), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps({**m1, **m2}, indent=2), encoding="utf-8")
    print(f"[done] outputs in {out}")


if __name__ == "__main__":
    main()
