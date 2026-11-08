

export const surfaceStyle = {
  display: "grid",
  gap: 16,
  gridTemplateColumns: "minmax(320px, 0.9fr) minmax(360px, 1.1fr)",
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

export const labelStyle = {
  display: "grid",
  gap: 6,
  fontSize: 13,
  fontWeight: 700,
} as const;

export const inputStyle = {
  border: "1px solid #cfd8d5",
  borderRadius: 6,
  padding: "9px 10px",
  width: "100%",
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
