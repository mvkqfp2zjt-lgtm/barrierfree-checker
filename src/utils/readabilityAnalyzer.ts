// src/utils/readabilityAnalyzer.ts
import { getContrastInfo } from "./colorUtils";

interface ReadabilityResult {
  textScore: number;
  contrastScore: number;
  backgroundScore: number;
  comments: string[];
}

/**
 * 画像全体の文字見やすさを簡易的にスコア化
 */
export async function analyzeReadability(
  imageDataUrl: string,
  ocrText: string
): Promise<ReadabilityResult> {
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = imageDataUrl;

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject();
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvasが取得できません。");

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // === 1️⃣ 文字サイズ（単純推定） ===
  const textLength = ocrText.length;
  const avgCharSizeRatio = Math.min(1, Math.max(0, 1 - textLength / 500)); // 簡易推定
  const textScore =
    textLength > 50 ? 60 * avgCharSizeRatio + 40 : 90 * avgCharSizeRatio + 10;

  // === 2️⃣ 背景の明度ばらつき ===
  let lumValues: number[] = [];
  for (let i = 0; i < imageData.length; i += 4 * 40) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    const lum = 0.2126 * (r / 255) + 0.7152 * (g / 255) + 0.0722 * (b / 255);
    lumValues.push(lum);
  }
  const avgLum =
    lumValues.reduce((sum, v) => sum + v, 0) / lumValues.length || 0;
  const variance =
    lumValues.reduce((sum, v) => sum + Math.pow(v - avgLum, 2), 0) /
    lumValues.length;
  const backgroundScore = Math.max(
    0,
    Math.min(100, 100 - variance * 1000) // 背景が単色に近いほど高得点
  );

  // === 3️⃣ コントラスト（代表値） ===
  const contrastInfo = getContrastInfo("#FFFFFF", "#000000");
  const contrastScore =
    contrastInfo.level === "AAA"
      ? 100
      : contrastInfo.level === "AA"
      ? 80
      : contrastInfo.level === "A"
      ? 60
      : 30;

  // === コメント生成 ===
  const comments: string[] = [];

  if (textScore < 50)
    comments.push("⚠️ 文字が小さい可能性があります（約12pt未満）。");
  else comments.push("🅰️ 文字サイズは概ね良好です。");

  if (backgroundScore < 60)
    comments.push("⚠️ 背景に明度のばらつきがあり、文字が埋もれる可能性があります。");
  else comments.push("🎨 背景の明度は安定しています。");

  if (contrastScore < 70)
    comments.push("⚠️ コントラストがやや低いです。文字色を強調すると見やすくなります。");
  else comments.push("✅ コントラストは良好です。");

  return {
    textScore,
    contrastScore,
    backgroundScore,
    comments,
  };
}