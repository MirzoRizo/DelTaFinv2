// cashier/src/lib/receipt.ts
// Генерация и печать чека
// Работает через нативный диалог печати Windows/macOS/Linux
// Поддерживает термопринтеры 58мм и 80мм с любыми драйверами

export interface ReceiptData {
  saleId: string;
  companyName: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    unit: string;
  }>;
  total: number;
  paid: number;
  change: number;
  paymentMethod: "cash" | "card";
  createdAt: number;
  paperWidth?: 58 | 80; // мм
}

// Генерируем HTML чека оптимизированный для термопринтера
function buildReceiptHtml(data: ReceiptData): string {
  const widthMm = data.paperWidth ?? 80;
  const widthPx = widthMm === 58 ? 220 : 302; // примерно 8px/мм при 96dpi

  const dateStr = new Date(data.createdAt).toLocaleString("ru-RU", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });

  const methodLabel = data.paymentMethod === "cash" ? "Наличные" : "Карта";

  function fmt(n: number) {
    return new Intl.NumberFormat("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
  }
  function fmtQty(n: number) {
    return n % 1 === 0 ? String(n) : n.toFixed(3).replace(/\.?0+$/, "");
  }

  const itemsHtml = data.items.map((item) => `
    <tr>
      <td class="name">${item.name}</td>
      <td class="qty">${fmtQty(item.quantity)} ${item.unit}</td>
      <td class="price">${fmt(item.price)}</td>
      <td class="total">${fmt(item.total)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<style>
  @page {
    margin: 0;
    size: ${widthMm}mm auto;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    width: ${widthPx}px;
    padding: 8px 6px;
    color: #000;
    background: #fff;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: bold; }
  .large  { font-size: 14px; }
  .xlarge { font-size: 18px; font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  td.name  { width: 45%; word-break: break-word; }
  td.qty   { width: 20%; }
  td.price { width: 17%; text-align: right; }
  td.total { width: 18%; text-align: right; font-weight: bold; }
  .th { font-weight: bold; font-size: 10px; border-bottom: 1px solid #000; }
  .summary td { padding: 2px; }
  .summary .label { font-weight: normal; }
  .summary .value { text-align: right; font-weight: bold; }
  .change-row td { font-size: 13px; font-weight: bold; }
  .footer { text-align: center; margin-top: 6px; font-size: 10px; }
  .receipt-id { font-size: 9px; color: #666; }
  @media print {
    body { width: ${widthPx}px; }
  }
</style>
</head>
<body>
  <div class="center bold large">${data.companyName}</div>
  <div class="center" style="font-size:10px; margin:2px 0 4px;">${dateStr}</div>
  <hr>

  <table>
    <tr class="th">
      <td class="name">Товар</td>
      <td class="qty">Кол-во</td>
      <td class="price">Цена</td>
      <td class="total">Сумма</td>
    </tr>
    ${itemsHtml}
  </table>

  <hr>

  <table class="summary">
    <tr>
      <td class="label">ИТОГО:</td>
      <td class="value xlarge">${fmt(data.total)} сум</td>
    </tr>
    <tr>
      <td class="label">Оплата (${methodLabel}):</td>
      <td class="value">${fmt(data.paid)} сум</td>
    </tr>
    ${data.change > 0 ? `
    <tr class="change-row">
      <td class="label">СДАЧА:</td>
      <td class="value">${fmt(data.change)} сум</td>
    </tr>` : ""}
  </table>

  <hr>
  <div class="footer">
    Спасибо за покупку!
  </div>
  <div class="footer receipt-id">Чек #${data.saleId.slice(0,8).toUpperCase()}</div>
  <div style="height:16px"></div>
</body>
</html>`;
}

// Печать через нативный диалог
export function printReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);

  // Открываем невидимый iframe для печати (не новое окно — не требует разрешений)
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();

  // Небольшая задержка чтобы шрифты загрузились
  setTimeout(() => {
    try {
      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } finally {
      setTimeout(() => document.body.removeChild(iframe), 2000);
    }
  }, 300);
}

// Предпросмотр чека в отдельном окне
export function previewReceipt(data: ReceiptData): void {
  const html = buildReceiptHtml(data);
  const win = window.open("", "_blank", "width=400,height=600,scrollbars=yes");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}
