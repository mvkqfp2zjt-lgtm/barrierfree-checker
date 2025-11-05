// src/utils/ColorSimulation.ts
// ======================================
// 色覚シミュレーションユーティリティ
// ======================================

// 🔹 色覚タイプの定義（App側と共通）
export type ColorVisionType = "normal" | "protan" | "deutan" | "tritan" | "aging";

/**
 * 指定した色覚タイプで画像データを変換します。
 * @param imageData - 画像のピクセルデータ
 * @param type - 色覚タイプ
 * @returns 新しい ImageData
 */
export function simulateColorVision(imageData: ImageData, type: ColorVisionType): ImageData {
  if (type === "normal" || type === "aging") {
    // agingは別途処理するためここではそのまま返す
    return imageData;
  }

  const data = imageData.data;
  const result = new ImageData(imageData.width, imageData.height);

  // 各色覚タイプごとの変換マトリクス
  const matrices: Record<ColorVisionType, number[][]> = {
    normal: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    protan: [
      [0.56667, 0.43333, 0.0],
      [0.55833, 0.44167, 0.0],
      [0.0, 0.24167, 0.75833],
    ],
    deutan: [
      [0.625, 0.375, 0.0],
      [0.7, 0.3, 0.0],
      [0.0, 0.3, 0.7],
    ],
    tritan: [
      [0.95, 0.05, 0.0],
      [0.0, 0.43333, 0.56667],
      [0.0, 0.475, 0.525],
    ],
    aging: [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ], // agingはCanvasで処理
  };

  const matrix = matrices[type];

  // ピクセルごとの変換
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    const r2 = r * matrix[0][0] + g * matrix[0][1] + b * matrix[0][2];
    const g2 = r * matrix[1][0] + g * matrix[1][1] + b * matrix[1][2];
    const b2 = r * matrix[2][0] + g * matrix[2][1] + b * matrix[2][2];

    result.data[i] = clamp(r2, 0, 255);
    result.data[i + 1] = clamp(g2, 0, 255);
    result.data[i + 2] = clamp(b2, 0, 255);
    result.data[i + 3] = data[i + 3]; // α値はそのまま
  }

  return result;
}

/**
 * 値を範囲内に制限
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}