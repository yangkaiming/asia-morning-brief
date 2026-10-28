// 用模板 + JSON 渲染早报 HTML（红涨绿跌 + 虚下划线，全部内联样式）
// 用法: node render.js <data.json> [outDir]
const fs = require('fs');
const p = require('path');

const RED = '#e60000', GREEN = '#009944', DARK = '#1a1a1a';
const src = process.argv[2];
if (!src) { console.error('USAGE: node render.js <data.json> [outDir]'); process.exit(1); }
const outDir = process.argv[3] || p.resolve(__dirname, '../../../outbox');
const d = JSON.parse(fs.readFileSync(src, 'utf8'));
const tpl = fs.readFileSync(p.join(__dirname, '../assets/template.html'), 'utf8');

const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = v => { const n = Number(v); return isNaN(n) || n === 0 ? DARK : (n > 0 ? RED : GREEN); };
const pct = v => {
  const n = Number(v);
  const s = isNaN(n) ? String(v) : (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  const k = col(v);
  return `<span style="color:${k};font-weight:700;border-bottom:1px dashed ${k};padding-bottom:1px;">${esc(s)}</span>`;
};
const val = v => {
  if (v == null || v === '') return '';
  const k = col(v);
  return `<span style="color:${k};font-weight:700;border-bottom:1px dashed ${k};padding-bottom:1px;">${esc(v)}</span>`;
};
const item = i => {
  let s = esc(i.name) + ' ' + pct(i.pct);
  if (i.value) s += '，报 ' + val(i.value);
  if (i.note) s += '（' + esc(i.note) + '）';
  return `<li style="margin:7px 0;">${s}</li>`;
};
const ul = a => `<ul style="margin:6px 0;padding-left:20px;">${(a || []).map(item).join('')}</ul>`;
const raw = v => (v == null ? '' : String(v));

const map = {
  TITLE: esc(d.title),
  DATE: esc(d.date),
  TIME: esc(d.time || ''),
  US_DATE: esc(d.usDate || ''),
  TAG: d.tag ? `<div style="display:inline-block;background:#fff0f0;color:${RED};font-size:13px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:18px;">${esc(d.tag)}</div>` : '',
  LEAD: raw(d.lead),
  US_LIST: ul(d.us),
  US_EXTRA: d.usExtra ? `<p style="margin:8px 0;">${d.usExtra}</p>` : '',
  ASIA_LIST: ul(d.asia),
  NEWS: d.news ? `<div style="background:#fafafa;padding:10px 12px;border-left:3px solid ${RED};margin:10px 0;"><b style="font-weight:700;">${esc(d.news.title)}</b>：${raw(d.news.text)}</div>` : '',
  ASIA_EXTRA: d.asiaExtra ? `<p style="margin:8px 0;">${d.asiaExtra}</p>` : '',
  INSIGHTS: ul(d.insights),
  WATCH: `<div style="background:#fafafa;border-left:3px solid ${RED};padding:11px 13px;font-size:14px;margin:12px 0;color:#333;">${raw(d.watch)}</div>`,
  SOURCES: esc(d.sources || '公开行情')
};

let h = tpl;
for (const k in map) h = h.split('{{' + k + '}}').join(map[k]);

fs.mkdirSync(outDir, { recursive: true });
const f = 'asia_morning_' + String(d.date || '').replace(/-/g, '') + '.html';
fs.writeFileSync(p.join(outDir, f), h, 'utf8');
fs.writeFileSync(p.join(outDir, 'asia_morning_latest.html'), h, 'utf8');
console.log('RENDERED ' + p.join(outDir, f) + ' bytes=' + Buffer.byteLength(h));
