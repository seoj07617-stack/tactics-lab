# TacticLab · 青训战术室

面向教练员的五人制 / 八人制战术与训练课设计工具。
线上地址：https://seoj07617-stack.github.io/tactics-lab/

## 功能

- **阵型库**：五人制（1-2-1 菱形 / 4-0 轮转 / 2-2 / 3-1 / 2-1-1）与八人制（3-3-1 / 3-2-2 / 2-3-2 / 3-1-3 / 4-2-1 / 2-4-1），含角色分工、优劣势、适用场景
- **战术生成**：按赛制 × 攻防阶段 × 风格 × 阵型 × 难度生成套路，SVG 球场逐帧动画（跑位虚线 / 传球实线 / 运球粗线 / 射门橙线），附指导要点与分步讲解
- **训练课设计**：主题 × 年龄段（U8-U10 / U11-U12 / U13+）× 时长（45-90 分钟）→ 完整教案（热身 → 技术 → 技能对抗 → 主题比赛 SSG → 收束提问），含进阶/降阶方案，可打印
- **我的收藏**：localStorage 本地保存战术与教案，一键重放
- **方法与依据**：所有内容的体系出处

## 内容依据

- 英格兰 DNA（The FA）六大核心能力：Scanning / Timing / Movement / Positioning / Deception / Techniques
- 英格兰四角模型（Four Corner Model）——训练课结构
- 西班牙 Fútbol 8 基层赛制（RFEF / 大区足协）——八人制内容
- FIFA 五人制足球教练手册——五人制阵型与轮转体系
- LaLiga 位置足球 / Rondo 传统——技术练习模块
- UEFA Training Ground——压迫与转换主题交叉印证
- FIFA 五人制竞赛规则——4 秒、门将再触球等规则要点已核对

## 本地运行

双击 `serve.ps1`（右键 → 使用 PowerShell 运行），本机访问 http://localhost:8787（占用则自动换 8788），手机/平板连同一 WiFi 访问窗口里显示的局域网地址。

## 部署

1. 确认目录里有 `.token`（GitHub PAT，repo 权限）
2. 右键 `deploy.ps1` → 使用 PowerShell 运行
3. 原子提交上传，1-3 分钟后 Pages 构建生效

## 技术

纯静态 HTML/CSS/JS，零依赖零构建。SVG 球场渲染 + 步骤动画引擎（`js/pitch.js`），内容与逻辑分离（`js/data.js` / `js/app.js`）。
