# 开发分享：AI 协作 + Git Worktree 并行模式与测试实践

## 会议目标
- 梳理本项目在马拉松期间的工程方法与落地结果
- 系统讲解 Git Worktree 如何支撑多智能体并行开发
- 结合自动化用例（A–E 类别）说明验证闭环的设计与执行

## 目录
1. 项目背景与目标
2. Git Worktree 专题（概念、拓扑、流程、命令、排障、最佳实践）
3. 自动化测试映射（A–E 类别分解与关键断言）
4. AI 协作与会话索引（结合 ai-usage）
5. Q&A 与附录（命令速查/端口表/参考资料）

---

## 1. 项目背景与目标
- 目标：8 小时内交付一个支持多人实时协作、版本历史、离线 LWW 冲突仲裁的富文本编辑器。
- 技术栈：React + TypeScript + Vite + Quill（前端）；Yjs + y-websocket（同步/CRDT）；Node.js + SQLite（持久化）；IndexedDB（离线）。
- 成果：通过 20 项 Playwright E2E 测试；完整沉淀 AI 协作记录与总结。
  - 提要：[README.md](file:///d:/ai/realtime-editor/README.md)；[MARATHON-SUMMARY.md](file:///d:/ai/realtime-editor/MARATHON-SUMMARY.md)。

---

## 2. Git Worktree 专题

### 2.1 概念与动机
- Worktree = 在同一 Git 仓库下维护多个“物理工作目录”，每个目录固定到一个分支。
- 动机：
  - 物理隔离依赖与缓存，避免 `node_modules`/锁文件/端口互相干扰。
  - 避免频繁切分支导致的编辑器索引重建和上下文污染。
  - 支撑多智能体（Agent-A/B/C）真正并行开发。

### 2.2 我们的 Worktree 拓扑
运行结果（节选）：
```
D:/ai/realtime-editor   52bebff [master]
D:/ai/Agent-A-worktree  c2029ce [Agent-A]
D:/ai/Agent-B-worktree  4ee4b59 [Agent-B]
D:/ai/Agent-C-worktree  be87e96 [Agent-C]
```
- 主仓库：[realtime-editor](file:///d:/ai/realtime-editor)
- 并行工作区：
  - [Agent-A-worktree](file:///d:/ai/Agent-A-worktree)（协作 UI/光标/在线列表）
  - [Agent-B-worktree](file:///d:/ai/Agent-B-worktree)（版本历史/SQLite/后端增强）
  - [Agent-C-worktree](file:///d:/ai/Agent-C-worktree)（离线支持/IndexedDB/LWW）

### 2.3 标准工作流程（并行模式）
1. 开工
   - 在主仓库创建新分支并开辟物理目录：
     ```powershell
     git worktree add ../Agent-A-worktree Agent-A
     git worktree add ../Agent-B-worktree Agent-B
     git worktree add ../Agent-C-worktree Agent-C
     ```
2. 开发与自测
   - 每个工作区独立安装依赖、运行前后端、对照对应测试项开发。
3. 合并与同步
   - 在各自工作区提交并 PR 到主分支（禁止交叉合并分支，必须通过 main 中转）。
   - 主分支合入后，其它工作区执行 `git pull` 或重置到最新合入点。
4. 端口规划（示例）
   - 前端：5173（A）/5175（B）/5177（C）；后端统一 1234。

### 2.4 常用命令速查
- 列表/新增/移除：
  ```powershell
  git worktree list
  git worktree add ../Agent-X-worktree Agent-X
  git worktree remove ../Agent-X-worktree  # 仅移除目录（不会删除分支）
  ```
- 分支与提交：
  ```powershell
  git -C ../Agent-A-worktree status
  git -C ../Agent-A-worktree commit -am "实现光标同步"
  git -C ../Agent-A-worktree push origin Agent-A
  ```
- 清理失效目录引用：
  ```powershell
  git worktree prune
  ```

### 2.5 常见问题与排障
- index.lock 冲突：确保无进程占用；必要时在对应 worktree 的 `.git` 目录下清理锁文件。
- 依赖冲突/端口占用：各自工作区独立安装依赖与端口；保持端口表唯一。
- 分支游离（detached HEAD）：进入对应 worktree 后显式 `git checkout <branch>`。
- 锁文件冲突（package-lock.json）：统一由合并到 main 的分支生成，再同步到其它 worktree。

### 2.6 最佳实践清单
- 一人/一智能体/一工作区；严禁在工作区间“交叉合并”。
- 以测试用例编号作为沟通语言（如“完成 Test-D2”）。
- 合入 main 的必要条件：对应类别用例 100% 通过，并更新 [TEST-RESULT.md](file:///d:/ai/realtime-editor/TEST-RESULT.md)。

---

## 3. 自动化测试映射（A–E 类别）
测试入口与文档：[README.md → 自动化测试运行方式](file:///d:/ai/realtime-editor/README.md#L61-L79)。用例实现位于：
- [category-a.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts)
- [category-b.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts)
- [category-c.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts)
- [category-d.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts)
- [category-e.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-e.spec.ts)

### 类别 A：基础编辑
- A1 文本输入与保存：首次输入后刷新仍存在（IndexedDB 持久化）。参见 [A1 断言](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts#L18-L21)。
- A2 格式应用：Hello 加粗、World 斜体，检查 HTML 标记。参见 [A2 断言](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts#L41-L44)。
- A3 复杂格式：H1/列表/超链接组合校验。参见 [A3 断言](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts#L61-L68)。
- A4 大文本处理：10000 字渲染耗时 < 500ms。参见 [A4 断言](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts#L79-L81)。

### 类别 B：实时协作
- B1 双端并发：A/B 编辑后内容一致。参见 [B1 断言](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts#L31-L37)。
- B2 光标显示：A 端能看到 B 的 `.ql-cursor`。参见 [B2 断言](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts#L55-L61)。
- B3 冲突解决：同位置插入，最终一致且匹配两种顺序之一。参见 [B3 断言](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts#L83-L89)。
- B4 加入/离开通知与在线人数：参见 [B4 断言](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts#L113-L120)。
- B5 三用户压力：30+ 字符一致性校验。参见 [B5 断言](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts#L158-L165)。

### 类别 C：版本历史
- C1 自动保存 ≥3 个版本。参见 [C1 断言](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts#L24-L28)。
- C2 版本内容正确性（版本1/版本2）。参见 [C2 断言](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts#L47-L51)。
- C3 回滚后 A/B 同步看到旧内容。参见 [C3 断言](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts#L80-L85)。
- C4 保留最近 ≤50 个版本。参见 [C4 断言](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts#L101-L105)。

### 类别 D：离线支持（LWW）
- D1 离线编辑 → 恢复后自动合并并提示。参见 [D1 断言](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts#L26-L34)。
- D2 离线冲突：较晚提交（B）胜出，所有端一致。参见 [D2 断言](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts#L63-L68)。
- D3 长时间离线恢复后一致。参见 [D3 断言](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts#L82-L86)。
- D4 离线状态提示显隐正确。参见 [D4 断言](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts#L92-L97)。

### 类别 E：性能与稳定性
- E1 100KB 文档加载 <3s；多端编辑响应 <200ms。参见 [E1 断言](file:///d:/ai/realtime-editor/frontend/tests/category-e.spec.ts#L25-L55)。
- E2 1 分钟高频编辑后多端一致。参见 [E2 断言](file:///d:/ai/realtime-editor/frontend/tests/category-e.spec.ts#L83-L90)。
- E3 多上下文并发连接，前 5 个编辑，所有端一致。参见 [E3 断言](file:///d:/ai/realtime-editor/frontend/tests/category-e.spec.ts#L118-L126)。

> 运行步骤（Windows PowerShell）：
> ```powershell
> # 1) 启动后端
> cd d:\ai\realtime-editor\backend
> npm install
> npm start
>
> # 2) 启动前端
> cd d:\ai\realtime-editor\frontend
> npm install
> npm run dev
>
> # 3) 运行测试（新终端，保持前后端已运行）
> cd d:\ai\realtime-editor\frontend
> npx playwright test
> # 仅终端输出（CI风格）
> $env:CI="1"; npx playwright test --reporter=line
> ```

---

## 4. AI 协作与会话索引
- 总览报告：[ai-usage/summary.md](file:///d:/ai/realtime-editor/ai-usage/summary.md)
- 代表性会话（结合 Worktree 实践）：
  - Session 03：建立并行模型（Agent 分工与 Worktree 接入）→ 见索引于 [summary.md](file:///d:/ai/realtime-editor/ai-usage/summary.md#L35-L58)。
  - Session 06：串行阻塞重构为三线并行 → 提升效率显著。
  - Session 07：A/B 模块合并与锁文件冲突解决 → 规范“main 中转”。
  - Session 08/15/16/17/18/19/20：离线幂等性重构与竞争抑制（Agent-C）。
- 全部会话目录：[ai-usage](file:///d:/ai/realtime-editor/ai-usage)
  - 示例： [session-01.md](file:///d:/ai/realtime-editor/ai-usage/session-01.md) … [session-20.md](file:///d:/ai/realtime-editor/ai-usage/session-20.md)

---

## 5. Q&A 与附录

### 常见问题
- 为什么不用多分支 + 频繁切换？
  - 切换分支的隐性成本（依赖/缓存/端口/编辑器索引）远高于多工作区物理隔离。
- Worktree 会导致仓库膨胀吗？
  - 不会。对象数据库仍是同一份，仅多了若干工作目录（硬链接/引用）。
- 合并策略与冲突避免？
  - 一律通过 main 中转；落地后其它工作区同步 main，避免交叉合并与锁文件风暴。

### 命令速查
```powershell
git worktree list
git worktree add ../Agent-X-worktree Agent-X
git worktree remove ../Agent-X-worktree
git worktree prune
```

### 端口表（示例）
- 后端（WebSocket + REST）：1234
- 前端（Vite）：A/5173，B/5175，C/5177

### 参考资料
- 项目综述：[README.md](file:///d:/ai/realtime-editor/README.md)
- 测试文件：
  - [category-a.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-a.spec.ts)
  - [category-b.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-b.spec.ts)
  - [category-c.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-c.spec.ts)
  - [category-d.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-d.spec.ts)
  - [category-e.spec.ts](file:///d:/ai/realtime-editor/frontend/tests/category-e.spec.ts)

---

以上内容可直接用于会议分享，包含 Worktree 实操流程、测试映射与会话索引，便于参会者快速对齐原理与复现实验。*** End Patch*** }```】}  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }  }
