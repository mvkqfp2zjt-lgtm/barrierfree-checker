import React, { useCallback, useState } from "react";

type Props = {
  onSelect: (file: File | null) => void;
  onDataUrl: (url: string | null) => void;
};

const ImageUploader: React.FC<Props> = ({ onSelect, onDataUrl }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (!file) return;
      onSelect(file);
      const reader = new FileReader();
      reader.onload = (e) => onDataUrl(e.target?.result as string);
      reader.readAsDataURL(file);
    },
    [onSelect, onDataUrl]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith("image/")) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onClick={() => document.getElementById("file-input")?.click()}
      style={{
        border: isDragging ? "2px dashed #4CAF50" : "2px dashed #ccc",
        background: isDragging ? "#E8F5E9" : "#fafafa",
        borderRadius: "10px",
        padding: "32px",
        textAlign: "center",
        cursor: "pointer",
        transition: "all .15s ease",
        boxShadow: "0 2px 6px rgba(0,0,0,.06)",
      }}
      role="button"
      aria-label="画像をドラッグ＆ドロップ、またはクリックして選択"
    >
      <p style={{ margin: 0, lineHeight: 1.6 }}>
        <strong>画像をここにドラッグ＆ドロップ</strong>
        <br />
        またはクリックして選択
      </p>
      <input
        id="file-input"
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onInputChange}
      />
    </div>
  );
};

export default ImageUploader;