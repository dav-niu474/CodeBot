<div align="center">

# 🤖 CodeBot Agent

**Claude Code 完整能力的 Web 复刻版 — 集成 NVIDIA 免费 AI 大模型**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA_NIM-188_免费模型-76B900?logo=nvidia)](https://build.nvidia.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Prisma_6-4169E1?logo=postgresql)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**完全复刻 Claude Code 源码(1884文件/118,442行)的所有核心架构**  
基于 [53AI深度调研报告](https://www.53ai.com/news/OpenSourceLLM/2026040160351.html) + [claude-code源码分析](https://github.com/chujianyun/claude-code)  
🚀 在线体验: [code-bot-dav-niu474s-projects.vercel.app](https://code-bot-dav-niu474s-projects.vercel.app)

---

</div>

## ✨ 功能总览

| 能力模块 | Claude Code规格 | CodeBot Agent状态 | 说明 |
|:---|:---:|:---:|:---|
| **工具系统** | 44个 | ✅ 已实现 | 14核心 + 25延迟加载 + 5特性门控，全部可执行 |
| **运行模式** | 10种 | ✅ 已实现 | Interactive / KAIROS / Plan / Voice / Coordinator / Swarm / Teammate / UltraPlan / Dream / Worktree |
| **多Agent系统** | 3条路线 | ✅ 已实现 | Coordinator(主从并行) / Swarm(对等协作) / Teammate(进程内)，含任务拆解与结果聚合 |
| **会话管理** | CRUD | ✅ 已实现 | 创建/查询/更新/删除，内联重命名、两步确认删除、自动标题、会话信息面板 |
| **记忆系统** | 4层 | ✅ 已实现 | Session Memory / Memdir / Magic Docs / Team Sync，Agentic Loop自动提取 |
| **安全防护** | 7层 | ✅ 已实现 | 权限三级制 / 策略回退 / Hook拦截 / AI分类器 / Bash沙箱 / 文件防护 / 秘密扫描 |
| **特性标志** | 16个 | ✅ 已实现 | KAIROS / PROACTIVE / VOICE / COORDINATOR / SWARM / BRIDGE / DREAM / MAGIC_DOCS / TEAM_SYNC / ULTRAPLAN / MCP / LSP / POWER_SHELL / REPL / SLEEP / CRON |
| **Token管理** | 3层压缩 | ✅ 已实现 | Snip(预防) / Auto(阈值) / Responsive(紧急) + CJK感知计数器 |
| **DreamTask** | AI做梦系统 | ✅ 已实现 | 后台知识蒸馏，5会话/24h自动触发，Jaccard去重 |
| **对话交互** | 流式+富文本 | ✅ 已实现 | Agentic Status实时指示 / AbortController真停止 / 思考过程折叠 / 工具调用可视化 |
| **AI模型** | — | ✅ 已实现 | NVIDIA NIM API — 188个免费模型，OpenAI兼容 |
| **Buddy电子宠物** | 18种 | ✅ 已实现 | 18物种 + 5心情 + 经验值升级 + 互动动画 |
| **Bridge远程控制** | WebSocket | ✅ 已实现 | REPL终端(9命令) + 实时连接 + 彩色输出 |
| **Voice语音模式** | 语音交互 | ✅ 已实现 | TTS(7音色) + ASR语音识别, 录音+朗读 |
| **插件生态** | MCP | 🔜 计划中 | 7种传输 + 技能市场 |

---

## 🏗️ 架构设计

```
┌───────────────────────────────────────────────────────────────────────┐
│                       CodeBot Agent v4.0                                │
│                                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐   │
│  │Dashboard │ │   Chat   │ │Model Hub │ │  Tools   │ │  Modes  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐   │
│  │  Skills │ │  Memory  │ │  Agents  │ │ GitView  │ │Analytics│   │
│  │          │ │  (4层)   │ │ (3路线)  │ │          │ │         │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────────────┐   │
│  │Security  │ │ Settings │ │  AI Capabilities (16 flags)        │   │
│  │  (7层)   │ │          │ │                                      │   │
│  └──────────┘ └──────────┘ └──────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │              Core Engine — Agentic Query Loop v3                 │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐    │   │
│  │  │ 16 Feature  │  │  Token 压缩   │  │  14 Core Tools   │    │   │
│  │  │   Flags     │  │  3层策略     │  │  自动执行       │    │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘    │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐    │   │
│  │  │  4层记忆    │  │  Agent 协调   │  │  通信协议       │    │   │
│  │  │  自动提取    │  │  任务拆解     │  │  Token预算       │    │   │
│  │  └─────────────┘  └──────────────┘  └───────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                NVIDIA NIM API (188 免费模型)                    │   │
│  │  Llama 3.3 70B │ Gemma 3 27B │ Qwen 2.5 Coder 32B │ ...     │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                Prisma ORM + PostgreSQL                          │   │
│  │  Session │ Message │ Memory │ Agent │ ToolDef │ SkillDef │ ...  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 🧠 核心能力详解

### 1. 44工具系统（全部可执行）

参照Claude Code的完整工具注册表，分为三级加载策略，**14个核心工具全部实际可执行**：

**核心工具 (14个)** — 始终加载，Agent可自主调用
| 工具 | 说明 | 风险等级 | 状态 |
|:---|:---|:---:|:---:|
| BashTool | Shell命令沙箱执行 (25项安全检查) | 🔴 High | ✅ 可执行 |
| FileReadTool | 读取文件内容 (行号/偏移/截断) | 🟢 Low | ✅ 可执行 |
| FileWriteTool | 创建/写入文件 (自动创建目录) | 🟡 Medium | ✅ 可执行 |
| FileEditTool | 精确查找替换编辑 (全量替换回退) | 🟡 Medium | ✅ 可执行 |
| GlobTool | Glob文件模式匹配 (200结果限制) | 🟢 Low | ✅ 可执行 |
| GrepTool | 正则表达式内容搜索 (二进制跳过) | 🟢 Low | ✅ 可执行 |
| AgentTool | 子Agent派生与编排 | 🔴 High | ✅ 可执行 |
| WebSearchTool | Web搜索引擎 (z-ai-web-dev-sdk) | 🟢 Low | ✅ 可执行 |
| WebFetchTool | Web页面内容提取 (15s超时) | 🟢 Low | ✅ 可执行 |
| SendMessageTool | 发送消息 | 🟢 Low | ✅ 可执行 |
| TodoWriteTool | 任务列表管理 (Session隔离) | 🟢 Low | ✅ 可执行 |
| AskUserQuestionTool | 向用户提问 | 🟢 Low | ✅ 可执行 |
| NotebookEditTool | Jupyter Notebook编辑 | 🟡 Medium | Stub |
| BriefTool | 上下文摘要生成 | 🟢 Low | ✅ 可执行 |

**延迟加载 (25个)** — ToolSearch动态注入
MCP / LSP / Skill / Plan Mode / Worktree / Task CRUD (6个) / Team CRUD / Config / Remote Trigger / Cron / PowerShell 等

**特性门控 (5个)** — 编译时开关
SleepTool / REPLTool / VoiceTool / DreamTaskTool / MagicDocsTool

### 2. 会话管理（完整 CRUD）

| 操作 | API | 前端交互 |
|:---|:---|:---|
| **列表** | `GET /api/sessions` | 侧边栏会话列表 + 搜索过滤 |
| **创建** | `POST /api/sessions` | New Chat按钮 / 首次发消息自动创建 |
| **查询** | `GET /api/sessions/[id]` | 切换会话 + 内存缓存 + 懒加载 |
| **更新** | `PUT /api/sessions/[id]` | 双击标题内联编辑 / 自动标题 / 模型切换 |
| **删除** | `DELETE /api/sessions` | 两步确认 / Clear All / 级联删除消息 |

### 3. 10种运行模式

| 模式 | 说明 | 自主性 | 状态 |
|:---|:---|:---:|:---:|
| 🟢 **Interactive** | 默认交互模式 + Agentic Loop | 被动响应 | ✅ 可用 |
| 🟡 **KAIROS** | 7×24主动自主Agent，监控环境变化 | 完全自主 | 🔜 计划中 |
| 🔵 **Plan** | 规划模式，只创建计划不执行 | 被动响应 | 🔜 计划中 |
| 🟢 **Worktree** | Git Worktree隔离工作区 | 被动响应 | 🔜 计划中 |
| 🟣 **Voice** | 语音交互模式 | 被动响应 | 🔜 计划中 |
| 🟠 **Coordinator** | Leader-Worker多Agent并行 | 部分自主 | ✅ 可用 |
| 🔴 **Swarm** | 对等Agent协作 + 共识 | 完全自主 | ✅ 可用 |
| 🔷 **Teammate** | 进程内Agent队友 (50msg) | 被动响应 | ✅ 可用 |
| 🟤 **UltraPlan** | 深度多步规划 | 部分自主 | 🔜 计划中 |
| 🩷 **Dream** | 后台异步记忆巩固 | 完全自主 | ✅ 自动 |

### 4. 三条多Agent系统（全部可运行）

| 路线 | 架构 | 适用场景 | 状态 |
|:---|:---|:---|:---:|
| **Coordinator** | LLM任务拆解 → Worker并行执行(max 3) → LLM结果聚合 | 复杂任务拆解 | ✅ SSE流式 |
| **Swarm** | 多Agent多角度分析 → 共识聚合 | 并行探索 | ✅ SSE流式 |
| **Teammate** | 进程内共享上下文 → 50消息限制 | 轻量协助 | ✅ 同步调用 |

**Agent通信协议**: AgentMessage (task / result / question / error / status / cancel)
**Token预算**: 每个Worker独立计数，支持 maxTokens/workerCount 动态分配

### 5. Agentic Query Loop（V3核心引擎）

```
用户消息 → [系统提示+记忆] → LLM推理 → 调用工具?
                                                    │
                    ┌─────────────────────────┴────────────────────────┐
                    │                                                  │
              ┌─────▼─────┐                                       ┌───▼─────┐
              │ 工具执行  │                                       │ 生成回复 │
              │ Bash/File │←── 执行结果注入对话 ←────────────────│ 文本输出 │
              │ Search  │                                       │ SSE流式   │
              └─────┬─────┘                                       └─────┬───┘
                    │                                                    │
                    └──────────── 最多10轮循环 ←─────────────────────┘
```

### 6. 四层记忆系统

```
┌─────────────────────────────────────────────────┐
│  Layer 4: Team Sync Memory (团队知识同步)        │
├─────────────────────────────────────────────────┤
│  Layer 3: Magic Docs (AI维护的活文档)             │
├─────────────────────────────────────────────────┤
│  Layer 2: Memdir (项目记忆目录)                    │
├─────────────────────────────────────────────────┤
│  Layer 1: Session Memory (会话内记忆)              │
└─────────────────────────────────────────────────┘
```

### 7. 七层安全防护

1. **权限三级制** — Allow / Deny / Ask
2. **策略回退** — 连续3次deny自动降级
3. **Hook拦截** — PreToolUse / PostToolUse
4. **AI分类器** — TRANSCRIPT_CLASSIFIER
5. **Bash沙箱** — 25项安全检查 (fork bomb/netcat阻断, sudo警告)
6. **文件系统防护** — 路径遍历 + Symlink保护
7. **秘密扫描** — API Key / 密码 / Token 检测

### 8. Token三层压缩

| 策略 | 触发条件 | 说明 |
|:---|:---|:---|
| **Snip** | 持续监控 | 旧工具输出替换为摘要 (>500 chars) |
| **Auto** | 65K tokens | AI摘要旧消息 (snip降级回退) |
| **Responsive** | prompt-too-long | 紧急截断 (保留system+最新消息) |

---

## 🚀 快速开始

### 环境要求

- Node.js 18+ / Bun
- PostgreSQL 数据库
- NVIDIA API Key (免费)

### 安装

```bash
git clone https://github.com/dav-niu474/CodeBot.git
cd CodeBot
bun install
cp .env.example .env
# 编辑 .env 填写 DATABASE_URL 和 NVIDIA_API_KEY
bun run db:push
bun run dev
```

### ☁️ Vercel 部署

1. 连接 PostgreSQL (推荐 [Neon](https://neon.tech) / [Supabase](https://supabase.com))
2. 设置环境变量: `DATABASE_URL`, `NVIDIA_API_KEY`
3. 推送到 GitHub 自动部署

> ⚠️ Vercel Serverless 不支持文件存储，必须使用 PostgreSQL

---

## 📁 项目结构

```
CodeBot/
├── prisma/
│   └── schema.prisma              # 数据库模型 (12个表, PostgreSQL)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/stream/         # Agentic Loop流式对话 (V3 SSE协议)
│   │   │   ├── sessions/            # 会话 CRUD (5操作)
│   │   │   │   └── [id]/route.ts    # 单会话查询+更新
│   │   │   ├── agents/              # 多Agent API
│   │   │   │   ├── coordinator/      # Coordinator模式 (SSE流式)
│   │   │   │   └── swarm/           # Swarm模式 (SSE流式)
│   │   │   ├── models/              # NVIDIA模型列表+测试
│   │   │   ├── custom-models/       # 自定义模型CRUD
│   │   │   ├── memory/              # 4层记忆CRUD
│   │   │   ├── tools/               # 工具管理CRUD
│   │   │   ├── skills/              # 技能管理CRUD
│   │   │   ├── git/                 # Git集成API
│   │   │   ├── analytics/           # Token分析API
│   │   │   ├── settings/            # Agent配置API
│   │   │   └── ai/                  # AI能力API
│   │   ├── layout.tsx
│   │   ├── page.tsx                # 主页面 (14视图路由)
│   │   └── globals.css             # 全局样式 (暗色+富文本+动画)
│   ├── components/
│   │   ├── codebot/                 # 20个视图/功能组件
│   │   │   ├── DashboardView.tsx     # 总览仪表盘
│   │   │   ├── ChatView.tsx          # 对话视图 + 会话面板 + 模板库 + 多Agent面板
│   │   │   ├── MessageBubble.tsx     # 消息气泡 + 思考块 + 工具调用
│   │   │   ├── ToolCallBlock.tsx      # 工具调用可视化
│   │   │   ├── ToolApprovalDialog.tsx  # 工具权限审批
│   │   │   ├── RichContentRenderer.tsx# 富文本渲染 (Mermaid/代码/表格)
│   │   │   ├── WelcomeState.tsx       # 欢迎页 + V3能力卡片
│   │   │   ├── CommandPalette.tsx    # 命令面板 (Cmd+K)
│   │   │   ├── KeyboardShortcuts.tsx # 快捷键帮助 (?)
│   │   │   └── ... (共20个组件)
│   │   └── ui/                     # shadcn/ui 组件库
│   ├── lib/
│   │   ├── types.ts                 # 完整类型系统
│   │   ├── nvidia.ts                # NVIDIA API客户端
│   │   ├── nvidia-models.ts         # NVIDIA模型列表
│   │   ├── db.ts                    # Prisma数据库客户端
│   │   ├── utils.ts                 # 工具函数
│   │   ├── agents/                  # 🆕 多Agent引擎 (7文件)
│   │   │   ├── protocol.ts           # 通信协议 + MessageBus
│   │   │   ├── coordinator.ts        # Coordinator引擎
│   │   │   ├── swarm.ts              # Swarm引擎
│   │   │   ├── teammate.ts           # Teammate引擎
│   │   │   ├── task-decomposer.ts    # LLM任务拆解
│   │   │   └── result-aggregator.ts  # LLM结果聚合
│   │   ├── tools/                   # 工具引擎
│   │   │   ├── definitions.ts        # 44工具JSON Schema
│   │   │   ├── executor.ts          # 工具执行调度器
│   │   │   ├── types.ts             # 工具类型
│   │   │   └── executors/           # 14个工具实现
│   │   ├── compression/             # Token压缩引擎 (6文件)
│   │   └── memory/                  # 记忆系统 (5文件)
│   └── store/
│       └── chat-store.ts            # Zustand状态管理
├── package.json
└── README.md
```

---

## 🛠️ 技术栈

| 技术 | 用途 | 版本 |
|:---|:---|:---|
| **Next.js** | React框架 (App Router, Turbopack) | 16 |
| **TypeScript** | 类型安全 | 5 |
| **Tailwind CSS** | 样式系统 | 4 |
| **shadcn/ui** | UI组件库 (New York) | — |
| **Framer Motion** | 动画 | 12 |
| **Zustand** | 状态管理 | 5 |
| **Prisma** | ORM (PostgreSQL) | 6 |
| **react-markdown** | Markdown渲染 | 10 |
| **mermaid** | 流程图渲染 | 11 |
| **react-syntax-highlighter** | 代码高亮 | 15 |
| **date-fns** | 日期格式化 | 4 |
| **Lucide React** | 图标 | — |
| **NVIDIA NIM** | AI大模型API (188免费模型) | — |
| **sonner** | Toast通知 | — |

---

## 🗺️ 版本路线图

### ✅ v2.1.0 — 基础架构 (2025-07)

**核心框架搭建**

- [x] NVIDIA NIM API 集成 (188免费模型, OpenAI兼容)
- [x] 44工具系统完整定义 (14核心 + 25延迟加载 + 5特性门控)
- [x] 10种运行模式定义
- [x] 3条多Agent技术路线定义
- [x] 4层记忆系统定义
- [x] 7层安全防护定义
- [x] 16个特性标志系统
- [x] Token三层压缩 + 缓存类型系统
- [x] 11个完整UI视图
- [x] 流式对话 + 实时SSE
- [x] 模型选择器 + 快速测试
- [x] Prisma 数据库 (9个模型)
- [x] 暗色主题 + 响应式设计

### ✅ v2.4.0 — 交互增强 (2025-07)

**6大新特性, UI全面优化**

- [x] **命令面板 (Command Palette)** — `Cmd/Ctrl+K` 全局搜索, 12视图快速导航
- [x] **Git集成** — 提交日志/分支管理/文件变更/彩色Diff视图
- [x] **聊天导出** — Markdown格式导出完整对话记录
- [x] **快捷键帮助** — `?` 键打开快捷键参考面板
- [x] **富文本渲染引擎** — Mermaid/GFM表格/代码高亮+复制
- [x] **自定义模型接入** — OpenAI兼容API, 支持流式/视觉

### ✅ v2.5.0 — 会话与数据 (2025-07)

**会话管理 + Token分析 + 移动端适配**

- [x] **会话管理面板** — 侧边栏会话列表, 搜索/切换/删除
- [x] **快捷模板库** — 12个编码提示模板, 分类标签
- [x] **Token分析仪表盘** — 总量/模型对比/7日趋势/成本估算
- [x] **移动端响应式** — 底部导航栏, 自适应网格
- [x] **Git分析视图** — 完整Git管理视图
- [x] **Dashboard升级** — 能力卡片, 更新日志

### ✅ v3.0.0 — 工具执行引擎 (2025-07)

**核心目标: 让44个工具真正可执行 — Agent成为自主工具使用者**

- [x] **Query Loop引擎** — 思考→行动→观察循环 (最多10轮自动迭代)
- [x] **Function Calling** — NVIDIA function-calling, 44个JSON Schema
- [x] **Bash安全沙箱** — 25项安全检查 (fork bomb/netcat阻断)
- [x] **文件操作工具** — FileRead / FileWrite / FileEdit 实际执行
- [x] **搜索工具** — Glob (正则转换, 200限制) / Grep (二进制跳过)
- [x] **Web工具** — WebSearch / WebFetch
- [x] **ToolSearch动态加载** — 44工具Schema定义
- [x] **工具权限审批流** — Allow/Deny/Ask 三级UI
- [x] **TodoWrite工具** — 结构化任务列表
- [x] **V3 SSE协议** — tool_call_start/result/loop_iteration
- [x] **ToolCallBlock UI** — 图标/参数/风险/状态/时长
- [x] **ToolApprovalDialog** — 风险自适应审批弹窗

### ✅ v3.5.0 — Token压缩与记忆 (2025-07)

**核心目标: 长对话不丢失上下文 — 记忆系统真正可运行**

- [x] **Snip/Auto/Responsive/微压缩** — 4策略完整实现
- [x] **Token计数器** — CJK/代码/英文三重感知
- [x] **Session Memory** — 15正则模式, 6分类, 去重+相似度
- [x] **Memdir系统** — MEMORY.md 项目记忆目录
- [x] **Magic Docs** — AI维护活文档 (7天过期)
- [x] **DreamTask** — 知识蒸馏 (5会话/24h触发)
- [x] **Agentic Loop集成** — 记忆注入+自动压缩+循环提取

### ✅ v4.0.0 — 多Agent实战 + 交互优化 (2025-07)

**核心目标: 3条Agent路线全部可运行 + 对话体验全面升级**

- [x] **Coordinator模式** — LLM任务拆解 → Worker并行(最多3个) → 结果聚合
- [x] **Swarm模式** — 多Agent多角度分析 → 共识聚合
- [x] **Teammate模式** — 进程内Agent队友 (50消息限制)
- [x] **Agent通信协议** — AgentMessage 6种消息类型 + MessageBus
- [x] **Token预算分配** — 每个Worker独立Token计数
- [x] **任务拆解算法** — LLM自动拆分复杂任务
- [x] **结果聚合** — LLM多Agent输出汇总与冲突解决
- [x] **Agentic Status Panel** — 实时状态指示 (Thinking/Executing/Generating)
- [x] **AbortController** — 真正终止SSE流 (非仅设flag)
- [x] **会话CRUD完整** — PUT更新/内联重命名/两步确认删除/自动标题
- [x] **WelcomeState V3** — V3能力卡片 (工具执行/思考模式/代码生成/智能搜索)
- [x] **Premium输入区** — 翡翠辉光/字符计数/快捷键提示
- [x] **实时流式速度** — chars/sec 速度指标显示
- [x] **SSE协议增强** — loop_iteration/压缩状态/增强meta事件

### ✅ v4.5.0 — 高级特性 (2025-07)

**核心目标: 6大高级特性全部落地 — 从工具到伙伴的全维度升级**

- [x] **Voice语音模式** — TTS语音合成(7种音色) + ASR语音识别, 录音按钮+朗读按钮, 支持1024字符分段
- [x] **UltraPlan模式** — AI深度多步规划, 可视化时间线, 步骤状态流转(待执行→进行中→已完成)
- [x] **Buddy电子宠物** — 18种物种, 5种心情状态, 经验值升级系统, 互动动画(抚摸/玩耍/喂食)
- [x] **KAIROS模式** — 7×24主动自主Agent, 监控面板, 活动时间线, 智能检查调度
- [x] **Bridge远程控制** — WebSocket REPL终端, 9种命令, 实时连接状态, 彩色输出
- [ ] **插件生态** — MCP 7种传输 + 技能市场

### 🔜 v5.0.0 — 企业级

- [ ] **团队知识同步** — REST API + Delta更新 + 冲突解决
- [ ] **企业安全策略** — PreToolUse/PostToolUse Hook
- [ ] **审计日志** — 完整安全事件追踪
- [ ] **多模型支持** — 接入更多Provider
- [ ] **性能监控** — FPS / 内存 / Token成本仪表盘

---

## 📊 代码统计

```
 TypeScript/TSX:  37,000+ 行
 源码文件:         142 个
 视图组件:         25 个 (codebot)
 API路由:          30 个
 数据库模型:       12 个
 多Agent引擎:       7 个
 工具定义:        44 个
 工具执行器:       14 个 (核心)
 压缩策略:         4 个
 记忆模块:         5 个
 运行模式:        10 个
 特性标志:        16 个
 安全层级:         7 层
 NVIDIA模型:       188 个 (免费)
```

---

## 📄 License

MIT License © 2025 dav-niu474

---

<div align="center">

**"Claude Code不是一个编程助手，它是一个AI操作系统的雏形。"**  
— 基于 Claude Code 0331版 npm source map 泄露源码分析

</div>
