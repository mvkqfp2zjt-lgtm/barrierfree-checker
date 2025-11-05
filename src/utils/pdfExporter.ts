// src/utils/pdfExporter.ts
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * 画面（任意の要素）を高解像度でキャプチャし、A4複数ページに自動分割してPDF保存
 * 文字はすべて画像化されるため文字化けなし・編集不可
 */
export async function exportAsPdf(
  elementId: string,
  fileName: string = "report.pdf",
  options?: { marginMm?: number }
) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("PDF化する要素が見つかりません。");
    return;
  }

  // 余白（mm）
  const marginMm = options?.marginMm ?? 10;

  // 高解像度でキャプチャ（scale=2〜3 推奨）
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    // 要素が画面外にあっても描画されるように
    windowWidth: document.documentElement.scrollWidth,
    windowHeight: document.documentElement.scrollHeight,
  });

  // 画像化（JPEGの方がファイルが軽くなりがち）
  const imgData = canvas.toDataURL("image/jpeg", 0.95);

  const pdf = new jsPDF("p", "mm", "a4");
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const usableW = pdfW - marginMm * 2;
  const usableH = pdfH - marginMm * 2;

  // 画像のPDF上でのサイズ（横幅にフィット）
  const imgW = usableW;
  const imgH = (canvas.height * imgW) / canvas.width;

  // 1ページに収まる高さを基準に何ページ必要か計算
  let heightLeft = imgH;
  let positionY = marginMm;

  // 1ページ目
  pdf.addImage(imgData, "JPEG", marginMm, positionY, imgW, imgH);
  heightLeft -= usableH;

  // 2ページ目以降（画像を上にずらして描画＝見えている範囲だけ印刷）
  while (heightLeft > 0) {
    pdf.addPage();
    // （コツ）同じ画像をy座標を負でずらして配置 → 見える範囲がページになる
    positionY = marginMm - (imgH - heightLeft);
    pdf.addImage(imgData, "JPEG", marginMm, positionY, imgW, imgH);
    heightLeft -= usableH;
  }

  pdf.save(fileName);
}