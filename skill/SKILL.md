---
name: asia-morning-brief
description: 生成并发布「亚太早报」公众号文章（隔夜美股三大指数与费半 + 当日 08:00 日经225/韩国KOSPI 开盘涨幅），产出带红涨绿跌与虚下划线的内联样式 HTML，并发布到 GitHub 固定路径供手机永久链接访问。当用户要求写/发/更新亚太早报、盘前早报、日韩开盘情况、隔夜美股摘要时使用。
---

# 亚太早报生成与发布

一套固定流程：抓取并交叉核对真实行情 → 渲染带色 HTML → 发布到 GitHub 固定链接 → 输出可复制正文。

## 固定资产（不要改动）

| 项 | 值 |
|---|---|
| 工作区 | `c:/Users/13091/CodeBuddy/Claw` |
| 仓库 | `yangkaiming/asia-morning-brief`（public，SSH: `git@github.com:yangkaiming/asia-morning-brief.git`） |
| 固定文件 | `asia_morning_latest.html`（每天覆盖，永久链接不变） |
| 永久链接（渲染） | `https://yangkaiming.github.io/asia-morning-brief/asia_morning_latest.html` |
| 备用渲染链接 | `https://htmlpreview.github.io/?https://raw.githubusercontent.com/yangkaiming/asia-morning-brief/main/asia_morning_latest.html` |
| PAT 文件 | `<工作区>/.github_pat`（Fine-grained，仅本仓库 Contents: Read and write；也可用环境变量 `GH_PAT`） |
| 输出目录 | `<工作区>/outbox/`（`asia_morning_YYYYMMDD.html` + `asia_morning_latest.html`） |

## 工作流

### 1. 锁定日期
先确定"今天"的真实日期（YYYY-MM-DD，含年份）。**所有文件命名、数据口径、报道时段都必须基于这个日期**，隔夜美股指"美东前一交易日"（北京时间早上 8:05 时对应美东当日收盘）。

### 2. 抓数 + 交叉核对
用 `web_search` 抓取，权威源优先：证券时报、中国证券网、澎湃新闻、每日经济新闻、中新经纬、中国基金报、财联社、新浪财经、腾讯新闻（转载稿）。关键数字（三大指数点位与涨跌幅、费半、存储芯片个股、日经/韩国开盘点位与涨幅）**至少两源交叉核对**；源之间冲突时，以出现次数多、且明确标注交易时段与数值精度更高者为准，并在文中只保留可确认的数值。

需要的数据字段见 `references/data_sources.md`。

### 3. 渲染 HTML
用 `scripts/render_brief.js` 把结构化数据渲染为内联样式的 HTML：

```bash
node .codebuddy/skills/asia-morning-brief/scripts/render_brief.js <工作区>/outbox/brief_YYYYMMDD.json
```

输出 `<工作区>/outbox/asia_morning_YYYYMMDD.html`，并自动复制为 `asia_morning_latest.html`。
JSON 结构与字段含义见 `references/data_sources.md`（或直接读 `scripts/render_brief.js` 顶部的示例）。

样式铁律（公众号会剥离 `<style>` 与 class，必须全部内联）：
- 涨：`color:#e60000`；跌：`color:#009944`
- 重点数字：`font-weight:700` + `border-bottom:1px dashed <同色>`（虚下划线）
- 结构：标题 → 数据截至时间 → 标签 → ① 一句话定调 ② 隔夜美股 ③ 日韩开盘 ④ 重点解读 ⑤ 今日观察位 → 数据来源与免责声明

### 4. 发布到固定链接
```bash
node .codebuddy/skills/asia-morning-brief/scripts/publish_via_api.js
```
脚本会：GET 固定文件取 sha → base64 编码本地 HTML → PUT 回同一路径。**必须看到 `PUBLISH_OK` 才算发布成功**；失败时如实报告错误，不得谎报。

### 5. 校验（可选但推荐）
```bash
node .codebuddy/skills/asia-morning-brief/scripts/verify_brief.js
```
检查 HTML 内的日期是否等于今天、是否残留其他年份/日期的字样，输出 `VERIFY_OK` 或列出可疑项。

### 6. 输出给用户
给出三样：
1. **可复制正文**（纯文本，涨跌用【红+X%】/【绿-X%】标注，关键处带具体点位）
2. **永久链接**：`https://yangkaiming.github.io/asia-morning-brief/asia_morning_latest.html`
3. 本地文件路径

## 铁律
- 数据必须严格对应真实当前日期与年份，**绝不混入其他年份、过期日期或未经验证的脏数据**（历史上曾误用一条标注为当天却显示低开的数据，把高开写成低开）。
- 抓不到真实数据时如实写"数据待确认"，**禁止编造或推算**。
- 涨红跌绿不得颠倒。
- 未确认 `PUBLISH_OK` 前不得声称已发布。

## 已踩过的坑（勿重复）
- **jsDelivr 不能分发 HTML**：会 302 跳到 raw 并返回 `text/plain`，样式全丢。HTML 托管一律用 GitHub Pages。
- **cloudflared trycloudflare 随机域名在移动网络常被污染**（出现 404），不可作为长期链接，只作临时备用。
- **raw.githack.com 国内不可达**。
- **私有仓库走不了 CDN**，仓库必须 public。
- **微信/ClawBot 通道没有附件投递工具**：无法把 .html 作为附件发出，只能给下载链接（可用 GitHub Pages 链接让手机自行打开/保存）。
- 移动网页端公众号粘贴会丢样式，需用 HTML 或让用户在电脑上完成最终粘贴。
