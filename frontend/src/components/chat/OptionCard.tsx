import type { OptionField, PromptOptions } from "../../types";

function isMissing(missing: OptionField[], field: OptionField): boolean {
  return missing.includes(field);
}

export function OptionCard(props: {
  options: PromptOptions;
  missingFields: OptionField[];
  onChange: (next: PromptOptions) => void;
}) {
  const o = props.options;
  const missing = props.missingFields;

  return (
    <div className="optionCard" aria-label="Extracted parameters">
      <div className="optionCardHeader">
        <div className="optionCardTitle">Extracted parameters</div>
        <div className="optionCardSub">Edit anything inline before continuing.</div>
      </div>

      <div className="optionGrid">
        <label className={isMissing(missing, "duration_seconds") ? "optionField optionField--missing" : "optionField"}>
          <span className="optionLabel">Duration (seconds)</span>
          <input
            aria-label="Duration (seconds)"
            type="number"
            min={1}
            max={3600}
            value={o.duration_seconds ?? ""}
            onChange={(e) =>
              props.onChange({
                ...o,
                duration_seconds: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>

        <label className={isMissing(missing, "language") ? "optionField optionField--missing" : "optionField"}>
          <span className="optionLabel">Language</span>
          <input
            aria-label="Language"
            type="text"
            value={o.language ?? ""}
            onChange={(e) =>
              props.onChange({
                ...o,
                language: e.target.value.trim() ? e.target.value.trim().toLowerCase() : null,
              })
            }
          />
        </label>

        <label className={isMissing(missing, "platform") ? "optionField optionField--missing" : "optionField"}>
          <span className="optionLabel">Platform</span>
          <select
            aria-label="Platform"
            value={o.platform ?? ""}
            onChange={(e) =>
              props.onChange({
                ...o,
                platform: (e.target.value || null) as PromptOptions["platform"],
              })
            }
          >
            <option value="">—</option>
            <option value="youtube">YouTube</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="generic">Generic</option>
          </select>
        </label>

        <label className={isMissing(missing, "size") ? "optionField optionField--missing" : "optionField"}>
          <span className="optionLabel">Size</span>
          <select
            aria-label="Size"
            value={o.size ?? ""}
            onChange={(e) =>
              props.onChange({
                ...o,
                size: (e.target.value || null) as PromptOptions["size"],
              })
            }
          >
            <option value="">—</option>
            <option value="landscape">Landscape</option>
            <option value="vertical">Vertical</option>
            <option value="square">Square</option>
          </select>
        </label>

        <label className={isMissing(missing, "category") ? "optionField optionField--missing" : "optionField"}>
          <span className="optionLabel">Category</span>
          <select
            aria-label="Category"
            value={o.category ?? ""}
            onChange={(e) =>
              props.onChange({
                ...o,
                category: (e.target.value || null) as PromptOptions["category"],
              })
            }
          >
            <option value="">—</option>
            <option value="kids">Kids</option>
            <option value="education">Education</option>
            <option value="marketing">Marketing</option>
            <option value="storytelling">Storytelling</option>
            <option value="generic">Generic</option>
          </select>
        </label>
      </div>

      {missing.length ? (
        <div className="optionCardMissing" role="status" aria-live="polite">
          Missing: {missing.map((m) => m.replace("_", " ")).join(", ")}
        </div>
      ) : (
        <div className="optionCardReady" role="status" aria-live="polite">
          All set.
        </div>
      )}
    </div>
  );
}

