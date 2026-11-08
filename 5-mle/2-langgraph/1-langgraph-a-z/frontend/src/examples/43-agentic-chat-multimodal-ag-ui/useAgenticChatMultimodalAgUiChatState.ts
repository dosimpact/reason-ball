import { useRef, useState } from "react";
import { type PreviewImage } from "./model";

export function useAgenticChatMultimodalAgUiChatState() {
  const [preview, setPreview] = useState<PreviewImage | null>(null);

  const [uploadError, setUploadError] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function applyPreview(image: PreviewImage) {
    setPreview(image);
    setUploadError("");
  }

  function resetPreview() {
    setPreview(null);
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return { preview, uploadError, setUploadError, fileInputRef, applyPreview, resetPreview };
}
