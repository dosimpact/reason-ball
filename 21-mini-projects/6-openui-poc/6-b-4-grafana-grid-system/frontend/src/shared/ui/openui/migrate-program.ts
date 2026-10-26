// Translate inherited 6-3 examples; live model output already uses the unified schema.
const names: Record<string, string> = {
  "Button": "IuiButton",
  "Card": "IuiCard",
  "Carousel": "IuiCarousel",
  "DatePicker": "IuiDatePicker",
  "Form": "IuiForm",
  "Icon": "IuiIcon",
  "IconButton": "IuiIconButton",
  "Image": "IuiImage",
  "Input": "IuiInput",
  "ListItem": "IuiListItem",
  "RadioGroup": "IuiRadioGroup",
  "Select": "IuiSelect",
  "Slider": "IuiSlider",
  "Table": "IuiTable",
  "Text": "IuiText",
  "TextArea": "IuiTextArea",
  "Col": "VStack",
  "Divider": "Separator",
  "Slice": "IuiSlice"
};
export function migrateIntelligentProgram(program: string): string {
  // Skip quoted strings so prose, JSON, HTML and URLs are never rewritten.
  const renamed = program.replace(/"(?:\\.|[^"\\])*"|(@?)([A-Za-z][A-Za-z0-9]*)(?=\s*\()/g,
    (token, prefix: string | undefined, name: string | undefined) =>
      name && names[name] ? `${prefix ?? ""}${names[name]}` : token);
  return renamed.replace(/^root\s*=/m, "integratedContent =") + "\nroot = Card([integratedContent])\n";
}
