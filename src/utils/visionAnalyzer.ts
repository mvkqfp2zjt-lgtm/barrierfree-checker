// src/utils/visionAnalyzer.ts
import Tesseract from "tesseract.js";

export async function analyzeImage(imageDataUrl: string) {
  try {
    const { data: { text } } = await Tesseract.recognize(
      imageDataUrl,
      "jpn", // 日本語対応
      {
        logger: (info) => console.log(info)
      }
    );

    // テキストを整形
    const cleaned = text.replace(/\s+/g, " ").trim();

    return {
      success: true,
      text: cleaned,
      charCount: cleaned.length,
    };
  } catch (error) {
    console.error("解析エラー:", error);
    return { success: false, text: "", charCount: 0 };
  }
}