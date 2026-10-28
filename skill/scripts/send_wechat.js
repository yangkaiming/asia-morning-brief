// 通过 ClawBot iLink API 向微信发送文本 / 文件（Node 实现，无需 Python）
// 用法: node send_wechat.js status | sendtext "文本" | sendfile <文件路径>
// 凭据: %APPDATA%\CodeBuddy CN\User\settings.json -> claw.channels.weixinClawBot
const fs = require('fs');
const p = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const CHANNEL_VERSION = 'workbuddy-desktop-1.0.0';
const CACHE_FILE = p.join(__dirname, '.claw_token_cache.json');

function candidates() {
  const ad = process.env.APPDATA || p.join(os.homedir(), 'AppData', 'Roaming');
  return [p.join(ad, 'CodeBuddy CN', 'User', 'settings.json'),
          p.join(ad, 'WorkBuddy', 'User', 'settings.json'),
          p.join(os.homedir(), '.workbuddy', 'settings.json')];
}

function loadCfg() {
  for (const f of candidates()) {
    if (!fs.existsSync(f)) continue;
    let s; try { s = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^\uFEFF/, '')); } catch (e) { continue; }
    const ch = s['claw.channels'] || (s.claw && s.claw.channels) || {};
    let cfg = ch.weixinClawBot;
    if (!cfg && s.claw && s.claw.users) {
      for (const k of Object.keys(s.claw.users)) {
        const u = s.claw.users[k];
        if (u && u.channels && u.channels.weixinClawBot) { cfg = u.channels.weixinClawBot; break; }
      }
    }
    if (cfg && cfg.botToken) return { cfg: cfg, file: f };
  }
  return null;
}

const readCache = () => { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) { return {}; } };
const writeCache = o => { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(o), 'utf8'); } catch (e) {} };

function request(url, opts) {
  opts = opts || {};
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const headers = Object.assign({}, opts.headers || {});
    if (opts.body) headers['Content-Length'] = opts.body.length;
    const req = lib.request({ hostname: u.hostname, path: u.pathname + u.search, method: opts.method || 'POST', headers: headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

const genUin = () => Buffer.from(String(crypto.randomBytes(4).readUInt32LE(0)), 'utf8').toString('base64');

async function apiReq(cfg, apiPath, payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const res = await request(String(cfg.baseUrl).replace(/\/+$/, '') + apiPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'AuthorizationType': 'ilink_bot_token', 'Authorization': 'Bearer ' + cfg.botToken, 'X-WECHAT-UIN': genUin(), 'Content-Length': body.length },
    body: body
  });
  const text = res.body.toString('utf8');
  let json = null; try { json = JSON.parse(text); } catch (e) {}
  return { status: res.status, json: json, text: text };
}

async function getContextToken(cfg) {
  const cache = readCache();
  let res = await apiReq(cfg, '/ilink/bot/getupdates', { get_updates_buf: cache.get_updates_buf || '', base_info: { channel_version: CHANNEL_VERSION } });
  if (res.status !== 200 || !res.json || (res.json.ret !== undefined && res.json.ret !== 0)) {
    res = await apiReq(cfg, '/ilink/bot/getupdates', { get_updates_buf: '', base_info: { channel_version: CHANNEL_VERSION } });
  }
  if (res.status !== 200 || !res.json) throw new Error('getupdates HTTP ' + res.status + ' ' + res.text.slice(0, 200));
  const j = res.json;
  if (j.get_updates_buf) { cache.get_updates_buf = j.get_updates_buf; writeCache(cache); }
  const msgs = j.msgs || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i] && msgs[i].context_token) { cache.context_token = msgs[i].context_token; writeCache(cache); return cache.context_token; }
  }
  if (cache.context_token) return cache.context_token;
  console.log('WARN: 未取得 context_token（IDE 侧可能已消费该消息），尝试不带 token 发送');
  return '';
}

async function sendText(cfg, text) {
  const token = await getContextToken(cfg);
  const payload = { msg: { from_user_id: '', to_user_id: cfg.userId, client_id: 'cb-brief-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16), message_type: 2, message_state: 2, context_token: token, item_list: [{ type: 1, text_item: { text: text } }] }, base_info: { channel_version: CHANNEL_VERSION } };
  if (!token) delete payload.msg.context_token;
  const r = await apiReq(cfg, '/ilink/bot/sendmessage', payload);
  const j = r.json || {};
  if (r.status !== 200 || (j.ret !== undefined && j.ret !== 0)) throw new Error('sendmessage 失败 HTTP ' + r.status + ' ret=' + j.ret + ' ' + r.text.slice(0, 200));
  return true;
}

async function sendFile(cfg, filePath) {
  if (!fs.existsSync(filePath)) throw new Error('文件不存在: ' + filePath);
  const token = await getContextToken(cfg);
  const data = fs.readFileSync(filePath);
  const rawSize = data.length;
  const rawMd5 = crypto.createHash('md5').update(data).digest('hex');
  const aesKey = crypto.randomBytes(16);
  const aesHex = aesKey.toString('hex');
  const cipher = crypto.createCipheriv('aes-128-ecb', aesKey, null);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const fileKey = crypto.randomUUID().replace(/-/g, '');
  const up = await apiReq(cfg, '/ilink/bot/getuploadurl', { filekey: fileKey, media_type: 3, to_user_id: cfg.userId, rawsize: rawSize, rawfilemd5: rawMd5, filesize: enc.length, no_need_thumb: true, aeskey: aesHex });
  const uj = up.json || {};
  if (up.status !== 200 || (uj.ret !== undefined && uj.ret !== 0)) throw new Error('getuploadurl 失败 HTTP ' + up.status + ' ' + up.text.slice(0, 300));
  let uploadUrl = '', param = uj.upload_param || '';
  if (param) uploadUrl = 'https://novac2c.cdn.weixin.qq.com/c2c/upload?encrypted_query_param=' + encodeURIComponent(param) + '&filekey=' + fileKey;
  else if (uj.upload_full_url) { uploadUrl = uj.upload_full_url; const m = /encrypted_query_param=([^&]+)/.exec(uploadUrl); param = m ? m[1] : ''; }
  if (!uploadUrl || !param) throw new Error('未取得上传地址');
  const cdn = await request(uploadUrl, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: enc });
  if (cdn.status !== 200) throw new Error('CDN 上传失败 HTTP ' + cdn.status + ' ' + cdn.body.toString('utf8').slice(0, 200));
  const encParam = cdn.headers['x-encrypted-param'];
  if (!encParam) throw new Error('CDN 未返回 x-encrypted-param');
  const payload = { msg: { from_user_id: '', to_user_id: cfg.userId, client_id: 'cb-brief-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16), message_type: 2, message_state: 2, context_token: token, item_list: [{ type: 4, file_item: { media: { encrypt_query_param: encParam, aes_key: Buffer.from(aesHex, 'ascii').toString('base64'), encrypt_type: 1 }, file_name: p.basename(filePath), len: String(rawSize) } }] }, base_info: { channel_version: CHANNEL_VERSION } };
  if (!token) delete payload.msg.context_token;
  const r = await apiReq(cfg, '/ilink/bot/sendmessage', payload);
  const j = r.json || {};
  if (r.status !== 200 || (j.ret !== undefined && j.ret !== 0)) throw new Error('sendmessage 失败 HTTP ' + r.status + ' ret=' + j.ret + ' ' + r.text.slice(0, 300));
  return { name: p.basename(filePath), size: rawSize };
}

(async () => {
  const cmd = process.argv[2] || 'status';
  const found = loadCfg();
  if (!found) { console.log('NO_CONFIG: 未找到 weixinClawBot 通道配置'); process.exit(2); }
  const cfg = found.cfg;
  try {
    if (cmd === 'debug') {
      const res = await apiReq(cfg, '/ilink/bot/getupdates', { get_updates_buf: '', base_info: { channel_version: CHANNEL_VERSION } });
      console.log('HTTP:' + res.status);
      const j = res.json || {};
      console.log('KEYS:' + Object.keys(j).join(','));
      console.log('RET:' + j.ret + ' MSGS:' + (j.msgs ? j.msgs.length : 'none') + ' BUF:' + (j.get_updates_buf ? 'yes' : 'no'));
      (j.msgs || []).slice(-3).forEach((m, i) => console.log('MSG' + i + '_FIELDS:' + Object.keys(m).join(',')));
      return;
    }
    if (cmd === 'status') {
      const cache = readCache();
      console.log('SETTINGS:' + found.file);
      console.log('ENABLED:' + cfg.enabled + ' BASEURL:' + cfg.baseUrl + ' USER:' + (cfg.userId || '').slice(0, 12) + '...');
      console.log('TOKEN_PREFIX:' + String(cfg.botToken).slice(0, 12) + '... CACHED_CTX_TOKEN:' + (cache.context_token ? 'yes' : 'no'));
      return;
    }
    if (cmd === 'sendtext') {
      const text = process.argv.slice(3).join(' ');
      if (!text) { console.log('USAGE: sendtext "文本"'); process.exit(1); }
      await sendText(cfg, text);
      console.log('SEND_TEXT_OK');
      return;
    }
    if (cmd === 'sendfile') {
      const file = process.argv[3];
      if (!file) { console.log('USAGE: sendfile <文件路径>'); process.exit(1); }
      const r = await sendFile(cfg, p.resolve(file));
      console.log('SEND_FILE_OK ' + r.name + ' bytes=' + r.size);
      return;
    }
    console.log('UNKNOWN_CMD:' + cmd);
    process.exit(1);
  } catch (e) {
    console.log('ERROR: ' + (e && e.message ? e.message : String(e)));
    process.exit(1);
  }
})();
