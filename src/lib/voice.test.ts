import { describe, expect, it } from "vitest";
import {
  extForAudioType,
  isAllowedAudioType,
  voiceDisplayName,
} from "@/lib/voice";

describe("voiceDisplayName", () => {
  it("uses the user's title when it has content", () => {
    expect(voiceDisplayName("Standup notes", "Voice note 1")).toBe(
      "Standup notes",
    );
  });

  it("falls back when the title is only whitespace", () => {
    expect(voiceDisplayName("   ", "Voice note 2")).toBe("Voice note 2");
  });

  it("falls back on null or undefined", () => {
    expect(voiceDisplayName(null, "Voice note 3")).toBe("Voice note 3");
    expect(voiceDisplayName(undefined, "Voice note 4")).toBe("Voice note 4");
  });
});

describe("isAllowedAudioType", () => {
  it("accepts allowlisted types, ignoring codec params and case", () => {
    expect(isAllowedAudioType("audio/webm;codecs=opus")).toBe(true);
    expect(isAllowedAudioType("AUDIO/OGG")).toBe(true);
    expect(isAllowedAudioType("audio/mp4")).toBe(true);
  });

  it("rejects anything not on the allowlist", () => {
    expect(isAllowedAudioType("video/mp4")).toBe(false);
    expect(isAllowedAudioType("application/json")).toBe(false);
    expect(isAllowedAudioType("")).toBe(false);
  });
});

describe("extForAudioType", () => {
  it("maps known MIME types to file extensions", () => {
    expect(extForAudioType("audio/webm;codecs=opus")).toBe("webm");
    expect(extForAudioType("audio/ogg")).toBe("ogg");
    expect(extForAudioType("audio/mpeg")).toBe("mp3");
    expect(extForAudioType("audio/x-wav")).toBe("wav");
  });

  it("falls back to 'bin' for an unrecognised type", () => {
    expect(extForAudioType("audio/weird")).toBe("bin");
  });
});
