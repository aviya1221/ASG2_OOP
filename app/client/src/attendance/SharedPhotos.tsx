import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.ts";

/** The class photo the teacher shared, with a number on every face. */
export interface SharedPhoto {
  photoNo: number;
  filePath: string;
  expiresAt: Date;
  removed: boolean;
}

export async function loadSharedPhotos(lessonId: string): Promise<SharedPhoto[]> {
  const { data } = await supabase.from("shared_photos").select("photo_no, file_path, expires_at, file_removed").eq("lesson_id", lessonId).order("photo_no");
  return (data ?? []).map((row) => ({ photoNo: row.photo_no, filePath: row.file_path, expiresAt: new Date(row.expires_at), removed: row.file_removed }));
}

export function timeOf(date: Date): string {
  return date.toLocaleString("he-IL", { weekday: "long", hour: "2-digit", minute: "2-digit" });
}

/** The shared class photo. A tap opens the full photo, so a face can be enlarged. */
export function SharedPhotoList({ photos }: { photos: SharedPhoto[] }) {
  const [urls, setUrls] = useState<string[]>([]);
  const paths = photos.filter((photo) => !photo.removed).map((photo) => photo.filePath);
  const joined = paths.join(",");

  useEffect(() => {
    if (!joined) return;
    void supabase.storage
      .from("class-photos")
      .createSignedUrls(joined.split(","), 3_600)
      .then(({ data }) => setUrls((data ?? []).map((item) => item.signedUrl ?? "")));
  }, [joined]);

  return (
    <div className="class-photos">
      {urls.map((url, index) =>
        url ? (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            <img src={url} alt={`תמונת הכיתה ${index + 1} עם מספרים`} />
          </a>
        ) : null,
      )}
    </div>
  );
}
