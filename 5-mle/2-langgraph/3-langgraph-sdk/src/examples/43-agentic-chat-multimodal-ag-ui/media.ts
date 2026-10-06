import { type PreviewImage } from "./model";

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export function createSampleImage(): PreviewImage {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 300;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#f4faf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#174f8c";
  context.fillRect(32, 36, 180, 64);
  context.fillStyle = "#d8bd72";
  context.fillRect(32, 128, 416, 38);
  context.fillStyle = "#ffffff";
  context.fillRect(52, 198, 96, 56);
  context.fillRect(192, 198, 96, 56);
  context.fillRect(332, 198, 96, 56);
  context.strokeStyle = "#7f9990";
  context.lineWidth = 4;
  context.strokeRect(32, 36, 416, 218);
  context.fillStyle = "#ffffff";
  context.font = "700 24px Arial";
  context.fillText("AG-UI", 58, 76);
  context.fillStyle = "#24312d";
  context.font = "700 18px Arial";
  context.fillText("Multimodal Preview", 230, 76);
  context.font = "16px Arial";
  context.fillText("Image -> Chat attachment -> Observations", 62, 153);

  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    name: "ag-ui-multimodal-sample.png",
    mimeType: "image/png",
    size: Math.round((dataUrl.length * 3) / 4),
  };
}
