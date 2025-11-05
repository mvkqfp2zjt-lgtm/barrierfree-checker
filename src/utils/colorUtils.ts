import Color from "color";

// コントラスト比の評価
export function getContrastInfo(foreground: string, background: string) {
  try {
    const fg = Color(foreground).rgb().array(); // ✅ object→arrayに変更
    const bg = Color(background).rgb().array();

    const L1 = getLuminanceArray(fg);
    const L2 = getLuminanceArray(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);

    let level = "";
    let comment = "";

    if (ratio >= 7) {
      level = "AAA";
      comment = "非常に見やすい（大きな文字でもOK）";
    } else if (ratio >= 4.5) {
      level = "AA";
      comment = "十分に見やすい";
    } else if (ratio >= 3) {
      level = "A";
      comment = "ややコントラスト不足（大きな文字で対応）";
    } else {
      level = "NG";
      comment = "背景と文字色の差が小さく見づらいです";
    }

    return { ratio, level, comment };
  } catch (e) {
    return { ratio: 0, level: "NG", comment: "解析できませんでした" };
  }
}

// array用の輝度計算
function getLuminanceArray(rgb: number[]) {
  const [r, g, b] = rgb;
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

/**
 * 🔹 色バランスをざっくり解析して、特定の色に偏りすぎていないかを返す
 */
export function analyzeColorBalance(imageDataUrl: string) {
  const img = new Image();
  img.src = imageDataUrl;

  return new Promise<{ warning: boolean; message: string }>((resolve) => {
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve({ warning: false, message: "" });

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const data = imageData.data;

      let totalR = 0,
        totalG = 0,
        totalB = 0;

      for (let i = 0; i < data.length; i += 4) {
        totalR += data[i];
        totalG += data[i + 1];
        totalB += data[i + 2];
      }

      const avgR = totalR / (data.length / 4);
      const avgG = totalG / (data.length / 4);
      const avgB = totalB / (data.length / 4);

      const dominantColor =
        avgR > avgG && avgR > avgB
          ? "赤系"
          : avgG > avgR && avgG > avgB
          ? "緑系"
          : avgB > avgR && avgB > avgG
          ? "青系"
          : "バランス良好";

      const warning =
        dominantColor === "赤系" || dominantColor === "緑系" ? true : false;

      resolve({
        warning,
        message:
          warning
            ? `全体的に${dominantColor}の色味が強いようです。配色バランスを調整してみましょう。`
            : "特定の色に偏りはありません。バランス良い配色です。",
      });
    };
  });
}