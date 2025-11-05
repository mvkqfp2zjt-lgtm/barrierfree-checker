// src/utils/autoColorAnalyzer.ts
import Color from "color";
import { getContrastInfo } from "./colorUtils";

/**
 * 画像データURLをもとに代表的な背景色と文字色を推定し、コントラストを算出する
 * （単純な明度分布＋色頻度分析）
 */
export async function analyzeColors(imageDataUrl: string) {
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = imageDataUrl;

  // 画像読み込み完了を待つ
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
  });

  // Canvasに描画
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvasが取得できません。");

  const w = (canvas.width = img.width);
  const h = (canvas.height = img.height);
  ctx.drawImage(img, 0, 0, w, h);

  // ピクセルデータを取得
  const imageData = ctx.getImageData(0, 0, w, h).data;

  // 明度分布を使って背景と文字色を推定
  const samples: { r: number; g: number; b: number; lum: number }[] = [];

  for (let i = 0; i < imageData.length; i += 4 * 10) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    samples.push({ r, g, b, lum });
  }

  // 明るさでソート
  samples.sort((a, b) => a.lum - b.lum);

  const bg = samples[0]; // 最も暗い or 明るい部分を背景と仮定
  const fg = samples[samples.length - 1]; // 逆側を文字色と仮定

  const bgHex = Color.rgb(bg.r, bg.g, bg.b).hex();
  const fgHex = Color.rgb(fg.r, fg.g, fg.b).hex();

  const contrastInfo = getContrastInfo(fgHex, bgHex);

  return {
    foreground: fgHex,
    background: bgHex,
    contrast: contrastInfo,
  };
}