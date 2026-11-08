export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export function createSamplePng() {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available.");

  context.fillStyle = "#f4faf7";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#174f8c";
  context.fillRect(42, 46, 220, 76);
  context.fillStyle = "#e6f4f0";
  context.fillRect(296, 46, 292, 76);
  context.fillStyle = "#d8bd72";
  context.fillRect(42, 156, 546, 44);
  context.fillStyle = "#ffffff";
  context.fillRect(42, 228, 152, 78);
  context.fillRect(244, 228, 152, 78);
  context.fillRect(436, 228, 152, 78);
  context.strokeStyle = "#7f9990";
  context.lineWidth = 4;
  context.strokeRect(42, 46, 546, 260);
  context.fillStyle = "#ffffff";
  context.font = "700 30px Arial";
  context.fillText("LangGraph", 66, 94);
  context.fillStyle = "#24312d";
  context.font = "700 22px Arial";
  context.fillText("Image Input", 320, 93);
  context.font = "18px Arial";
  context.fillText("Preview -> Analyze -> Region Notes", 70, 185);
  context.font = "700 16px Arial";
  context.fillText("Upload", 80, 274);
  context.fillText("Vision", 286, 274);
  context.fillText("Result", 478, 274);
  const dataUrl = canvas.toDataURL("image/png");
  return {
    dataUrl,
    name: "langgraph-sample-image.png",
    mimeType: "image/png",
    size: Math.round((dataUrl.length * 3) / 4),
  };
}
