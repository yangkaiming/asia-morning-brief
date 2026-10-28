// 比较本地早报 HTML 与 GitHub 上的版本是否一致（忽略行尾差异）
// 用法: node compare_remote.js [localFile] [url]
const fs = require('fs');
const p = require('path');
const https = require('https');

const WORK = process.env.BRIEF_WORK || process.cwd();
const local = process.argv[2] || p.join(WORK, 'outbox', 'asia_morning_latest.html');
const url = process.argv[3] || 'https://raw.githubusercontent.com/yangkaiming/asia-morning-brief/main/asia_morning_latest.html';

https.get(url, { headers: { 'User-Agent': 'brief-check' } }, res => {
  let s = '';
  res.on('data', c => s += c);
  res.on('end', () => {
    const norm = t => t.replace(/\r\n/g, '\n').trim();
    const a = norm(fs.readFileSync(local, 'utf8'));
    const b = norm(s);
    const out = [];
    out.push('STATUS:' + res.statusCode + ' LOCAL_LEN:' + a.length + ' REMOTE_LEN:' + b.length + ' EQUAL:' + (a === b));
    if (a !== b) {
      let i = 0;
      while (i < a.length && i < b.length && a[i] === b[i]) i++;
      out.push('FIRST_DIFF_AT:' + i);
      out.push('LOCAL :' + a.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, ' '));
      out.push('REMOTE:' + b.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, ' '));
      // 列出所有不同的行
      const la = a.split('\n'), lb = b.split('\n');
      out.push('LINES local=' + la.length + ' remote=' + lb.length);
      for (let k = 0; k < Math.max(la.length, lb.length); k++) {
        if (la[k] !== lb[k]) {
          out.push('LINE ' + (k + 1) + ' LOCAL :' + (la[k] || ''));
          out.push('LINE ' + (k + 1) + ' REMOTE:' + (lb[k] || ''));
        }
      }
    }
    const report = p.join(p.dirname(local), 'compare_report.txt');
    fs.writeFileSync(report, out.join('\n'), 'utf8');
    console.log('EQUAL:' + (a === b) + ' REPORT:' + report);
  });
});
