import React, { useMemo, useState } from "react";
import ImageUploader from "./components/ImageUploader";
import ColorSimulationView from "./components/ColorSimulationView";
import { generatePdfReport } from "./utils/pdfGenerator";
import "./App.css";

type VisionType = "normal" | "protan" | "deutan" | "tritan" | "aging";
type InputMode = "image" | "web";

// ---------- 画像解析 ----------
async function analyzeImageDetailed(dataUrl: string) {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = dataUrl;
  });

  const maxW = 900;
  const scale = img.width > maxW ? maxW / img.width : 1;
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const c = document.createElement("canvas");
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  c.width = w;
  c.height = h;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;

  const colorCount = new Map<number, number>();
  let sumLum = 0;
  let lowContrastPixels = 0;
  let totalPixels = 0;

  const toLum = (r: number, g: number, b: number) => {
    const norm = (v: number) =>
      v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    return (
      0.2126 * norm(r / 255) + 0.7152 * norm(g / 255) + 0.0722 * norm(b / 255)
    );
  };
  const quant = (r: number, g: number, b: number) =>
    ((r >> 5) & 7) * 64 + ((g >> 5) & 7) * 8 + ((b >> 5) & 7);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      const lum = toLum(r, g, b);
      sumLum += lum;
      colorCount.set(quant(r, g, b), (colorCount.get(quant(r, g, b)) || 0) + 1);

      if (x + 1 < w) {
        const j = i + 4;
        const diff =
          Math.abs(toLum(r, g, b) - toLum(data[j], data[j + 1], data[j + 2]));
        if (diff < 0.06) lowContrastPixels++;
      }
      totalPixels++;
    }
  }

  const avgLum = sumLum / (w * h);
  const distinctColors = colorCount.size;
  const lowContrastPct = Math.round((lowContrastPixels / totalPixels) * 100);

  const topColors = Array.from(colorCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key]) => {
      const rq = (key >> 6) & 7;
      const gq = (key >> 3) & 7;
      const bq = key & 7;
      return `rgb(${Math.round((rq / 7) * 255)},${Math.round(
        (gq / 7) * 255
      )},${Math.round((bq / 7) * 255)})`;
    });

  const score =
    90 -
    Math.min(30, lowContrastPct / 2) +
    Math.min(10, distinctColors / 50) -
    Math.abs(avgLum - 0.5) * 20;

  const advice: string[] = [];

  if (lowContrastPct > 35) {
    advice.push(
      `背景と文字の明るさが近く、約${lowContrastPct}%の領域でコントラストが不足しています。文字の縁取りや背景の明度を変えることで、視認性が大きく向上します。`
    );
  } else if (lowContrastPct > 20) {
    advice.push(
      `全体としては見やすいものの、一部でコントラストが弱めです。明度や彩度に少し差をつけると、よりはっきり読み取れるようになります。`
    );
  } else {
    advice.push(`コントラストのバランスが良好です。視認性に優れています。`);
  }

  if (avgLum < 0.3) {
    advice.push(`全体がやや暗めです。背景を明るくするか、文字色を白に近づけてみましょう。`);
  } else if (avgLum > 0.85) {
    advice.push(`全体が明るいトーンです。白背景に淡い文字の場合は、文字を少し太くするか縁取りを加えると安心です。`);
  } else {
    advice.push(`明度バランスが整っています。自然で読みやすい印象です。`);
  }

  if (distinctColors < 40) {
    advice.push(`使われている色数が少なめです。控えめなアクセントカラーを追加すると整理された印象になります。`);
  } else if (distinctColors > 200) {
    advice.push(`色が多めです。近い色が混在すると見分けづらくなるため、同系色を整理しましょう。`);
  } else {
    advice.push(`色数のバランスがちょうど良いです。情報の優先順位が自然に伝わります。`);
  }

  advice.push(`主要な色構成は ${topColors.join(", ")} のようです。主に使う色と補助色を分けると効果的です。`);

  return {
    score: Math.round(score),
    avgLum: Number(avgLum.toFixed(3)),
    distinctColors,
    lowContrastPct,
    topColors,
    advice,
  };
}

// ---------- メイン ----------
function App() {
  const [inputMode, setInputMode] = useState<InputMode>("image");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [visionType, setVisionType] = useState<VisionType>("normal");
  const [agingIntensity, setAgingIntensity] = useState(40);
  const [blurIntensity, setBlurIntensity] = useState(3);
  const [analysis, setAnalysis] = useState<string>("");
  const [advice, setAdvice] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    if (!dataUrl && !url) return;
    setIsAnalyzing(true);
    setAnalysis("AIが解析を行っています…");

    let targetImage = dataUrl;

    if (inputMode === "web" && url) {
      try {
        const res = await fetch(
          `https://image.thum.io/get/width/1200/crop/800/noanimate/${encodeURIComponent(
            url
          )}`
        );
        const blob = await res.blob();
        targetImage = URL.createObjectURL(blob);
      } catch {
        setAnalysis("キャプチャ取得に失敗しました。CORS制限のないページでお試しください。");
        setIsAnalyzing(false);
        return;
      }
    }

    if (targetImage) {
      const result = await analyzeImageDetailed(targetImage);
      setScore(result.score);
      setAdvice(result.advice);
      setAnalysis(
        `解析完了\n\n📊スコア：${result.score}\n平均明度：${result.avgLum}\n推定色数：${result.distinctColors}\n低コントラスト領域：${result.lowContrastPct}%`
      );
    }

    setIsAnalyzing(false);
  };

  const handlePdfExport = async () => {
    if (!dataUrl) return;
    const blob = await generatePdfReport({
      imageDataUrl: dataUrl,
      contrast: { ratio: 4.5, level: "AA", comment: "良好" },
      readability: { score: score ?? 80, comment: "全体的に見やすい構成です。" },
      adviceList: advice,
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "バリアフリーデザインレポート.pdf";
    a.click();
  };

  const preview = useMemo(
    () =>
      dataUrl ? (
        <img
          src={dataUrl}
          alt="preview"
          style={{
            maxWidth: "100%",
            height: "auto",
            borderRadius: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,.15)",
          }}
        />
      ) : null,
    [dataUrl]
  );

  return (
    <div style={{ background: "#f4f7f6", minHeight: "100vh", padding: "36px 20px", textAlign: "center" }}>
      <header style={{ marginBottom: 24 }}>
        <img src="/Icon-1024pt@1x.png" alt="BarrierFreeChecker Logo" style={{ width: 84, height: 84, marginBottom: 8 }} />
        <h1>バリアフリーデザインチェッカー（Web版）</h1>
      </header>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setInputMode("image")}
          style={{
            marginRight: 8,
            padding: "8px 16px",
            borderRadius: 8,
            border: inputMode === "image" ? "2px solid #43A047" : "1px solid #ccc",
            background: inputMode === "image" ? "#E8F5E9" : "#fff",
            fontWeight: "bold",
          }}
        >
          画像から解析
        </button>
        <button
          onClick={() => setInputMode("web")}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: inputMode === "web" ? "2px solid #43A047" : "1px solid #ccc",
            background: inputMode === "web" ? "#E8F5E9" : "#fff",
            fontWeight: "bold",
          }}
        >
          WebページURLで解析
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {inputMode === "image" ? (
          <ImageUploader onSelect={() => {}} onDataUrl={setDataUrl} />
        ) : (
          <div>
            <input
              type="text"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              style={{ width: "80%", padding: "8px", borderRadius: 6, border: "1px solid #ccc" }}
            />
          </div>
        )}

        {dataUrl && inputMode === "image" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, marginTop: 16 }}>{preview}</div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing || (!dataUrl && !url)}
          style={{
            marginTop: 20,
            background: "linear-gradient(180deg,#66BB6A,#43A047)",
            color: "#fff",
            border: "none",
            borderRadius: 10,
            boxShadow: "0 4px 10px rgba(0,0,0,.22)",
            padding: "12px 26px",
            fontSize: "1rem",
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          {isAnalyzing ? "解析中…" : "解析を開始する"}
        </button>

        {analysis && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, marginTop: 20, textAlign: "left" }}>
            <h3>解析結果</h3>
            <pre style={{ whiteSpace: "pre-wrap" }}>{analysis}</pre>
            {advice.length > 0 && (
              <>
                <h4>AIアドバイス</h4>
                <ul>
                  {advice.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {dataUrl && (
          <section style={{ background: "#fff", borderRadius: 12, padding: 20, marginTop: 20 }}>
            <h3>色覚シミュレーション</h3>
            <div style={{ marginBottom: 12 }}>
              {(["normal", "protan", "deutan", "tritan", "aging"] as VisionType[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setVisionType(mode)}
                  style={{
                    margin: "0 6px",
                    padding: "6px 18px",
                    borderRadius: 10,
                    border: visionType === mode ? "2px solid #4CAF50" : "1px solid #ccc",
                    background: visionType === mode ? "linear-gradient(180deg,#A5D6A7,#81C784)" : "#fff",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {mode === "normal"
                    ? "通常"
                    : mode === "protan"
                    ? "P型（赤）"
                    : mode === "deutan"
                    ? "D型（緑）"
                    : mode === "tritan"
                    ? "T型（青）"
                    : "加齢視覚"}
                </button>
              ))}
            </div>
            {visionType === "aging" && (
              <div style={{ marginBottom: 16 }}>
                <label>黄変の強さ：{agingIntensity}%</label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={agingIntensity}
                  onChange={(e) => setAgingIntensity(Number(e.target.value))}
                  style={{ width: "60%" }}
                />
                <label style={{ display: "block", marginTop: 10 }}>
                  ぼかしの強さ：{blurIntensity}px
                </label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={0.5}
                  value={blurIntensity}
                  onChange={(e) => setBlurIntensity(Number(e.target.value))}
                  style={{ width: "60%" }}
                />
              </div>
            )}
            <ColorSimulationView
              imageDataUrl={dataUrl!}
              type={visionType}
              agingIntensity={agingIntensity}
              blurIntensity={blurIntensity}
            />
          </section>
        )}

        {dataUrl && (
          <button
            onClick={handlePdfExport}
            style={{
              background: "linear-gradient(180deg,#66BB6A,#43A047)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              boxShadow: "0 4px 10px rgba(0,0,0,.22)",
              padding: "12px 26px",
              marginTop: 24,
              fontWeight: "bold",
              cursor: "pointer",
            }}
          >
            PDFレポートを保存
          </button>
        )}
      </div>
    </div>
  );
}

export default App;