

export const styles = {
  surface: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(0, 1fr)",
    background: "#f6f7f9",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
  },
  chatPanel: {
    minHeight: "640px",
  },
  card: {
    display: "grid",
    gap: "14px",
    border: "1px solid #d9c9a7",
    borderRadius: "8px",
    padding: "18px",
    color: "#1d2b2a",
    boxShadow: "0 8px 24px rgba(20, 35, 52, 0.08)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
  },
  mood: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid currentColor",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    textTransform: "capitalize" as const,
  },
  poem: {
    display: "grid",
    gap: "8px",
    fontSize: "18px",
    lineHeight: 1.5,
  },
  fallback: {
    border: "1px dashed #cbd7e3",
    borderRadius: "8px",
    padding: "12px",
    background: "#ffffff",
    color: "#5f6b7a",
  },
};
