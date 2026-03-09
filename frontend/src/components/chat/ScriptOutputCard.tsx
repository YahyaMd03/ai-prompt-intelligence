import { useMemo, useState } from "react";

import { parseScriptToScenes } from "../../scriptParser";

export function ScriptOutputCard(props: { script: string }) {
  const [view, setView] = useState<"scenes" | "raw">("scenes");
  const scenes = useMemo(() => parseScriptToScenes(props.script), [props.script]);
  const hasScenes = scenes.length > 1 || (scenes.length === 1 && scenes[0]?.title !== "Script");

  return (
    <div className="scriptCard" aria-label="Generated script">
      <div className="scriptCardHeader">
        <div className="scriptCardTitle">Cinematic video script</div>
        <div className="scriptCardActions">
          <button
            type="button"
            className={view === "scenes" ? "segBtn segBtn--active" : "segBtn"}
            onClick={() => setView("scenes")}
            disabled={!hasScenes}
          >
            Scenes
          </button>
          <button
            type="button"
            className={view === "raw" ? "segBtn segBtn--active" : "segBtn"}
            onClick={() => setView("raw")}
          >
            Raw
          </button>
        </div>
      </div>

      {view === "raw" || !hasScenes ? (
        <pre className="scriptRaw">{props.script.trim()}</pre>
      ) : (
        <div className="sceneList">
          {scenes.map((s, i) => (
            <article key={i} className="sceneItem" aria-label={s.title}>
              <div className="sceneTitle">{s.title}</div>
              <div className="sceneGrid">
                <div className="sceneRow">
                  <div className="sceneLabel">Visuals</div>
                  <div className="sceneValue">{s.visuals}</div>
                </div>
                <div className="sceneRow">
                  <div className="sceneLabel">Narration</div>
                  <div className="sceneValue">{s.narration}</div>
                </div>
                <div className="sceneRow">
                  <div className="sceneLabel">Mood</div>
                  <div className="sceneValue">{s.mood}</div>
                </div>
                <div className="sceneRow">
                  <div className="sceneLabel">Cinematic direction</div>
                  <div className="sceneValue">{s.cinematicDirection}</div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

