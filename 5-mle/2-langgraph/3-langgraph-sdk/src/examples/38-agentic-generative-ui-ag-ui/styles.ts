

export const styles = {
  shell: {
    display: "grid",
    minHeight: "640px",
    gridTemplateColumns: "minmax(360px, 0.9fr) minmax(0, 1.1fr)",
    border: "1px solid #d8dee8",
    borderRadius: "8px",
    overflow: "hidden",
    background: "#f6f7f9",
  },
  preview: {
    display: "grid",
    alignContent: "start",
    gap: "14px",
    borderRight: "1px solid #d8dee8",
    padding: "18px",
    background: "#ffffff",
  },
  chat: {
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
  },
  title: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontWeight: 700,
  },
  progressTrack: {
    height: "10px",
    borderRadius: "999px",
    overflow: "hidden",
    background: "#e8edf3",
  },
  progressFill: {
    height: "100%",
    borderRadius: "999px",
    background: "#2f7d62",
  },
  checklist: {
    display: "grid",
    gap: "8px",
  },
  step: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    border: "1px solid #e4e9ef",
    borderRadius: "8px",
    padding: "8px",
    background: "#f9fbfd",
  },
  section: {
    display: "grid",
    gap: "6px",
    borderTop: "1px solid #edf1f5",
    paddingTop: "10px",
  },
  empty: {
    border: "1px dashed #cbd7e3",
    borderRadius: "8px",
    padding: "14px",
    color: "#5f6b7a",
  },
};
