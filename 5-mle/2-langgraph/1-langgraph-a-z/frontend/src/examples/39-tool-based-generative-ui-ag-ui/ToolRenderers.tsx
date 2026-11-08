import { Feather, Loader2, Palette } from "lucide-react";
import { z } from "zod";
import { normalizeHaiku, generateHaikuCardParameters } from "./model";
import { styles } from "./styles";

export function HaikuCard({ result }: { result: unknown }) {
  const parsed = normalizeHaiku(result);
  const lines = parsed.lines ?? [];
  const palette = parsed.palette ?? {};
  const background = palette.background ?? "#f7efe2";
  const accent = palette.accent ?? "#256f68";
  const text = palette.text ?? "#1d2b2a";

  if (lines.length === 0) {
    return (
      <div style={styles.fallback} data-testid="haiku-card-fallback">
        Tool returned an incomplete haiku payload.
      </div>
    );
  }

  return (
    <div
      style={{ ...styles.card, background, color: text }}
      data-testid="tool-based-generative-haiku-card"
    >
      <div style={styles.header}>
        <div style={styles.title}>
          <Feather aria-hidden="true" size={18} color={accent} />
          {parsed.topic ?? "Generated haiku"}
        </div>
        <span style={{ ...styles.mood, color: accent }}>
          <Palette aria-hidden="true" size={14} />
          {parsed.mood ?? "calm"}
        </span>
      </div>
      <div style={styles.poem}>
        {lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
      <span>{parsed.explanation ?? "Generated from a backend tool payload."}</span>
    </div>
  );
}

export function GenerateHaikuCardRenderer({ parameters, result, status }: { parameters: Partial<z.infer<typeof generateHaikuCardParameters>>; result: unknown; status: string }) {
  if (status !== "complete") {
    return (
      <div style={{ ...styles.card, background: "#ffffff" }} data-testid="haiku-card-loading">
        <div style={styles.title}>
          <Loader2 aria-hidden="true" size={18} />
          Generating haiku card
        </div>
        <span>{parameters.topic}</span>
      </div>
    );
  }

  return <HaikuCard result={result} />;
}
