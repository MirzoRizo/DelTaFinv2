// src/lib/labelPrinter.ts
// Печать ценников / этикеток с штрих-кодом
// Использует JsBarcode через CDN для рендера штрих-кода в SVG

export interface LabelData {
  name: string;
  barcode: string;
  price?: number;
  plu?: number;
  isWeight?: boolean;
  unit?: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n) + " сум";
}

// Генерируем HTML страницу с ценниками
function buildLabelsHtml(labels: LabelData[], copies = 1): string {
  // Повторяем каждую этикетку нужное количество раз
  const allLabels: LabelData[] = [];
  for (const label of labels) {
    for (let i = 0; i < copies; i++) allLabels.push(label);
  }

  const labelsHtml = allLabels.map((label, idx) => `
    <div class="label">
      <div class="name">${label.name}</div>
      ${label.isWeight ? `<div class="plu">PLU: ${label.plu ?? "—"}</div>` : ""}
      <svg id="barcode-${idx}" class="barcode"></svg>
      <div class="barcode-num">${label.barcode}</div>
      ${label.price ? `<div class="price">${fmt(label.price)}${label.isWeight ? `/${label.unit ?? "кг"}` : ""}</div>` : ""}
    </div>
  `).join("");

  const initScripts = allLabels.map((label, idx) => `
    JsBarcode("#barcode-${idx}", "${label.barcode}", {
      format: "EAN13",
      width: 1.5,
      height: 40,
      displayValue: false,
      margin: 0,
      background: "transparent",
    });
  `).join("\n");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/barcodes/JsBarcode.ean-upc.min.js"></script>
<style>
  @page { margin: 5mm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; background: white; }
  .grid { display: flex; flex-wrap: wrap; gap: 4mm; padding: 2mm; }
  .label {
    width: 58mm; border: 0.5px dashed #ccc;
    padding: 3mm; display: flex; flex-direction: column;
    align-items: center; gap: 1mm; page-break-inside: avoid;
  }
  .name { font-size: 9pt; font-weight: bold; text-align: center; line-height: 1.2; word-break: break-word; }
  .plu { font-size: 8pt; color: #666; }
  .barcode { width: 100%; max-width: 52mm; height: auto; }
  .barcode-num { font-size: 7pt; color: #666; font-family: monospace; letter-spacing: 0.05em; }
  .price { font-size: 13pt; font-weight: bold; margin-top: 1mm; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="grid">${labelsHtml}</div>
  <script>
    window.onload = function() {
      try { ${initScripts} } catch(e) { console.error(e); }
    };
  </script>
</body>
</html>`;
}

// Открыть окно предпросмотра/печати ценников
export function printLabels(labels: LabelData[], copies = 1): void {
  const html = buildLabelsHtml(labels, copies);
  const win = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!win) { alert("Разрешите всплывающие окна для печати ценников"); return; }
  win.document.write(html);
  win.document.close();
  // Автоматически открываем диалог печати после загрузки штрих-кодов
  win.onload = () => {
    setTimeout(() => win.print(), 800);
  };
}
