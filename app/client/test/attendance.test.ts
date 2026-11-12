import { beforeEach, describe, expect, it, vi } from "vitest";
import { respondToOpenRounds } from "../src/attendance/AttendanceResponder.ts";
import { sheetCells, type SheetRow } from "../src/attendance/AttendanceSheet.ts";
import { FaceStore, hashOfPrint } from "../src/attendance/FaceStore.ts";
import { countFaces, numberUnknownFaces } from "../src/attendance/numberedPhoto.ts";

const mocks = vi.hoisted(() => ({ rounds: [] as { lesson_id: string }[], results: [] as { lesson_id: string }[], callServer: vi.fn() }));

vi.mock("../src/lib/server.ts", () => ({ callServer: mocks.callServer }));
vi.mock("write-excel-file/browser", () => ({ default: vi.fn() }));
vi.mock("../src/lib/supabase.ts", () => {
  const query = (rows: () => unknown[]) => ({
    select: () => ({
      gt: async () => ({ data: rows() }),
      eq: () => ({ in: async () => ({ data: rows() }) }),
    }),
  });
  return {
    supabase: {
      from: (table: string) => query(() => (table === "attendance_rounds" ? mocks.rounds : mocks.results)),
    },
  };
});

const S1 = "300000001";

beforeEach(() => {
  localStorage.clear();
  mocks.rounds = [];
  mocks.results = [];
  mocks.callServer.mockReset().mockResolvedValue({ result: "present" });
});

describe("FaceStore", () => {
  it("TC-010 returns what was saved, unchanged", () => {
    const print = Float32Array.from({ length: 128 }, (_, i) => i / 128);
    FaceStore.save(S1, print, "abc");
    const stored = FaceStore.load(S1)!;
    expect(Float32Array.from(stored.print)).toEqual(print);
    expect(stored.hash).toBe("abc");
  });

  it("returns nothing for a student with no face-print on this phone", () => {
    expect(FaceStore.load("300000002")).toBeNull();
  });
});

describe("hashOfPrint", () => {
  it("gives the SHA-256 of the bytes, as the server calculates it", async () => {
    const hash = await hashOfPrint(new Float32Array(128));
    expect(hash).toBe("076a27c79e5ace2a3d47f9dd2e83e4ff6ea8872b3c2218f66c92b89b55f36560");
  });
});

describe("respondToOpenRounds", () => {
  function saveFace() {
    FaceStore.save(S1, new Float32Array(128), "hash-1");
  }

  it("TC-017 sends one response for each open round with no result", async () => {
    saveFace();
    mocks.rounds = [{ lesson_id: "L1" }, { lesson_id: "L2" }];
    mocks.results = [{ lesson_id: "L2" }];
    await respondToOpenRounds(S1);
    expect(mocks.callServer).toHaveBeenCalledTimes(1);
    expect(mocks.callServer.mock.calls[0]![1]).toMatchObject({ lessonId: "L1", hash: "hash-1" });
  });

  it("TC-012 sends nothing when this phone has no face-print", async () => {
    mocks.rounds = [{ lesson_id: "L1" }];
    await respondToOpenRounds(S1);
    expect(mocks.callServer).not.toHaveBeenCalled();
  });

  it("carries on when a response fails", async () => {
    saveFace();
    mocks.rounds = [{ lesson_id: "L1" }];
    mocks.callServer.mockRejectedValue(new Error("no network"));
    await expect(respondToOpenRounds(S1)).resolves.toBeUndefined();
  });
});

describe("sheetCells", () => {
  const ROW: SheetRow = { idNumber: "012345678", name: "=דנה", attendance: "present", decidedBy: "row_and_seat", rowNo: 3, seatNo: 5, requestStatus: "approved", flagged: true };

  it("TC-028 gives the columns of REQ-19 as text", () => {
    const [cells] = sheetCells([ROW]);
    expect(cells).toEqual(["012345678", "=דנה", "נוכח", "שורה ומושב", "בקשה שנדחתה, או 3 בקשות ומעלה בקורס"]);
  });

  it("leaves a cell empty when there is no result yet", () => {
    const [cells] = sheetCells([{ ...ROW, attendance: null, decidedBy: null, flagged: false }]);
    expect(cells?.slice(2)).toEqual(["", "", ""]);
  });
});

describe("numberUnknownFaces", () => {
  const PHOTOS = [
    { boxes: [[300, 0, 40, 40], [10, 0, 40, 40], [150, 0, 40, 40]] },
    { boxes: [[50, 0, 40, 40], [20, 0, 40, 40]] },
  ];

  it("numbers only the faces of no present student, across the photos and left to right", () => {
    const numbers = numberUnknownFaces(PHOTOS, [{ photoNo: 0, faceNo: 2 }, { photoNo: 1, faceNo: 0 }]);
    expect(numbers.map((item) => [item.number, item.photoNo, item.faceNo])).toEqual([
      [1, 0, 1],
      [2, 0, 0],
      [3, 1, 1],
    ]);
    expect(numbers[0]!.box).toEqual([10, 0, 40, 40]);
  });

  it("counts every face, the faces of present students and the others", () => {
    const numbers = numberUnknownFaces(PHOTOS, [{ photoNo: 0, faceNo: 2 }]);
    expect(countFaces(PHOTOS, numbers)).toEqual({ total: 5, identified: 1, unknown: 4 });
    expect(numberUnknownFaces(PHOTOS, PHOTOS.flatMap((photo, photoNo) => photo.boxes.map((_, faceNo) => ({ photoNo, faceNo }))))).toEqual([]);
  });
});
