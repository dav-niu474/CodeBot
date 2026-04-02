<div align="center">

# 🤖 CodeBot Agent

**Claude Code 完整能力的 Web 复刻版 — 集成 NVIDIA 免费 AI 大模型**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-188_免费模型-76B900?logo=nvidia)](https://build.nvidia.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**完全复刻 Claude Code 源码(1884文件/118,442行)的所有核心架构**  
基于 [53AI深度调研报告](https://www.53ai.com/news/OpenSourceLLM/2026040160351.html) + [claude-code源码分析](https://github.com/chujianyun/claude-code)

---

</div>

## ✨ 功能总览

| 能力模块 | Claude Code规格 | CodeBot Agent状态 | 说明 |
|:---|:---:|:---:|:---|
| **工具系统** | 44个 | ✅ 已实现 | 14核心 + 25延迟加载 + 5特性门控 |
| **运行模式** | 10种 | ✅ 已实现 | Interactive / KAIROS / Plan / Voice / Coordinator / Swarm / Teammate / UltraPlan / Dream / Worktree |
| **多Agent技术路线** | 3条 | ✅ 已实现 | Coordinator(主从) / Swarm(对等) / Teammate(进程内) |
| **记忆系统** | 4层 | ✅ 已实现 | Session Memory / Memdir / Magic Docs / Team Sync |
| **安全防护** | 7层 | ✅ 已实现 | 权限三级制 / 策略回退 / Hook拦截 / AI分类器 / Bash沙箱 / 文件防护 / 秘密扫描 |
| **特性标志** | 16个 | ✅ 已实现 | KAIROS / PROACTIVE / VOICE / COORDINATOR / SWARM / BRIDGE / DREAM / MAGIC_DOCS / TEAM_SYNC / ULTRAPLAN / MCP / LSP / POWER_SHELL / REPL / SLEEP / CRON |
| **Token管理** | 3层压缩+缓存 | ✅ 已实现 | Snip(预防性) / Auto(阈值触发) / Responsive(紧急兜底) + Cache Breakpoints |
| **DreamTask** | AI做梦系统 | ✅ 已实现 | 后台知识蒸馏，24h+5会话自动触发 |
| **AI模型** | — | ✅ 已实现 | NVIDIA NIM API — 188个免费模型，OpenAI兼容 |
| **Buddy电子宠物** | 18种 | 🔜 计划中 | 确定性生成外观 + 学习型个性 |
| **Bridge远程控制** | 3代架构 | 🔜 计划中 | 轮询 → WebSocket REPL → 直连 |
| **Voice语音模式** | 语音交互 | 🔜 计划中 | TTS + STT 集成 |
| **插件生态** | 18内置技能 | 🔜 计划中 | MCP 7种传输 + 7层配置作用域 |

---

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────────────┐
│                    CodeBot Agent v2.5                            │
│                                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │Dashboard │ │   Chat   │ │Model Hub │ │     Modes (10)   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │  Tools   │ │  Skills  │ │  Memory  │ │  Agents (3路线)  │   │
│  │  (44个)  │ │  (18个)  │ │  (4层)   │ │                  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐   │
│  │Security  │ │ Settings │ │    AI Capabilities           │   │
│  │  (7层)   │ │          │ │                              │   │
│  └──────────┘ └──────────┘ └──────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  Core Engine (Query Loop)                 │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │   │
│  │  │ 16 Feature  │  │  Token 压缩   │  │  Tool Search  │  │   │
│  │  │   Flags     │  │  3层 + 缓存   │  │  动态加载     │  │   │
│  │  └─────────────┘  └──────────────┘  └───────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              NVIDIA NIM API (188 免费模型)               │   │
│  │  Llama 3.3 70B │ Gemma 3 27B │ Qwen 2.5 Coder 32B │... │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Prisma ORM + SQLite                          │   │
│  │  Session │ Message │ Memory │ Agent │ ToolDef │ SkillDef  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧠 核心能力详解

### 1. 44工具系统

参照Claude Code的完整工具注册表，分为三级加载策略：

**核心工具 (14个)** — 始终加载
| 工具 | 说明 | 风险等级 |
|:---|:---|:---:|
| BashTool | Shell命令沙箱执行 | 🔴 High |
| FileReadTool | 读取文件内容 | 🟢 Low |
| FileWriteTool | 创建/写入文件 | 🟡 Medium |
| FileEditTool | 精确查找替换编辑 | 🟡 Medium |
| GlobTool | Glob文件模式匹配 | 🟢 Low |
| GrepTool | 正则表达式内容搜索 | 🟢 Low |
| AgentTool | 子Agent派生与编排 | 🔴 High |
| WebSearchTool | Web搜索引擎 | 🟢 Low |
| WebFetchTool | Web页面内容提取 | 🟢 Low |
| SendMessageTool | 发送消息 | 🟢 Low |
| TodoWriteTool | 任务列表管理 | 🟢 Low |
| AskUserQuestionTool | 向用户提问 | 🟢 Low |
| NotebookEditTool | Jupyter Notebook编辑 | 🟡 Medium |
| BriefTool | 上下文摘要生成 | 🟢 Low |

**延迟加载 (25个)** — ToolSearch动态注入
MCP / LSP / Skill / Plan Mode / Worktree / Task CRUD (6个) / Team CRUD / Config / Remote Trigger / Cron / PowerShell 等

**特性门控 (5个)** — 编译时开关
SleepTool / REPLTool / VoiceTool / DreamTaskTool / MagicDocsTool

### 2. 10种运行模式

| 模式 | 说明 | 自主性 | 对话式 |
|:---|:---|:---:|:---:|
| 🟢 **Interactive** | 默认交互模式 | 被动响应 | ✅ |
| 🟡 **KAIROS** | 7×24主动自主Agent，监控环境变化 | 完全自主 | ❌ |
| 🔵 **Plan** | 规划模式，只创建计划不执行 | 被动响应 | ✅ |
| 🟢 **Worktree** | Git Worktree隔离工作区 | 被动响应 | ✅ |
| 🟣 **Voice** | 语音交互模式 | 被动响应 | ✅ |
| 🟠 **Coordinator** | Leader-Worker多Agent协调 | 部分自主 | ✅ |
| 🔴 **Swarm** | 对等协作多Agent并行 | 完全自主 | ✅ |
| 🔷 **Teammate** | 进程内Agent队友 | 被动响应 | ✅ |
| 🟤 **UltraPlan** | 深度多步规划(远程浏览器增强) | 部分自主 | ✅ |
| 🩷 **Dream** | 后台异步记忆巩固(知识蒸馏) | 完全自主 | ❌ |

### 3. 四层记忆系统

```
┌─────────────────────────────────────────────────┐
│  Layer 4: Team Sync Memory (团队知识同步)        │
│  ├─ REST API Delta更新                            │
│  ├─ SHA-256变更检测                                │
│  ├─ 秘密扫描器                                     │
│  └─ 服务器优先冲突解决                              │
├─────────────────────────────────────────────────┤
│  Layer 3: Magic Docs (AI维护的活文档)             │
│  ├─ # MAGIC DOC: 标记触发                          │
│  ├─ 受限Agent定期更新                              │
│  └─ 随项目演进自动维护                              │
├─────────────────────────────────────────────────┤
│  Layer 2: Memdir (项目记忆目录)                    │
│  ├─ MEMORY.md 入口 (200行/25KB限制)               │
│  ├─ 个人记忆 + 团队记忆                            │
│  └─ 文件路径索引                                    │
├─────────────────────────────────────────────────┤
│  Layer 1: Session Memory (会话内记忆)              │
│  ├─ 子Agent周期性提取                              │
│  ├─ Token/工具调用阈值触发                         │
│  └─ 长对话不丢失关键上下文                           │
└─────────────────────────────────────────────────┘
```

### 4. 三条多Agent技术路线

| 路线 | 模式 | 架构 | 适用场景 |
|:---|:---|:---|:---|
| **Coordinator** | 主从协调 | Leader全局理解 → Worker边界执行 → Leader审核合并 | 复杂任务拆解 |
| **Swarm** | 对等协作 | Agent之间平等通信 → 共享发现 → 协同决策 | 并行探索 |
| **Teammate** | 进程内队友 | 同一Node进程 → Mailbox隔离通信 → 50条消息限制 | 轻量协作 |

### 5. 七层安全防护

1. **权限三级制** — Allow / Deny / Ask，优先级: settings > CLI > command > session
2. **策略回退** — 连续3次deny或累计20次deny自动降级
3. **Hook拦截** — PreToolUse / PostToolUse 钩子注入自定义安全策略
4. **AI分类器** — TRANSCRIPT_CLASSIFIER + Fail-closed设计
5. **Bash沙箱** — 25项安全检查 + 迭代定点算法 + Zsh防御 + 环境变量劫持检测
6. **文件系统防护** — 路径遍历预防 + Symlink保护 (O_NOFOLLOW)
7. **秘密扫描** — API Key / 密码 / Token 检测，防止通过团队同步泄露

### 6. Token三层压缩

| 压缩策略 | 触发条件 | 说明 |
|:---|:---|:---|
| **Snip (预防性)** | 持续监控 | 远离焦点的旧工具输出静默替换为摘要 |
| **Auto (阈值)** | 有效窗口 - 13,000 tokens | 独立LLM调用压缩对话历史为结构化摘要 |
| **Responsive (紧急)** | prompt-too-long 错误 | 立即压缩 + 缩减maxOutputTokens，最多重试3次 |
| **Cache (优化)** | 始终启用 | 精确插入cache breakpoints，输入成本降低90% |

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Bun (推荐)
- Git

### 安装

```bash
# 克隆仓库
git clone https://github.com/dav-niu474/CodeBot.git
cd CodeBot

# 安装依赖
bun install

# 初始化数据库
bun run db:push

# 启动开发服务器
bun run dev
```

### 配置

在 `src/lib/nvidia.ts` 中配置你的 NVIDIA API Key：

```typescript
const NVIDIA_API_KEY = "your-nvidia-api-key-here";
```

获取免费API Key: [https://build.nvidia.com](https://build.nvidia.com)

---

## 📁 项目结构

```
CodeBot/
├── prisma/
│   └── schema.prisma          # 数据库模型 (12个表)
├── db/
│   └── custom.db              # SQLite数据库文件
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/stream/   # NVIDIA流式对话API
│   │   │   ├── models/        # 模型列表+测试API
│   │   │   ├── custom-models/ # 自定义模型CRUD API
│   │   │   ├── memory/        # 4层记忆CRUD
│   │   │   ├── agents/        # 多Agent API (coordinator/swarm)
│   │   │   ├── sessions/      # 会话管理
│   │   │   ├── tools/         # 工具管理
│   │   │   ├── skills/        # 技能管理
│   │   │   ├── git/           # Git集成API
│   │   │   ├── analytics/     # Token分析API
│   │   │   ├── settings/      # Agent配置API
│   │   │   └── ai/            # AI能力API (code-analyze/image-analyze/web-search)
│   │   ├── globals.css        # 全局样式 (暗色主题+富文本)
│   │   ├── layout.tsx         # 根布局
│   │   └── page.tsx           # 主页面 (14视图路由)
│   ├── components/
│   │   ├── codebot/
│   │   │   ├── DashboardView.tsx      # 总览仪表盘 (v2.5)
│   │   │   ├── ChatView.tsx           # 对话视图 + 会话管理 + 模板库
│   │   │   ├── ModelHubView.tsx       # NVIDIA模型浏览器 + 自定义模型
│   │   │   ├── ToolsView.tsx          # 44工具管理
│   │   │   ├── ModesView.tsx          # 10运行模式
│   │   │   ├── MemoryView.tsx         # 4层记忆系统
│   │   │   ├── AgentsView.tsx         # 多Agent面板
│   │   │   ├── SecurityView.tsx       # 7层安全防护
│   │   │   ├── SkillsView.tsx         # 技能管理
│   │   │   ├── SettingsView.tsx       # Agent配置
│   │   │   ├── AICapabilitiesView.tsx # AI能力开关
│   │   │   ├── GitView.tsx            # Git集成管理
│   │   │   ├── AnalyticsView.tsx      # Token分析仪表盘
│   │   │   ├── MessageBubble.tsx      # 消息气泡 (富文本)
│   │   │   ├── RichContentRenderer.tsx # 富文本渲染引擎
│   │   │   ├── CommandPalette.tsx     # 命令面板 (Cmd+K)
│   │   │   ├── KeyboardShortcuts.tsx  # 快捷键帮助
│   │   │   └── Sidebar.tsx            # 导航侧边栏
│   │   └── ui/                  # shadcn/ui 组件库
│   ├── hooks/                 # React Hooks
│   ├── lib/
│   │   ├── types.ts           # 完整类型系统
│   │   ├── nvidia.ts          # NVIDIA API客户端
│   │   ├── db.ts              # Prisma数据库客户端
│   │   └── utils.ts           # 工具函数
│   └── store/
│       └── chat-store.ts      # Zustand状态管理
├── package.json
└── README.md
```

---

## 🛠️ 技术栈

| 技术 | 用途 | 版本 |
|:---|:---|:---|
| **Next.js** | React框架 (App Router, Standalone) | 16 |
| **TypeScript** | 类型安全 | 5 |
| **Tailwind CSS** | 样式系统 | 4 |
| **shadcn/ui** | UI组件库 | New York |
| **Framer Motion** | 动画 | 12 |
| **Zustand** | 状态管理 | 5 |
| **Prisma** | ORM (SQLite) | 6 |
| **react-markdown** | Markdown渲染 | 10 |
| **mermaid** | 流程图渲染 | 11 |
| **rehype-raw** | HTML标签支持 | 7 |
| **remark-gfm** | GitHub Flavored Markdown | 4 |
| **react-syntax-highlighter** | 代码高亮 | 15 |
| **date-fns** | 日期格式化 | 4 |
| **Lucide React** | 图标 | — |
| **NVIDIA NIM** | AI大模型API (188免费模型) | — |

---

## 🗺️ 版本路线图

### ✅ v2.1.0 — 基础架构 (2025-07)

**核心框架搭建 (11,600+ 行代码)**

- [x] NVIDIA NIM API 集成 (188免费模型, OpenAI兼容)
- [x] 44工具系统完整定义 (14核心 + 25延迟加载 + 5特性门控)
- [x] 10种运行模式 (Interactive / KAIROS / Plan / Voice / Coordinator / Swarm / Teammate / UltraPlan / Dream / Worktree)
- [x] 3条多Agent技术路线 (Coordinator / Swarm / Teammate)
- [x] 4层记忆系统 (Session / Memdir / Magic Docs / Team Sync)
- [x] 7层安全防护体系
- [x] 16个特性标志系统
- [x] Token三层压缩 + 缓存类型系统
- [x] 11个完整UI视图
- [x] 流式对话 + 实时SSE
- [x] 模型选择器 + 快速测试
- [x] Prisma 数据库 (9个模型)
- [x] 暗色主题 + 响应式设计

### ✅ v2.4.0 — 交互增强 (2025-07)

**6大新特性, UI全面优化**

- [x] **命令面板 (Command Palette)** — `Cmd/Ctrl+K` 全局搜索, 12视图快速导航, 最近历史记录
- [x] **Git集成** — 提交日志/分支管理/文件变更/彩色Diff视图/代码统计
- [x] **聊天导出** — Markdown格式导出完整对话记录
- [x] **快捷键帮助** — `?` 键打开快捷键参考面板
- [x] **富文本渲染引擎** — Mermaid流程图/GFM表格/任务列表/代码高亮+复制/数学公式
- [x] **自定义模型接入** — OpenAI兼容API, 任意Base URL/Key, 支持流式/视觉
- [x] **SSE流式解析增强** — 3层容错: Content-Type检测 → JSON回退 → 原文捕获

### ✅ v2.5.0 — 会话与数据 (2025-07)

**会话管理 + Token分析 + 移动端适配**

- [x] **会话管理面板** — 侧边栏会话列表, 搜索/切换/删除, Token统计显示
- [x] **快捷模板库** — 12个编码提示模板, 分类标签, 一键插入
- [x] **Token分析仪表盘** — 总量统计/模型对比/7日趋势/成本估算
- [x] **移动端响应式** — 底部导航栏, 自适应网格, 头部精简, 标签页横滚
- [x] **Git分析视图** — 新增Git管理视图, 完整的Git API
- [x] **Dashboard升级** — v2.5版本标识, 新能力卡片, 更新日志

### 🔜 v3.0.0 — 工具执行引擎

**核心目标: 让44个工具真正可执行**

- [ ] **Query Loop引擎** — 完整的 思考→行动→观察 循环
- [ ] **Tool Use / Function Calling** — AI自动调用工具 (OpenAI function-calling格式)
- [ ] **Bash安全沙箱** — 25项安全检查实现 (参照 `bashSecurity.ts`)
- [ ] **文件操作工具** — FileRead / FileWrite / FileEdit 实际执行
- [ ] **搜索工具** — Glob / Grep 实际搜索项目文件
- [ ] **Web工具** — WebSearch / WebFetch 实际联网
- [ ] **ToolSearch动态加载** — 按需注入工具Schema，节省Token
- [ ] **工具权限审批流** — Allow/Deny/Ask 三级交互
- [ ] **子Agent工具** — AgentTool 派生执行子任务
- [ ] **TodoWrite工具** — 结构化任务列表

### 🔜 v3.5.0 — Token压缩与记忆

**核心目标: 长对话不丢失上下文**

- [ ] **Snip压缩** — 预防性旧工具输出替换为摘要
- [ ] **Auto压缩** — 阈值触发 (有效窗口-13,000 tokens)
- [ ] **Responsive压缩** — prompt-too-long紧急兜底
- [ ] **Cache Breakpoints** — API侧缓存，成本降低90%
- [ ] **微压缩** — FileEdit后精确删除旧FileRead结果
- [ ] **Session Memory** — 子Agent周期性提取关键信息
- [ ] **Memdir系统** — MEMORY.md 项目记忆目录
- [ ] **Magic Docs** — # MAGIC DOC: 标记自动文档
- [ ] **DreamTask** — 24h+5会话自动触发知识蒸馏

### 🔜 v4.0.0 — 多Agent实战

**核心目标: 3条路线全部可运行**

- [ ] **Coordinator模式** — Leader-Worker并行执行 (Git Worktree隔离)
- [ ] **Swarm模式** — 对等Agent通信 (Mailbox/消息队列)
- [ ] **Teammate模式** — 进程内Agent队友 (50条消息限制)
- [ ] **Agent通信协议** — AgentMessage (task/result/question/error/status/cancel)
- [ ] **Token预算分配** — 每个Agent独立Token计数
- [ ] **任务拆解算法** — 自动拆分复杂任务
- [ ] **结果聚合** — 多Agent输出汇总与冲突解决

### 🔜 v4.5.0 — 高级特性

- [ ] **KAIROS模式** — 7×24主动自主Agent
  - [ ] GitHub Webhook监听
  - [ ] Channel通知感知
  - [ ] 定时检查与触发
  - [ ] SleepTool 等待工具
- [ ] **UltraPlan模式** — 深度多步规划
- [ ] **Voice语音模式** — TTS + STT 集成
- [ ] **Bridge远程控制** — WebSocket REPL桥接
- [ ] **Buddy电子宠物** — 18种物种 + 学习型个性
- [ ] **插件生态** — MCP 7种传输 + 技能市场

### 🔜 v5.0.0 — 企业级

- [ ] **团队知识同步** — REST API + Delta更新 + 冲突解决
- [ ] **企业安全策略** — PreToolUse/PostToolUse Hook
- [ ] **审计日志** — 完整安全事件追踪
- [ ] **GrowthBook A/B测试** — 特性灰度发布
- [ ] **MCP生态** — 7种传输方式 + 7层配置作用域
- [ ] **移动端** — 独立移动应用 (commands/mobile)
- [ ] **多模型支持** — 除了NVIDIA外接入更多Provider
- [ ] **性能监控** — FPS追踪 / 内存使用 / Token成本

---

## 📊 代码统计

```
 TypeScript/TSX:  25,900+ 行
 源码文件:         101 个
 视图组件:         18 个 (codebot views)
 API路由:          15+ 个
 数据库模型:       12 个
 工具定义:        44 个
 运行模式:        10 个
 特性标志:        16 个
 安全层级:         7 层
 记忆层级:         4 层
 NVIDIA模型:     188 个 (免费)
```

---

## 📄 License

MIT License © 2025 dav-niu474

---

<div align="center">

**"Claude Code不是一个编程助手，它是一个AI操作系统的雏形。"**  
— 基于 Claude Code 0331版 npm source map 泄露源码分析

</div>
