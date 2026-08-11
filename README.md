# 💍 简婚记 - 一站式备婚管家与人情礼金账本

<p align="center">
  <strong>高颜值 · 极简轻奢 · 响应式设计 · 云端多端实时同步</strong>
</p>

---

## 📖 项目简介

**简婚记 (Sweet Wedding Planner)** 是一款专为准新人打造的高颜值、全功能婚礼备婚管理系统。系统涵盖婚礼倒计时看板、备婚待办事项清单、婚礼支出预算账单、宾客人情礼金管理等核心功能，帮助新人轻松把控婚礼全流程，理性消费，理性记账，拒绝超支与遗漏。

---

## ✨ 核心功能亮点

- 💖 **婚礼倒计时 & 单屏概览看板**
  - 新人专属姓名（书法行书字体 `华文行楷 / Ma Shan Zheng`）与婚礼吉日倒计时（天/时/分/秒）。
  - 桌面端单屏精简适配，无多余滚动条，一览全盘备婚进度与预算状态。
- 📋 **备婚待办事项清单**
  - 内置一站式备婚推荐清单模板（包含酒店、婚庆四大金刚、婚纱礼服、喜糖婚房等）。
  - 支持快捷新建、修改、删除、完成打钩（伴有彩带撒花动画效果）。
  - 支持详细备注记录与一键导出 CSV / PDF 表格。
- 💰 **预算与婚礼支出明细**
  - 动态设定备婚总预算，实时计算已花费总额、已付定金、待付尾款与剩余可用额度。
  - 交互式支出分类占比图表，超出预算自动触发智能警告。
  - **100% 通栏全宽明细账单表格**：电脑端一字排开清晰展示，拒绝狭窄横向滚动。
- 🎁 **宾客人情礼金账本**
  - 支持【收礼】与【随礼】分类记录，区分男方亲戚、女方亲戚、同事、同学朋友等关系分组。
  - 动态计算人情净额与笔数，支持关键词模糊搜索与导出。
- 🔐 **云端数据库 + 7天免登录鉴权**
  - 基于 Node.js + Express + 原子化 JSON 数据库，支持多手机、多电脑实时云同步。
  - 严格账户密码安全校验，自动签发 7 天免登录凭证 Token。

---

## 🛠️ 技术栈

- **前端**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox, CSS Grid), ES6+ JavaScript
- **图表 & 动画**: Chart.js, Chartjs-Plugin-DataLabels, Canvas-Confetti
- **图标与字体**: FontAwesome 6, Google Fonts (Ma Shan Zheng 毛笔行书, Outfit, Cinzel)
- **后端**: Node.js, Express, CORS, FS 本地原子化 JSON 数据库

---

## 📁 目录结构

```
wedding_planner/
├── index.html              # 网页主入口 (单页应用 SPA)
├── logo.png                # 系统 Logo 矢量图标
├── server.js               # Node.js + Express 后端服务与云数据库 API
├── css/
│   └── style.css           # 全局样式表 (包含高颜值 UI 变量与响应式适配)
├── js/
│   └── app_v3.js           # 前端核心业务逻辑与状态持久化控制
├── data/
│   └── wedding_planner_db.json  # 云端用户与备婚数据持久化 JSON 库
├── package.json            # Node.js 项目配置文件
└── README.md               # 项目说明文档
```

---

## 🚀 部署与运行指南

### 1. 本地/服务器运行
1. 克隆本项目：
   ```bash
   git clone https://github.com/380772239/wedding_planner.git
   cd wedding_planner
   ```
2. 安装依赖：
   ```bash
   npm install
   ```
3. 启动服务端：
   ```bash
   npm start
   # 或 node server.js
   ```
4. 浏览器访问：`http://localhost:3535`

---

### 2. 宝塔面板 (Baota Panel) 部署教程

1. **新建 Node 项目**：
   - 宝塔面板 -> **Node项目管理** -> 添加项目。
   - 项目目录：选择代码根目录（例如 `/www/wwwroot/bh`）。
   - 启动选项：`start:node server.js`。
   - 项目端口：填 **`3535`**。
   - 点击保存并启动。

2. **Nginx 反向代理配置**：
   - 宝塔面板 -> **网站** -> 选择您的域名设置 -> **反向代理** -> 添加反向代理。
   - 代理名称：`api`
   - 目标URL：`http://127.0.0.1:3535`
   - 代理目录：`/api/`
   - 保存提交后即可打通多端数据同步！

---

## 📜 许可证

[MIT License](LICENSE) © 2026 简婚记 Team
