export type OptionField = "duration_seconds" | "language" | "platform" | "size" | "category";

export type PromptOptions = {
  duration_seconds: number | null;
  language: string | null;
  platform: "youtube" | "instagram" | "tiktok" | "facebook" | "generic" | null;
  size: "landscape" | "vertical" | "square" | null;
  category: "kids" | "education" | "marketing" | "storytelling" | "generic" | null;
};

export type ExtractOptionsResponse = {
  run_id: string;
  options: PromptOptions;
  missing_fields: OptionField[];
};
