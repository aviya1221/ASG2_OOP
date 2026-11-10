import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const run = promisify(execFile);

export interface SoundExtractor {
  /** Writes the sound track of a video to a new file and returns its path. */
  extract(videoPath: string): Promise<string>;
}

/** Copies the sound track with ffmpeg, without encoding it again, so the 0.1 CPU of the free server is enough. */
export class FfmpegSoundExtractor implements SoundExtractor {
  async extract(videoPath: string): Promise<string> {
    if (!ffmpegPath) throw new Error("ffmpeg is not available on this computer");
    const soundPath = `${videoPath}.m4a`;
    try {
      await run(ffmpegPath as unknown as string, ["-y", "-i", videoPath, "-vn", "-c:a", "copy", soundPath]);
    } catch {
      // The sound of this video cannot be copied into an m4a file, so it is encoded once.
      await run(ffmpegPath as unknown as string, ["-y", "-i", videoPath, "-vn", "-c:a", "aac", "-b:a", "64k", soundPath]);
    }
    return soundPath;
  }
}
