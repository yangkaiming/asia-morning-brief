// 发布早报 HTML 到 GitHub 固定路径（REST API）
// 用法: node publish.js [srcHtml]
// 环境变量: GH_PAT(默认读 <工作区>/.github_pat) / GH_REPO / GH_BRANCH / GH_FILE
const fs = require('fs');
const p = require('path');
const os = require('os');
const https = require('https');

const WORK = process.env.BRIEF_WORK || process.cwd();

function findToken() {
  if (process.env.GH_PAT) return process.env.GH_PAT.trim();
  const cands = [
    p.join(WORK, '.github_pat'),
    p.join(os.homedir(), '.codebuddy', '.github_pat'),
    p.join(os.homedir(), '.github_pat')
  ];
  for (const f of cands) {
    if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  }
  return null;
}

const TOKEN = findToken();
if (!TOKEN) {
  console.log('NO_TOKEN: 请设置环境变量 GH_PAT，或把 token 写入 ' + p.join(WORK, '.github_pat'));
  process.exit(4);
}
const REPO = process.env.GH_REPO || 'yangkaiming/asia-morning-brief';
const BRANCH = process.env.GH_BRANCH || 'main';
const FILE = process.env.GH_FILE || 'asia_morning_latest.html';
const SRC = process.argv[2] || p.join(WORK, 'outbox', 'asia_morning_latest.html');

function api(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'asia-morning-brief',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'Content-Length': data ? data.length : 0
      }
    }, res => {
      let c = '';
      res.on('data', x => c += x);
      res.on('end', () => {
        let j = null;
        try { j = JSON.parse(c); } catch (e) {}
        resolve({ status: res.statusCode, json: j, raw: c });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  if (!fs.existsSync(SRC)) { console.log('NO_SOURCE:' + SRC); process.exit(2); }
  const content = fs.readFileSync(SRC).toString('base64');
  const apiPath = '/repos/' + REPO + '/contents/' + FILE;

  const cur = await api('GET', apiPath);
  const sha = cur.json && cur.json.sha;
  console.log('GET_STATUS:' + cur.status + ' SHA:' + (sha || 'none'));

  const body = { message: 'update ' + FILE + ' ' + new Date().toISOString(), content: content, branch: BRANCH };
  if (sha) body.sha = sha;

  const r = await api('PUT', apiPath, body);
  console.log('PUT_STATUS:' + r.status);
  if (r.status >= 400) { console.log('ERR:' + r.raw.slice(0, 600)); process.exit(1); }
  console.log('PUBLISH_OK');
})();
