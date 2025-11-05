import Color from "color";

/**
 * 主要色抽出（K-Means）
 * 画像を縮小してから K=5 でクラスタリング。代表色をHEXで返す。
 */
export async function getDominantColors(
  dataUrl: string,
  k: number = 5
): Promise<string[]> {
  const img = await loadImage(dataUrl);
  // 縮小してサンプリングコスト削減
  const target = downscaleToCanvas(img, 160);
  const ctx = target.getContext("2d")!;
  const { width, height } = target;
  const imgData = ctx.getImageData(0, 0, width, height).data;

  const points: number[][] = [];
  for (let i = 0; i < imgData.length; i += 4) {
    const r = imgData[i];
    const g = imgData[i + 1];
    const b = imgData[i + 2];
    // 透明は除外
    const a = imgData[i + 3];
    if (a > 10) points.push([r, g, b]);
  }

  const centers = kmeans(points, k, 8);
  // 明るさ順に並べると読みやすい
  const sorted = centers
    .map((c) => Color.rgb(c[0], c[1], c[2]).hex().toUpperCase())
    .filter((v, i, arr) => arr.indexOf(v) === i); // 重複除去

  return sorted;
}

/**
 * 近似色警告：HSL差が小さい色同士をカウント
 */
export function assessColorSimilarity(hexes: string[]) {
  let similarPairs = 0;
  const warnings: string[] = [];
  for (let i = 0; i < hexes.length; i++) {
    for (let j = i + 1; j < hexes.length; j++) {
      const a = Color(hexes[i]).hsl().object();
      const b = Color(hexes[j]).hsl().object();
      const deltaH = hueDelta(a.h ?? 0, b.h ?? 0);
      const deltaS = Math.abs((a.s ?? 0) - (b.s ?? 0));
      const deltaL = Math.abs((a.l ?? 0) - (b.l ?? 0));
      if (deltaL < 15 && deltaS < 20) {
        similarPairs++;
      }
    }
  }
  if (similarPairs >= 3) {
    warnings.push("似た色が多く、要素の区別が付きにくい可能性があります。配色数を絞ることを検討してください。");
  } else if (similarPairs >= 1) {
    warnings.push("近似色の組み合わせがあり、情報が埋もれる可能性があります。");
  }
  return { similarPairs, warnings };
}

/**
 * 背景干渉（低コントラストの小領域割合）をタイル走査で概算
 * 低コントラストタイルの割合（%）を返す
 */
export async function computeLocalContrastRisk(dataUrl: string) {
  const img = await loadImage(dataUrl);
  const can = downscaleToCanvas(img, 800); // 処理負荷と精度のバランス
  const ctx = can.getContext("2d")!;
  const { width, height } = can;
  const tile = 32;
  let low = 0;
  let total = 0;
  for (let y = 0; y < height; y += tile) {
    for (let x = 0; x < width; x += tile) {
      const w = Math.min(tile, width - x);
      const h = Math.min(tile, height - y);
      const d = ctx.getImageData(x, y, w, h).data;
      const c = rmsContrast(d);
      // しきい値（0.08付近）。低い＝のっぺり＝背景写真上で白文字が沈むなどのリスク
      if (c < 0.08) low++;
      total++;
    }
  }
  const pct = Math.round((low / Math.max(1, total)) * 100);
  return { lowContrastPct: pct };
}

/**
 * 余白・密度：OCR矩形の最近傍距離の平均から「詰め込み/スカスカ」をスコア化
 * densityScore: 0-20（高いほど適切）
 */
export function computeWhitespaceMetrics(
  boxes: { x0: number; y0: number; x1: number; y1: number }[]
) {
  if (!boxes.length) return { densityScore: 10, comment: "テキスト検出が少ないため概算です。" };

  // 各ボックスの中心
  const centers = boxes.map((b) => ({ x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2 }));
  // 各ボックスの最近傍距離
  const dists: number[] = [];
  for (let i = 0; i < centers.length; i++) {
    let best = Infinity;
    for (let j = 0; j < centers.length; j++) {
      if (i === j) continue;
      const dx = centers[i].x - centers[j].x;
      const dy = centers[i].y - centers[j].y;
      const dist = Math.hypot(dx, dy);
      if (dist < best) best = dist;
    }
    if (isFinite(best)) dists.push(best);
  }

  const median = quickMedian(dists);
  // 代表高さ（字体の目安）
  const heights = boxes.map((b) => b.y1 - b.y0);
  const hMed = quickMedian(heights) || 1;

  // 代表高さに対する最近傍距離の比
  const ratio = median / hMed; // だいたい 1.2〜2.5 が快適帯
  let densityScore = 10;
  let comment = "";

  if (ratio >= 1.2 && ratio <= 2.5) {
    densityScore = 18 + Math.min(2, (ratio - 1.2) * 1.5); // 18〜20
    comment = "要素の間隔は概ね適切です。";
  } else if (ratio < 1.2) {
    densityScore = Math.max(4, Math.round(20 * ratio / 1.2) - 2); // 4〜18
    comment = "情報が詰め込まれて見える可能性があります。要素間隔を少し広げてください。";
  } else {
    // スカスカ
    densityScore = Math.max(6, Math.round(20 - (ratio - 2.5) * 4)); // 6〜18
    comment = "要素間隔が広く、視線が分散する可能性があります。間隔を少し詰めてください。";
  }

  densityScore = Math.min(20, Math.max(0, Math.round(densityScore)));
  return { densityScore, comment };
}

/* =============== 内部ユーティリティ =============== */

function hueDelta(h1: number, h2: number) {
  const d = Math.abs((h1 % 360) - (h2 % 360));
  return d > 180 ? 360 - d : d;
}

function rmsContrast(data: Uint8ClampedArray) {
  // グレースケール化→標準偏差を疑似コントラスト指標に
  let sum = 0;
  let sum2 = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b; // 輝度
    sum += y;
    sum2 += y * y;
  }
  const mean = sum / n;
  const varc = sum2 / n - mean * mean;
  const std = Math.sqrt(Math.max(0, varc)) / 255; // 0-1
  return std;
}

function quickMedian(arr: number[]) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;
    img.onload = () => resolve(img);
  });
}

function downscaleToCanvas(img: HTMLImageElement, maxW: number) {
  const scale = img.width > maxW ? maxW / img.width : 1;
  const can = document.createElement("canvas");
  can.width = Math.max(1, Math.round(img.width * scale));
  can.height = Math.max(1, Math.round(img.height * scale));
  const ctx = can.getContext("2d")!;
  ctx.drawImage(img, 0, 0, can.width, can.height);
  return can;
}

/**
 * 超シンプルKMeans（RGB）: 反復回数 iter、初期値はランダムサンプル
 */
function kmeans(points: number[][], k: number, iter: number = 8): number[][] {
  if (!points.length) return Array.from({ length: k }, () => [255, 255, 255]);
  // 初期中心
  const centers: number[][] = [];
  const used = new Set<number>();
  while (centers.length < k && centers.length < points.length) {
    const idx = Math.floor(Math.random() * points.length);
    if (!used.has(idx)) {
      used.add(idx);
      centers.push([...points[idx]]);
    }
  }

  const assign = new Array(points.length).fill(0);

  for (let t = 0; t < iter; t++) {
    // 割り当て
    for (let i = 0; i < points.length; i++) {
      let best = 0;
      let bestD = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const d =
          (points[i][0] - centers[c][0]) ** 2 +
          (points[i][1] - centers[c][1]) ** 2 +
          (points[i][2] - centers[c][2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = c;
        }
      }
      assign[i] = best;
    }
    // 更新
    const sums = centers.map(() => [0, 0, 0]);
    const counts = centers.map(() => 0);
    for (let i = 0; i < points.length; i++) {
      const c = assign[i];
      sums[c][0] += points[i][0];
      sums[c][1] += points[i][1];
      sums[c][2] += points[i][2];
      counts[c]++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (counts[c] > 0) {
        centers[c][0] = sums[c][0] / counts[c];
        centers[c][1] = sums[c][1] / counts[c];
        centers[c][2] = sums[c][2] / counts[c];
      }
    }
  }
  return centers;
}