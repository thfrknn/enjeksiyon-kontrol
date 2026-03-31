import { chromium } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const md    = readFileSync(resolve(__dir, '../KULLANIM_KILAVUZU.md'), 'utf8');

// Markdown → HTML (minimal renderer — no extra deps)
function mdToHtml(src) {
  return src
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Tables — header
    .replace(/^\|(.+)\|$/gm, (_, row) => {
      const cols = row.split('|').map(c => c.trim());
      return '<tr>' + cols.map(c => `<td>${c}</td>`).join('') + '</tr>';
    })
    .replace(/^\|[-| :]+\|$/gm, '') // remove separator rows
    // Wrap consecutive <tr> in <table>
    .replace(/((<tr>.*<\/tr>\n?)+)/g, '<table>$1</table>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs: blank-line separated text that isn't already a tag
    .replace(/^(?!<)(.+)$/gm, '<p>$1</p>')
    .replace(/<p>\s*<\/p>/g, '');
}

const body = mdToHtml(md);

const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    color: #1e293b;
    line-height: 1.6;
    padding: 20mm 18mm;
  }
  h1 {
    font-size: 22pt;
    color: #1e3a8a;
    border-bottom: 3px solid #1e3a8a;
    padding-bottom: 8px;
    margin: 28px 0 16px;
  }
  h2 {
    font-size: 15pt;
    color: #1e3a8a;
    border-left: 4px solid #3b82f6;
    padding-left: 10px;
    margin: 24px 0 10px;
    page-break-after: avoid;
  }
  h3 {
    font-size: 12pt;
    color: #1e40af;
    margin: 18px 0 8px;
    page-break-after: avoid;
  }
  h4 {
    font-size: 11pt;
    color: #374151;
    margin: 14px 0 6px;
  }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0 6px 22px; }
  li { margin: 3px 0; }
  code {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    padding: 1px 5px;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5pt;
    color: #0f172a;
  }
  pre {
    background: #0f172a;
    color: #e2e8f0;
    border-radius: 6px;
    padding: 12px 16px;
    margin: 10px 0;
    overflow: hidden;
    font-size: 9pt;
    line-height: 1.5;
  }
  pre code {
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-size: inherit;
  }
  table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0;
    font-size: 10pt;
    page-break-inside: avoid;
  }
  td, th {
    border: 1px solid #cbd5e1;
    padding: 6px 10px;
    text-align: left;
  }
  tr:first-child td {
    background: #1e3a8a;
    color: #fff;
    font-weight: bold;
  }
  tr:nth-child(even) td { background: #f8fafc; }
  blockquote {
    background: #eff6ff;
    border-left: 4px solid #3b82f6;
    padding: 8px 14px;
    margin: 8px 0;
    border-radius: 0 6px 6px 0;
    font-size: 10pt;
    color: #1e40af;
  }
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 20px 0;
  }
  strong { color: #0f172a; }
  /* Cover-like first h1 */
  body > h1:first-of-type {
    font-size: 26pt;
    text-align: center;
    border: none;
    margin-top: 0;
    padding-top: 10px;
  }
</style>
</head>
<body>
${body}
</body>
</html>`;

const browser = await chromium.launch();
const page    = await browser.newPage();
await page.setContent(html, { waitUntil: 'domcontentloaded' });

const outPath = resolve(__dir, '../KULLANIM_KILAVUZU.pdf');
await page.pdf({
  path: outPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
});

await browser.close();
console.log('PDF oluşturuldu:', outPath);
