/**
 * Parses raw script text into scene cards.
 * Handles:
 * - "Scene 1:\nVisuals: ...\nNarration: ...\nMood: ...\nCinematic: ..."
 * - Groq-style "**Scene 1: Title**\n* Visual direction: ...\n* Narration (English): ...\n* Mood: ...\n* Camera/shot cues: ...\n* Transition: ..."
 */
export type ParsedScene = {
  title: string;
  visuals: string;
  narration: string;
  mood: string;
  cinematicDirection: string;
};

// Only split at line-start "Scene N" so "Cut from Scene 2" in transition text doesn't create extra scenes
const SCENE_SPLIT = /(?=\n\s*\*{0,2}Scene\s+\d+\s*:?)/i;

// Boundary: next bullet label or next scene header (stops capture for getLabelContent)
const NEXT_LABEL_OR_SCENE =
  /\n\s*(?:\*\s+(?:Visuals?|Visual direction|Narration|Mood|Camera\/shot cues|Transition|Cinematic)|\*\*Scene\s+\d+)/i;

function getLabelContent(block: string, labelPattern: RegExp): string {
  const match = block.match(labelPattern);
  if (!match || match.index == null) return "";
  const start = match.index + match[0].length;
  const rest = block.slice(start);
  const nextMatch = rest.match(NEXT_LABEL_OR_SCENE);
  const end = nextMatch ? nextMatch.index! : rest.length;
  return rest.slice(0, end).trim();
}

function parseBlock(block: string, sceneIndex: number): ParsedScene {
  const title = `Scene ${sceneIndex}`;
  // Strip optional **Scene N: Title** or Scene N: header line
  const body = block.replace(/^\s*\*{0,2}Scene\s+\d+\s*:?\s*[^\n]*/i, "").trim();

  const visuals =
    getLabelContent(body, /\n?\s*(?:Visuals?|Visual direction):\s*/i) || "";
  const narration =
    getLabelContent(
      body,
      /\n?\s*Narration(?:\s*\([^)]*\))?:\s*/i
    ) || "";
  const mood = getLabelContent(body, /\n?\s*Mood:\s*/i) || "";

  const cameraCues = getLabelContent(
    body,
    /\n?\s*Camera\/shot cues?:\s*/i
  );
  const transition = getLabelContent(body, /\n?\s*Transition:\s*/i);
  const cinematicExplicit =
    getLabelContent(body, /\n?\s*Cinematic(?:\s+Direction)?:\s*/i) || "";
  const cinematicDirection = [cinematicExplicit, cameraCues, transition]
    .filter(Boolean)
    .join(" ") || "";

  return {
    title,
    visuals: visuals || "—",
    narration: narration || "—",
    mood: mood || "—",
    cinematicDirection: cinematicDirection || "—",
  };
}

export function parseScriptToScenes(raw: string): ParsedScene[] {
  if (!raw.trim()) return [];

  const parts = raw
    .split(SCENE_SPLIT)
    .map((p) => p.trim())
    .filter((p) => /^\s*\*{0,2}Scene\s+\d+/i.test(p));
  const scenes: ParsedScene[] = [];

  for (let i = 0; i < parts.length; i++) {
    const block = parts[i];
    if (!block) continue;
    scenes.push(parseBlock(block, i + 1));
  }

  if (scenes.length > 0) return scenes;

  return [
    {
      title: "Script",
      visuals: "—",
      narration: raw.trim(),
      mood: "—",
      cinematicDirection: "—",
    },
  ];
}
