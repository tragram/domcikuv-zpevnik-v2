import { useState, useEffect } from "react";

// Utility function to generate a 128x128 thumbnail from an image file
const resizeImageToThumbnail = (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const img = new Image();

    img.onload = () => {
      canvas.width = 128;
      canvas.height = 128;
      ctx.drawImage(img, 0, 0, 128, 128);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: file.type,
              lastModified: Date.now(),
            });
            resolve(thumbnailFile);
          } else {
            reject(new Error("Failed to generate thumbnail"));
          }
        },
        file.type,
        0.8, // JPEG quality
      );
    };

    img.onerror = () => reject(new Error("Failed to load image"));
    img.crossOrigin = "anonymous";
    img.src = URL.createObjectURL(file);
  });
};

export function useImageUpload(
  initialImage?: string,
  initialThumbnail?: string,
) {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>(initialImage || "");
  const [thumbnailPreview, setThumbnailPreview] = useState<string>(
    initialThumbnail || "",
  );
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);

  // Sync with initial props if they change (e.g., when editing an existing illustration)
  useEffect(() => {
    if (initialImage && !imageFile) setImagePreview(initialImage);
    if (initialThumbnail && !thumbnailFile)
      setThumbnailPreview(initialThumbnail);
  }, [initialImage, initialThumbnail, imageFile, thumbnailFile]);

  const handleImageChange = async (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setIsGeneratingThumbnail(true);

    try {
      const generatedThumbnail = await resizeImageToThumbnail(file);
      setThumbnailFile(generatedThumbnail);
      setThumbnailPreview(URL.createObjectURL(generatedThumbnail));
    } catch (error) {
      console.error("Error generating thumbnail:", error);
    } finally {
      setIsGeneratingThumbnail(false);
    }
  };

  const handleThumbnailChange = (file: File) => {
    setThumbnailFile(file);
    setThumbnailPreview(URL.createObjectURL(file));
  };

  const clearImages = (resetImage = true, resetThumbnail = true) => {
    if (resetImage) {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      setImageFile(null);
      setImagePreview(initialImage || "");
    }
    if (resetThumbnail) {
      if (thumbnailPreview.startsWith("blob:"))
        URL.revokeObjectURL(thumbnailPreview);
      setThumbnailFile(null);
      setThumbnailPreview(initialThumbnail || "");
    }
  };

  // Cleanup blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      if (thumbnailPreview.startsWith("blob:"))
        URL.revokeObjectURL(thumbnailPreview);
    };
  }, []); // Empty dependency array ensures this runs only on unmount

  return {
    imageFile,
    thumbnailFile,
    imagePreview,
    thumbnailPreview,
    isGeneratingThumbnail,
    handleImageChange,
    handleThumbnailChange,
    clearImages,
  };
}
