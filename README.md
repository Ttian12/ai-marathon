# 实时协作文档编辑器 (Realtime Collaborative Editor)

本项目旨在实现一个支持多人实时协作的富文本编辑器。项目核心解决了实时同步、冲突解决和离线支持等技术挑战。

## 一、技术栈

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS
- **富文本编辑器**：Quill.js
- **实时同步与冲突解决 (CRDT)**：Yjs + y-quill
- **后端服务**：Node.js + Express + y-websocket
- **数据持久化**：
  - 前端：IndexedDB (离线缓存) + localStorage (LWW状态保存)
  - 后端：SQLite (历史版本记录)

## 二、主要功能

1. **富文本编辑**：支持加粗、斜体、下划线、H1-H3标题、列表、超链接等。
2. **实时协作**：支持多用户并发编辑，实时显示他人光标位置与颜色，动态更新在线用户列表及加入/离开通知。
3. **版本历史**：后端自动定时保存文档快照（最多50个），支持查看历史记录并一键回滚。
4. **离线支持 (LWW策略)**：断网时可继续编辑，界面显示“离线模式”；恢复网络后自动同步，采用优化的 Last-Write-Wins (LWW) 策略解决离线冲突，防止内容重复覆盖。

## 三、快速开始

本项目分为前端和后端两个独立的服务，需要分别启动。

### 1. 环境要求
- Node.js (v18 或更高版本)
- npm 或 yarn

### 2. 启动后端服务 (WebSocket + 版本历史 SQLite)
打开终端，执行：
```bash
cd backend
npm install
npm start
```
后端默认监听：`http://localhost:1234`（可通过环境变量 `PORT` 修改）。

### 3. 启动前端服务 (React & Vite)
打开另一个新的终端，执行：
```bash
cd frontend
npm install
npm run dev
```
前端默认监听：`http://localhost:5173`（Vite 已开启 `host: true`，支持局域网访问）。

## 四、局域网访问 (同 Wi-Fi / 同网段)

前端使用“当前访问域名”动态推导后端地址，因此同网段设备打开你电脑的前端地址即可正常连后端。

1. 确保后端在你电脑上运行（默认端口 `1234`）。
2. 确保前端在你电脑上运行（默认端口 `5173`）。
3. 手机/另一台电脑访问：`http://<你的电脑IP>:5173/`（例如 `http://192.168.2.253:5173/`）。
4. 若访问失败，检查 Windows 防火墙是否放行端口 `5173`（前端）和 `1234`（后端）。

可选：手动指定后端地址（覆盖自动推导），在前端启动前设置环境变量：
- `VITE_API_ORIGIN`：版本历史 API（例如 `http://192.168.2.253:1234`）
- `VITE_WS_ORIGIN`：协作 WebSocket（例如 `ws://192.168.2.253:1234`）

## 五、自动化测试运行方式

本项目包含 20 个 Playwright E2E 测试用例，涵盖基础编辑、实时协作、版本历史、离线支持和性能测试。

确保前端和后端服务均已启动，然后在新的终端中运行：
```bash
cd frontend
npx playwright test
```
查看 HTML 测试报告：
```bash
npx playwright show-report
```
如果你只想在终端输出且避免打开报告服务，可使用：
```bash
cd frontend
$env:CI="1"; npx playwright test --reporter=line
```

## 六、项目结构说明

```text
/
├── backend/            # 后端 Node.js 代码
│   ├── server.js       # WebSocket 和 Express 服务
│   ├── versions.db     # SQLite 数据库文件 (运行时生成)
│   └── yjs-storage/    # 协作增量存储 (运行时生成)
├── frontend/           # 前端 React 代码
│   ├── src/            # 核心业务逻辑 (App.tsx 包含 Yjs 绑定)
│   └── tests/          # Playwright 自动化测试用例
├── ai-usage/           # AI 协作记录与总结报告
│   ├── session-01.md
│   ├── session-02.md
│   ├── ...
│   ├── session-20.md
│   └── summary.md
├── AI协作记录规范参考.md
├── AI-COLLABORATION-CONTEXT.md
├── DEVELOPMENT-PLAN.md
├── UNDERSTANDING-AGENT-B.md
├── TEST-RESULT.md      # 20项测试用例执行结果报告
└── README.md           # 本说明文件
```

