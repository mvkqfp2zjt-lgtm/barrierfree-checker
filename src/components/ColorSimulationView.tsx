// src/components/ColorSimulationView.tsx
import React, { useEffect, useRef } from "react";
import { simulateColorVision, ColorVisionType } from "../utils/ColorSimulation";

type Props = {
  imageDataUrl: string;
  type: ColorVisionType;
  agingIntensity?: number; // 黄変の強さ
  blurIntensity?: number; // ぼかしの強さ
};

const ColorSimulationView: React.FC<Props> = ({
  imageDataUrl,
  type,
  agingIntensity = 50,
  blurIntensity = 3, // デフォルトぼかし3px
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageDataUrl;

    img.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Canvasサイズを画像サイズに合わせる
      canvas.width = img.width;
      canvas.height = img.height;

      // === 基本描画 ===
      ctx.drawImage(img, 0, 0, img.width, img.height);

      // === 色覚シミュレーション ===
      if (type !== "normal" && type !== "aging") {
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const simulated = simulateColorVision(imageData, type);
        ctx.putImageData(simulated, 0, 0);
      }

      // === 加齢視覚モード（黄変＋ぼかし） ===
      if (type === "aging") {
        // まず画像をぼかし処理
        ctx.filter = `blur(${blurIntensity}px)`;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        ctx.filter = "none";

        // 黄変効果（全体を黄色寄りに）
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const data = imageData.data;
        const yellowFactor = agingIntensity / 100;

        for (let i = 0; i < data.length; i += 4) {
          // 赤・緑をわずかに強め、青を減らす
          data[i] = Math.min(255, data[i] + 20 * yellowFactor); // R
          data[i + 1] = Math.min(255, data[i + 1] + 15 * yellowFactor); // G
          data[i + 2] = Math.max(0, data[i + 2] - 25 * yellowFactor); // B
        }
        ctx.putImageData(imageData, 0, 0);
      }
    };
  }, [imageDataUrl, type, agingIntensity, blurIntensity]);

  return (
    <div className="color-simulation-view" style={{ marginTop: "10px" }}>
      <canvas
        ref={canvasRef}
        style={{
          maxWidth: "90%",
          height: "auto",
          borderRadius: "8px",
          boxShadow: "0 0 8px rgba(0,0,0,0.2)",
        }}
      />
    </div>
  );
};

export default ColorSimulationView;