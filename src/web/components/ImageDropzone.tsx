import { Upload } from "lucide-react";
import React, { useState } from "react";
import { cn } from "~/lib/utils";

interface ImageDropzoneProps {
  onFileSelect: (file: File) => void;
  previewUrl?: string;
  label: string;
  className?: string;
}

export function ImageDropzone({
  onFileSelect,
  previewUrl,
  label,
  className,
}: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={cn(
        "relative group cursor-pointer border-2 border-dashed rounded-lg transition-all duration-200 flex flex-col items-center justify-center min-h-[150px] p-4",
        isDragging
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-muted-foreground/25 hover:border-primary/50",
        className,
      )}
      onClick={() => document.getElementById(`file-upload-${label}`)?.click()}
    >
      <input
        id={`file-upload-${label}`}
        type="file"
        className="hidden"
        accept="image/*"
        onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
      />

      {previewUrl ? (
        <div className="relative w-full h-full flex flex-col items-center gap-2">
          <img
            src={previewUrl}
            alt="Preview"
            className="max-h-32 rounded object-contain shadow-sm"
          />
          <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            Click or drag to replace
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="p-3 rounded-full bg-muted">
            <Upload className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs">Drag and drop or click to upload</p>
          </div>
        </div>
      )}
    </div>
  );
}
