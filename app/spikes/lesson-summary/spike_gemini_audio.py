"""Spike F4, way 3: send the audio itself to Gemini (no local transcription).

Step 1: cut N minutes of the downloaded audio and save as 16 kHz mono WAV.
Step 2: upload to the Gemini Files API and ask for a verbatim Hebrew transcript
        with speaker labels (lecturer / student) and mm:ss times.
Step 3: run the SAME analysis step as way 1/2 on that transcript, so the
        summaries can be compared fairly.
"""
import argparse
import json
import sys
import time
import wave
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))  # our own sibling module only
from spike_video_summary import analyse, load_audio, to_markdown  # noqa: E402
from pydantic import BaseModel  # noqa: E402

sys.stdout.reconfigure(encoding="utf-8")

TRANSCRIBE_PROMPT = """Transcribe the attached recording of a university class in Hebrew, word for word, in Hebrew.
Return the COMPLETE transcript of the whole recording as a list of utterances, in order.
Rules:
- time: mm:ss from the start of this recording.
- speaker: "מרצה" for the person teaching, or "סטודנט" for anyone else.
- text: exactly what was said. Do not summarise, do not translate, do not fix grammar.
- Write [לא ברור] for parts you cannot understand. Skip silence and pure noise."""


class Utterance(BaseModel):
    time: str
    speaker: str
    text: str


def save_wav(path: Path, samples, sr: int = 16000):
    import numpy as np

    pcm = (np.clip(samples, -1, 1) * 32767).astype("<i2")
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(pcm.tobytes())


def gemini_transcribe(wav: Path, models: list[str]):
    from google import genai
    from google.genai import errors, types

    client = genai.Client()
    t0 = time.time()
    f = client.files.upload(file=str(wav), config={"mime_type": "audio/wav"})
    while f.state and f.state.name == "PROCESSING":
        time.sleep(2)
        f = client.files.get(name=f.name)
    upload_sec = time.time() - t0
    print(f"[gemini-audio] uploaded {wav.stat().st_size / 1e6:.1f} MB in {upload_sec:.0f}s")

    failed = []
    try:
        for model in models:
            for attempt in range(1, 4):
                t1 = time.time()
                try:
                    resp = client.models.generate_content(
                        model=model, contents=[TRANSCRIBE_PROMPT, f],
                        config=types.GenerateContentConfig(
                            temperature=0, max_output_tokens=32768,
                            response_mime_type="application/json",
                            response_schema=list[Utterance]))
                except errors.APIError as e:
                    failed.append(f"{model} try {attempt}: {e.code}")
                    print(f"[gemini-audio] {model} failed ({e.code}), try {attempt}/3")
                    if e.code not in (429, 500, 503):
                        break
                    time.sleep(10 * attempt)
                    continue
                sec = time.time() - t1
                u = resp.usage_metadata
                print(f"[gemini-audio] {model} transcribed in {sec:.0f}s, "
                      f"tokens in={u.prompt_token_count} out={u.candidates_token_count} "
                      f"thinking={u.thoughts_token_count}")
                lines = [f"[{x.time}] {x.speaker}: {x.text}" for x in (resp.parsed or [])]
                return lines, {"transcribe_model": model, "upload_seconds": round(upload_sec, 1),
                               "transcribe_seconds": round(sec, 1),
                               "transcribe_tokens_in": u.prompt_token_count,
                               "transcribe_tokens_out": u.candidates_token_count,
                               "finish_reason": str(resp.candidates[0].finish_reason),
                               "transcribe_failed_attempts": failed}
        raise RuntimeError(f"all Gemini models failed: {failed}")
    finally:
        client.files.delete(name=f.name)  # do not leave the class audio on Google's side


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--audio", required=True, help="already-downloaded audio file")
    p.add_argument("--start", type=float, default=0)
    p.add_argument("--minutes", type=float, default=20)
    p.add_argument("--gemini-models", required=True)
    p.add_argument("--out", required=True)
    a = p.parse_args()

    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    models = a.gemini_models.split(",")

    sr = 16000
    audio = load_audio(Path(a.audio), sr)
    clip = audio[int(a.start * 60 * sr): int((a.start + a.minutes) * 60 * sr)]
    wav = out / "clip.wav"
    save_wav(wav, clip, sr)

    t0 = time.time()
    lines, m1 = gemini_transcribe(wav, models)
    (out / "transcript.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    result, m2 = analyse(lines, models)
    total = time.time() - t0
    (out / "result.json").write_text(result.model_dump_json(indent=2), encoding="utf-8")
    (out / "result.md").write_text(to_markdown(result, a.audio), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps(
        {"clip_minutes": round(len(clip) / sr / 60, 2), **m1, **m2,
         "total_seconds": round(total, 1)}, indent=2), encoding="utf-8")
    wav.unlink()
    print(f"[done] total {total:.0f}s, outputs in {out}")


if __name__ == "__main__":
    main()
