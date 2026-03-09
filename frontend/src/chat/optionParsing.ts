import type { OptionField, PromptOptions } from "../types";

export type ParseResult =
  | { ok: true; nextOptions: PromptOptions }
  | { ok: false; error: string };

function normalizeText(s: string): string {
  return s.trim().toLowerCase();
}

export function promptForField(field: OptionField): string {
  switch (field) {
    case "duration_seconds":
      return "What duration would you like for the video (in seconds)?";
    case "language":
      return "What language should the video be in?";
    case "platform":
      return "Which platform is this for?";
    case "size":
      return "What size/aspect ratio do you want?";
    case "category":
      return "Which category best fits this video?";
  }
}

export function quickRepliesForField(
  field: OptionField,
): Array<{ id: string; label: string; value: string }> {
  switch (field) {
    case "platform":
      return [
        { id: "youtube", label: "YouTube", value: "youtube" },
        { id: "instagram", label: "Instagram", value: "instagram" },
        { id: "tiktok", label: "TikTok", value: "tiktok" },
        { id: "facebook", label: "Facebook", value: "facebook" },
        { id: "generic", label: "Generic", value: "generic" },
      ];
    case "size":
      return [
        { id: "vertical", label: "Vertical (9:16)", value: "vertical" },
        { id: "landscape", label: "Landscape (16:9)", value: "landscape" },
        { id: "square", label: "Square (1:1)", value: "square" },
      ];
    case "category":
      return [
        { id: "kids", label: "Kids", value: "kids" },
        { id: "education", label: "Education", value: "education" },
        { id: "marketing", label: "Marketing", value: "marketing" },
        { id: "storytelling", label: "Storytelling", value: "storytelling" },
        { id: "generic", label: "Generic", value: "generic" },
      ];
    default:
      return [];
  }
}

export function applyFieldAnswer(
  prev: PromptOptions,
  field: OptionField,
  rawAnswer: string,
): ParseResult {
  const answer = normalizeText(rawAnswer);
  if (!answer) return { ok: false, error: "Please provide a value." };

  if (field === "duration_seconds") {
    const match = answer.match(/\d+/);
    const value = match ? Number(match[0]) : NaN;
    if (!Number.isFinite(value)) {
      return { ok: false, error: "Please enter a number of seconds (e.g. 30)." };
    }
    const clamped = Math.max(1, Math.min(3600, Math.trunc(value)));
    return { ok: true, nextOptions: { ...prev, duration_seconds: clamped } };
  }

  if (field === "language") {
    const lang = rawAnswer.trim();
    if (lang.length < 2) return { ok: false, error: "Language looks too short." };
    return { ok: true, nextOptions: { ...prev, language: normalizeText(lang) } };
  }

  if (field === "platform") {
    const v =
      answer.includes("you") || answer.includes("yt")
        ? "youtube"
        : answer.includes("insta") || answer.includes("ig")
          ? "instagram"
          : answer.includes("tik")
            ? "tiktok"
            : answer.includes("face")
              ? "facebook"
              : answer.includes("gen")
                ? "generic"
                : null;
    if (!v) return { ok: false, error: "Pick: youtube, instagram, tiktok, facebook, or generic." };
    return { ok: true, nextOptions: { ...prev, platform: v as PromptOptions["platform"] } };
  }

  if (field === "size") {
    const v =
      answer.includes("vert") || answer.includes("9:16") || answer.includes("short")
        ? "vertical"
        : answer.includes("land") || answer.includes("16:9") || answer.includes("wide")
          ? "landscape"
          : answer.includes("square") || answer.includes("1:1")
            ? "square"
            : null;
    if (!v) return { ok: false, error: "Pick: vertical, landscape, or square." };
    return { ok: true, nextOptions: { ...prev, size: v as PromptOptions["size"] } };
  }

  if (field === "category") {
    const v =
      answer.includes("kid")
        ? "kids"
        : answer.includes("edu")
          ? "education"
          : answer.includes("mark")
            ? "marketing"
            : answer.includes("story")
              ? "storytelling"
              : answer.includes("gen")
                ? "generic"
                : null;
    if (!v) return { ok: false, error: "Pick: kids, education, marketing, storytelling, or generic." };
    return { ok: true, nextOptions: { ...prev, category: v as PromptOptions["category"] } };
  }

  return { ok: false, error: "Unsupported field." };
}

