

export const layoutStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(320px, 0.85fr) minmax(380px, 1.15fr)",
  minHeight: 720,
} as const;

export const panelStyle = {
  background: "#fbfcfb",
  border: "1px solid #cfd8d5",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  padding: 16,
} as const;

export const buttonStyle = {
  alignItems: "center",
  border: "1px solid #9fb3ad",
  borderRadius: 6,
  cursor: "pointer",
  display: "inline-flex",
  gap: 8,
  justifyContent: "center",
  padding: "9px 12px",
} as const;
