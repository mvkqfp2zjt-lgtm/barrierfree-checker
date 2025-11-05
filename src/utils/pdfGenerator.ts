import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface PdfReportOptions {
  imageDataUrl: string;
  contrast?: any;
  readability?: any;
  adviceList?: string[];
}

/**
 * 文字化け防止のため、全出力を画像化してPDFに埋め込む。
 */
export async function generatePdfReport({
  imageDataUrl,
  contrast,
  readability,
  adviceList,
}: PdfReportOptions): Promise<Blob> {
  const pdf = new jsPDF("p", "mm", "a4");

  // === レポート全体をHTMLとして構成 ===
  const container = document.createElement("div");
  container.style.width = "794px"; // A4相当ピクセル幅（@96dpi）
  container.style.padding = "20px";
  container.style.fontFamily = "sans-serif";
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000";
  container.style.lineHeight = "1.5";

  container.innerHTML = `
    <div style="text-align:center; margin-bottom:20px;">
      <h2 style="font-size:20px; margin:0;">バリアフリーデザインチェッカー レポート</h2>
    </div>
    <div style="text-align:center; margin-bottom:10px;">
      <img src="${imageDataUrl}" style="max-width:100%; border:1px solid #ccc; border-radius:6px;" />
    </div>
    <div style="margin-top:10px; font-size:14px;">
      ${
        contrast
          ? `<p><strong>コントラスト比：</strong>${contrast.ratio?.toFixed(2)}（${contrast.level}）</p>
             <p>${contrast.comment || ""}</p>`
          : ""
      }
      ${
        readability
          ? `<p><strong>読みやすさスコア：</strong>${readability.score}</p>
             <p>${readability.comment}</p>`
          : ""
      }
      ${
        adviceList && adviceList.length
          ? `<div><strong>AIアドバイス：</strong><ul>${adviceList
              .map((a) => `<li>${a}</li>`)
              .join("")}</ul></div>`
          : ""
      }
    </div>
  `;

  document.body.appendChild(container);

  // === HTML → 画像化（高画質） ===
  const canvas = await html2canvas(container, {
    scale: 2, // 高解像度（通常の2倍）
    backgroundColor: "#fff",
    useCORS: true,
  });

  const imgData = canvas.toDataURL("image/jpeg", 1.0);
  const imgProps = pdf.getImageProperties(imgData);

  // === A4比率に収めて挿入 ===
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth / imgProps.width, pageHeight / imgProps.height);
  const imgWidth = imgProps.width * ratio;
  const imgHeight = imgProps.height * ratio;

  pdf.addImage(
    imgData,
    "JPEG",
    (pageWidth - imgWidth) / 2,
    (pageHeight - imgHeight) / 2,
    imgWidth,
    imgHeight
  );

  document.body.removeChild(container);
  return pdf.output("blob");
}