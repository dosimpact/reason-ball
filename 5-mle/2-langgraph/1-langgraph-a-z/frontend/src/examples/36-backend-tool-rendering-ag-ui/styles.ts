

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
    border: "1px solid #cbd7e3",
    borderRadius: "8px",
    padding: "16px",
    background: "#ffffff",
    color: "#17202a",
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
  status: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    border: "1px solid #d8dee8",
    borderRadius: "999px",
    padding: "4px 8px",
    fontSize: "12px",
    textTransform: "capitalize" as const,
  },
  metrics: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: "8px",
  },
  metric: {
    border: "1px solid #e4e9ef",
    borderRadius: "8px",
    padding: "10px",
    background: "#f9fbfd",
  },
  table: {
    display: "grid",
    gap: "8px",
  },
  row: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr 0.7fr 0.7fr",
    gap: "8px",
    alignItems: "center",
    borderTop: "1px solid #edf1f5",
    paddingTop: "8px",
    fontSize: "13px",
  },
};
