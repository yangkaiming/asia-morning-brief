// 校验早报 HTML：日期是否为今天、是否混入其它年份或未来日期
// 用法: node verify.js [file]
const fs = require('fs');
const p = require('path');

const f = process.argv[2] || p.resolve(__dirname, '../../../outbox/asia_morning_latest.html');
const html = fs.readFileSync(f, 'utf8');
const now = new Date();
const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
const today = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

const warn = [];

const years = Array.from(new Set(html.match(/20\d{2}/g) || []));
years.forEach(v => { if (Number(v) !== y) warn.push('混入其它年份: ' + v); });

const re = /(20\d{2})[-\/年](\d{1,2})[-\/月](\d{1,2})/g;
let hit;
while ((hit = re.exec(html)) !== null) {
  const dt = new Date(Number(hit[1]), Number(hit[2]) - 1, Number(hit[3]));
  if (dt > now) warn.push('出现未来日期: ' + hit[0]);
}

if (html.indexOf(today) === -1) warn.push('未找到今天日期标记: ' + today);
if (/{{[A-Z_]+}}/.test(html)) warn.push('存在未替换的占位符: ' + (html.match(/{{[A-Z_]+}}/g) || []).join(','));

if (warn.length) {
  console.log('VERIFY_WARN file=' + f);
  warn.forEach(w => console.log('  - ' + w));
  process.exit(1);
}
console.log('VERIFY_OK file=' + f + ' today=' + today);
