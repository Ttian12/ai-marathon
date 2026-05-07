# AI 协作上下文 (AI-COLLABORATION-CONTEXT.md)

本文件是专为多智能体 (Agent-A, B, C) 设计的“协作接力棒”。

---

## 1. 任务背景 (Context)

### 项目目标
开发一个满足 20 项测试用例的实时协作富文本编辑器。

### 智能体身份指引 (Agent Identity)
目前项目已进入**多智能体并行攻坚阶段**。请根据您所在的 Git 分支执行对应任务：
- **Agent-A**: 负责前端协作 UI (光标、在线列表、格式工具栏)。
- **Agent-B**: 负责后端持久化与版本历史 (SQLite)。
- **Agent-C**: 负责前端离线支持与状态恢复 (IndexedDB, LWW)。

---

## 2. 当前状态 (Status)

### 任务进度
- **总体进度**: 60% (协作增强阶段完成)
- **已完成**:
    - [x] 基础项目骨架、集成 Quill + Yjs + y-websocket。
    - [x] 通过 Test-A1, Test-B1, Test-A4 核心测试并合并至 `main`。
    - [x] **Agent-B**: 攻坚完成 Test-B2, Test-B4, Test-A2/A3, Test-B5 (协作增强)。
- **当前任务**:
    - [ ] **Agent-A (并行)**: 攻坚 Test-B2, Test-B4, Test-A2/A3。 (Agent-B 已在 Worktree 中协助完成，待合并)
    - [ ] **Agent-B (并行)**: 任务已完成，准备合并至 `main`。
    - [ ] **Agent-C (并行)**: 攻坚 Test-D1/D2/D3/D4 (离线支持与 LWW)。

---

## 3. 分支协作流程 (Branch Workflow)

### 1. 确认工作区
由于是并行开发，请务必确认您正在操作自己的独立 Worktree：
- **Agent-A**: `D:\ai\Agent-A-worktree`
- **Agent-B**: `D:\ai\Agent-B-worktree`
- **Agent-C**: `D:\ai\Agent-C-worktree`

### 2. 开发与自测
在各自的工作区内，根据 `DEVELOPMENT-PLAN.md` 中定义的 **测试用例** 进行开发。
- **Agent-B** 需通过: Test-B2, Test-B4, Test-A2/A3, Test-B5。
- **Agent-C** 需通过: Test-C1-C4, Test-D1-D4。

### 3. 合并申请
当且仅当该阶段的所有测试用例 100% 通过后，才可合并至 `main`:
1. 更新 `TEST-RESULT.md`。
2. 将代码提交并合并至 `main` 分支。
3. 通知用户及其他智能体。

---

## 4. 给新智能体的提示 (Tips)

### 快速识别
- 请运行 `git branch` 查看您当前的身份。
- 阅读 `DEVELOPMENT-PLAN.md` 确定您需要攻克的**测试用例编号**。

### 代码质量
- 严禁在 Agent 分支之间直接交叉合并，必须通过 `main` 中转。
- 所有 Yjs 逻辑需保持对离线支持的兼容性。

---

## 5. 待办清单 (Pending Tasks)

请参见 `DEVELOPMENT-PLAN.md` 中的详细任务清单。
当完成任何任务时，请务必同步更新此文档的“当前状态”部分。
---
*注意：本项目支持多智能体并行工作，请确保您的修改不破坏其他分支的测试依赖。*
