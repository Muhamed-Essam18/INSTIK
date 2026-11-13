import { describe, expect, it } from "vitest";
import { FILE_SIZE_MESSAGE, FILE_TYPE_MESSAGE, checkFile, formatBytes } from "@/lib/creator/file-rules";
import { MAX_UPLOAD_BYTES } from "@/lib/creator/limits";

const file = (name: string, size: number, type: string) => ({ name, size, type });

describe("checkFile", () => {
  it("accepts MP4 and MOV, whatever the case of the extension", () => {
    expect(checkFile(file("visiting-grandma.mp4", 5e8, "video/mp4"))).toEqual({ ok: true });
    expect(checkFile(file("TRIP.MOV", 5e8, "video/quicktime"))).toEqual({ ok: true });
  });

  it("lets the extension decide when the system gives no type", () => {
    expect(checkFile(file("clip.mov", 5e8, ""))).toEqual({ ok: true });
  });

  it("refuses other types by extension or by declared type", () => {
    expect(checkFile(file("notes.pdf", 1000, "application/pdf"))).toEqual({ ok: false, reason: "type", message: FILE_TYPE_MESSAGE });
    expect(checkFile(file("clip.avi", 1000, "video/x-msvideo"))).toEqual({ ok: false, reason: "type", message: FILE_TYPE_MESSAGE });
    expect(checkFile(file("clip.mp4", 1000, "image/png"))).toEqual({ ok: false, reason: "type", message: FILE_TYPE_MESSAGE });
    expect(checkFile(file("mp4", 1000, "video/mp4"))).toEqual({ ok: false, reason: "type", message: FILE_TYPE_MESSAGE });
  });

  it("accepts exactly 4 GB and refuses one byte more, before any upload starts", () => {
    expect(MAX_UPLOAD_BYTES).toBe(4 * 1024 ** 3);
    expect(checkFile(file("big.mp4", MAX_UPLOAD_BYTES, "video/mp4"))).toEqual({ ok: true });
    expect(checkFile(file("big.mp4", MAX_UPLOAD_BYTES + 1, "video/mp4"))).toEqual({ ok: false, reason: "size", message: FILE_SIZE_MESSAGE });
  });
});

describe("formatBytes", () => {
  it("shows GB from one gigabyte up and whole MB below", () => {
    expect(formatBytes(1.5 * 1024 ** 3)).toBe("1.5 GB");
    expect(formatBytes(340 * 1024 ** 2)).toBe("340 MB");
    expect(formatBytes(10)).toBe("1 MB");
  });
});
