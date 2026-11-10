import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import { FfmpegSoundExtractor } from "../../src/summaries/SoundExtractor.ts";

const run = promisify(execFile);
const ffmpeg = ffmpegPath as unknown as string;

describe("FfmpegSoundExtractor", () => {
  it("TC-084 writes the sound track of a short video to its own file", async () => {
    const video = join(tmpdir(), `clip-${Date.now()}.mp4`);
    await run(ffmpeg, ["-y", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=2", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-shortest", "-c:v", "libx264", "-c:a", "aac", video]);

    const sound = await new FfmpegSoundExtractor().extract(video);
    try {
      assert.ok(existsSync(sound) && statSync(sound).size > 0);
      const probe = await run(ffmpeg, ["-i", sound]).catch((error: { stderr: string }) => error);
      assert.match(probe.stderr, /Audio: aac/);
      assert.doesNotMatch(probe.stderr, /Video:/);
    } finally {
      await rm(video, { force: true });
      await rm(sound, { force: true });
    }
  });
});
