import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { App } from "./App";
import * as api from "./api";

describe("Prompt workflow page", () => {
  it("extracts options and allows editing", async () => {
    vi.spyOn(api, "extractOptions").mockResolvedValue({
      run_id: "c8b5f1a6-6a16-4df8-a00b-68f2f98a6610",
      options: {
        duration_seconds: 30,
        language: "english",
        platform: "youtube",
        size: "vertical",
        category: "kids",
      },
      missing_fields: [],
    });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Create a 30 second kids/ }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("30")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "arabic" } });
    expect(screen.getByDisplayValue("arabic")).toBeInTheDocument();
  });

  it("generates script after enhance", async () => {
    vi.spyOn(api, "extractOptions").mockResolvedValue({
      run_id: "c8b5f1a6-6a16-4df8-a00b-68f2f98a6610",
      options: {
        duration_seconds: null,
        language: null,
        platform: null,
        size: null,
        category: null,
      },
      missing_fields: ["duration_seconds"],
    });
    vi.spyOn(api, "enhancePrompt").mockResolvedValue("Enhanced prompt text");
    vi.spyOn(api, "generateVideoScript").mockResolvedValue(
      "Scene 1:\nVisuals: Test.\nNarration: Voice.\nMood: Calm.\nCinematic: Wide shot.",
    );

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Create a 30 second kids/ }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() =>
      expect(screen.getByText(/what duration would you like/i)).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Message input"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    fireEvent.change(screen.getByLabelText("Language"), { target: { value: "english" } });
    fireEvent.change(screen.getByLabelText("Platform"), { target: { value: "youtube" } });
    fireEvent.change(screen.getByLabelText("Size"), { target: { value: "vertical" } });
    fireEvent.change(screen.getByLabelText("Category"), { target: { value: "kids" } });

    await waitFor(() =>
      expect(screen.getByText(/Enhanced prompt text/)).toBeInTheDocument(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: /use enhanced & generate/i }),
    );

    await waitFor(() => expect(screen.getByText(/Scene 1/)).toBeInTheDocument());
  });
});
