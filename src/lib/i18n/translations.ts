export type Locale = 'zh' | 'en';

export interface Translations {
  // Sidebar navigation
  nav: {
    dashboard: string;
    chat: string;
    modelHub: string;
    tools: string;
    skills: string;
    modes: string;
    memory: string;
    agents: string;
    security: string;
    aiCaps: string;
    analytics: string;
    git: string;
    kairos: string;
    bridge: string;
    settings: string;
  };
  // Sidebar
  sidebar: {
    newChat: string;
    recentSessions: string;
    noSessionsYet: string;
    activeMode: string;
    sessions: string;
    free: string;
  };
  // Chat
  chat: {
    sendPlaceholder: string;
    online: string;
    ready: string;
    messages: string;
    enterToSend: string;
    shiftEnterForNewline: string;
    thinking: string;
    noResponse: string;
    stop: string;
    chatExported: string;
    exportChat: string;
    sessionManager: string;
    templates: string;
    quickTemplates: string;
    searchSessions: string;
    noMatchingSessions: string;
    noSessions: string;
    createSession: string;
    newChatCreated: string;
    failedCreateSession: string;
    attachImage: string;
    exportDesc: string;
  };
  // Welcome
  welcome: {
    title: string;
    subtitle: string;
    toolExecution: string;
    toolExecutionDesc: string;
    thinkingMode: string;
    thinkingModeDesc: string;
    codeGeneration: string;
    codeGenerationDesc: string;
    smartSearch: string;
    smartSearchDesc: string;
    quickStart: string;
    readyToAssist: string;
    quickActions: string[];
  };
  // Modes
  modes: {
    interactive: string;
    kairos: string;
    plan: string;
    voice: string;
    coordinator: string;
    swarm: string;
    teammate: string;
    ultraplan: string;
    dream: string;
    worktree: string;
  };
  // Agentic phases
  agentic: {
    thinking: string;
    analyzing: string;
    executingTool: string;
    generatingResponse: string;
    compressingContext: string;
    iteration: string;
  };
  // Voice
  voice: {
    startRecording: string;
    stopRecording: string;
    recording: string;
    voiceMode: string;
    speakResponse: string;
    stopSpeaking: string;
    speak: string;
    voiceSettings: string;
    selectVoice: string;
    speed: string;
    transcriptionError: string;
    ttsError: string;
    voiceModeActive: string;
    listening: string;
    processing: string;
  };
  // Common
  common: {
    copy: string;
    copied: string;
    delete: string;
    confirm: string;
    cancel: string;
    save: string;
    close: string;
    loading: string;
    error: string;
    success: string;
    search: string;
    enable: string;
    disable: string;
    on: string;
    off: string;
    tokens: string;
    clearAll: string;
    clearAllSessions: string;
    clickToClear: string;
  };
  // Multi-agent
  multiAgent: {
    workers: string;
    agents: string;
    spawning: string;
    spawningAgents: string;
    executing: string;
    aggregating: string;
    aggregatingResults: string;
    dismiss: string;
  };
  // KAIROS Mode
  kairos: {
    title: string;
    subtitle: string;
    status: string;
    active: string;
    inactive: string;
    activating: string;
    toggleOn: string;
    toggleOff: string;
    monitoredSources: string;
    activityTimeline: string;
    configuration: string;
    stats: string;
    totalChecks: string;
    actionsTaken: string;
    issuesFound: string;
    uptime: string;
    nextCheck: string;
    checkInterval: string;
    addSource: string;
    removeSource: string;
    noActivity: string;
    noSources: string;
    notConfigured: string;
    notConfiguredDesc: string;
    activateKairos: string;
    sourceGit: string;
    sourceFiles: string;
    sourceScheduled: string;
    sourceGitDesc: string;
    sourceFilesDesc: string;
    sourceScheduledDesc: string;
    autoDetected: string;
    autoAnalyzed: string;
    healthCheck: string;
    cronCompleted: string;
    securityScan: string;
    dependencyUpdate: string;
    minutes: string;
    hours: string;
    days: string;
    enabled: string;
    disabled: string;
  };
  // UltraPlan
  plan: {
    title: string;
    subtitle: string;
    describeTask: string;
    generatePlan: string;
    generating: string;
    clearPlan: string;
    executePlan: string;
    exportPlan: string;
    steps: string;
    stepOf: string;
    completed: string;
    inProgress: string;
    pending: string;
    noPlan: string;
    planGenerated: string;
    planError: string;
    complexity: string;
    goal: string;
    stepTitle: string;
    stepDescription: string;
    markComplete: string;
    estimatedTime: string;
    collapse: string;
    expand: string;
    low: string;
    medium: string;
    high: string;
  };
  // Buddy
  buddy: {
    title: string;
    subtitle: string;
    species: string;
    selectSpecies: string;
    currentSpecies: string;
    mood: string;
    level: string;
    xp: string;
    interactions: string;
    pet: string;
    feed: string;
    play: string;
    rest: string;
    hide: string;
    show: string;
    levelUp: string;
    personality: string;
    daysActive: string;
    buddyEarnedXP: string;
    rename: string;
    stats: string;
    companion: string;
    buddyName: string;
    earnedXP: string;
    totalInteractions: string;
    happy: string;
    neutral: string;
    sleepy: string;
    excited: string;
    thinking: string;
  };
  // Bridge Remote
  bridge: {
    title: string;
    subtitle: string;
    connectionStatus: string;
    connected: string;
    disconnected: string;
    connecting: string;
    connect: string;
    disconnect: string;
    terminal: string;
    commandPlaceholder: string;
    send: string;
    clear: string;
    connectionInfo: string;
    url: string;
    uptime: string;
    messagesSent: string;
    messagesReceived: string;
    commands: string;
    commandsDesc: string;
    cmdPing: string;
    cmdPingDesc: string;
    cmdEcho: string;
    cmdEchoDesc: string;
    cmdStatus: string;
    cmdStatusDesc: string;
    cmdHelp: string;
    cmdHelpDesc: string;
    cmdListFiles: string;
    cmdListFilesDesc: string;
    cmdGetFile: string;
    cmdGetFileDesc: string;
    cmdEval: string;
    cmdEvalDesc: string;
    error: string;
    serviceNotRunning: string;
    reconnectFailed: string;
    welcome: string;
    welcomeDesc: string;
  };
}

const zh: Translations = {
  nav: {
    dashboard: '仪表盘',
    chat: '对话',
    modelHub: '模型中心',
    tools: '工具',
    skills: '技能',
    modes: '模式',
    memory: '记忆',
    agents: '智能体',
    security: '安全',
    aiCaps: 'AI 能力',
    analytics: '数据分析',
    git: 'Git 管理',
    kairos: 'KAIROS',
    bridge: 'Bridge',
    settings: '设置',
  },
  sidebar: {
    newChat: '新建对话',
    recentSessions: '最近会话',
    noSessionsYet: '暂无会话',
    activeMode: '当前模式',
    sessions: '会话管理',
    free: '免费',
  },
  chat: {
    sendPlaceholder: '输入消息... (Enter 发送)',
    online: '在线',
    ready: '就绪',
    messages: '消息',
    enterToSend: 'Enter 发送',
    shiftEnterForNewline: 'Shift + Enter 换行',
    thinking: '思考中',
    noResponse: '未收到回复',
    stop: '停止',
    chatExported: '对话已导出为 Markdown',
    exportChat: '导出对话',
    sessionManager: '会话管理',
    templates: '模板',
    quickTemplates: '快捷模板',
    searchSessions: '搜索会话...',
    noMatchingSessions: '没有匹配的会话',
    noSessions: '暂无会话',
    createSession: '创建会话',
    newChatCreated: '新对话已创建',
    failedCreateSession: '创建对话失败',
    attachImage: '附加图片',
    exportDesc: '导出当前对话为 Markdown 文件',
  },
  welcome: {
    title: '你好，有什么可以帮你？',
    subtitle: 'AI 编程助手，支持代码生成、工具调用、多智能体协作',
    toolExecution: '工具执行',
    toolExecutionDesc: 'AI 可以直接运行命令、读写文件、搜索代码',
    thinkingMode: '深度思考',
    thinkingModeDesc: '启用链式推理，解决复杂的编程问题',
    codeGeneration: '代码生成',
    codeGenerationDesc: '支持多种编程语言，生成高质量代码',
    smartSearch: '智能搜索',
    smartSearchDesc: '语义搜索代码库，快速定位相关代码',
    quickStart: '快速开始',
    readyToAssist: '准备好为你效劳，选择一个快捷操作或直接输入你的需求。',
    quickActions: [
      '帮我写一个REST API',
      '分析这个项目的代码结构',
      '搜索代码中的TODO注释',
      '帮我调试一个bug',
    ],
  },
  modes: {
    interactive: '交互模式',
    kairos: 'Kairos 模式',
    plan: '规划模式',
    voice: '语音模式',
    coordinator: '协调者模式',
    swarm: '蜂群模式',
    teammate: '队友模式',
    ultraplan: '超级规划',
    dream: '梦境模式',
    worktree: '工作树模式',
  },
  agentic: {
    thinking: '思考中',
    analyzing: '分析中',
    executingTool: '正在执行工具',
    generatingResponse: '正在生成回复',
    compressingContext: '正在压缩上下文',
    iteration: '迭代中',
  },
  common: {
    copy: '复制',
    copied: '已复制',
    delete: '删除',
    confirm: '确认',
    cancel: '取消',
    save: '保存',
    close: '关闭',
    loading: '加载中...',
    error: '错误',
    success: '成功',
    search: '搜索',
    enable: '启用',
    disable: '禁用',
    on: '开',
    off: '关',
    tokens: '令牌',
    clearAll: '全部清除',
    clearAllSessions: '清除所有会话',
    clickToClear: '点击清除',
  },
  voice: {
    startRecording: '开始录音',
    stopRecording: '停止录音',
    recording: '录音中...',
    voiceMode: '语音模式',
    speakResponse: '朗读回复',
    stopSpeaking: '停止朗读',
    speak: '朗读',
    voiceSettings: '语音设置',
    selectVoice: '选择语音',
    speed: '语速',
    transcriptionError: '语音识别失败',
    ttsError: '语音合成失败',
    voiceModeActive: '语音模式已激活',
    listening: '正在聆听...',
    processing: '处理中...',
  },
  multiAgent: {
    workers: '工作节点',
    agents: '智能体',
    spawning: '生成中',
    spawningAgents: '正在生成智能体...',
    executing: '执行中',
    aggregating: '聚合中',
    aggregatingResults: '正在聚合结果...',
    dismiss: '关闭',
  },
  plan: {
    title: '深度规划',
    subtitle: 'AI 驱动的多步骤任务规划',
    describeTask: '描述你要完成的任务...',
    generatePlan: '生成规划',
    generating: '正在生成规划...',
    clearPlan: '清除规划',
    executePlan: '执行规划',
    exportPlan: '导出规划',
    steps: '步骤',
    stepOf: '{current}/{total} 步',
    completed: '已完成',
    inProgress: '进行中',
    pending: '待执行',
    noPlan: '暂无规划，描述任务后点击生成',
    planGenerated: '规划已生成',
    planError: '规划生成失败',
    complexity: '复杂度',
    goal: '目标',
    stepTitle: '步骤标题',
    stepDescription: '步骤描述',
    markComplete: '标记完成',
    estimatedTime: '预估时间',
    collapse: '收起',
    expand: '展开',
    low: '低',
    medium: '中',
    high: '高',
  },
  buddy: {
    title: '伙伴宠物',
    subtitle: '你的编程伙伴',
    species: '物种',
    selectSpecies: '选择物种',
    currentSpecies: '当前物种',
    mood: '心情',
    level: '等级',
    xp: '经验值',
    interactions: '互动次数',
    pet: '抚摸',
    feed: '喂食',
    play: '玩耍',
    rest: '休息',
    hide: '隐藏',
    show: '显示',
    levelUp: '升级!',
    personality: '性格',
    daysActive: '活跃天数',
    buddyEarnedXP: '获得 {xp} 经验值!',
    rename: '重命名',
    stats: '统计',
    companion: '伙伴',
    buddyName: '伙伴名字',
    earnedXP: '获得经验值',
    totalInteractions: '总互动次数',
    happy: '开心',
    neutral: '平静',
    sleepy: '困倦',
    excited: '兴奋',
    thinking: '思考中',
  },
  kairos: {
    title: 'KAIROS 主动监控',
    subtitle: '7×24 主动自主代理 — 独立监控、分析和执行任务',
    status: '状态',
    active: '运行中',
    inactive: '未激活',
    activating: '启动中...',
    toggleOn: '启用 KAIROS',
    toggleOff: '关闭 KAIROS',
    monitoredSources: '监控源',
    activityTimeline: '活动时间线',
    configuration: '配置',
    stats: '统计',
    totalChecks: '总检查次数',
    actionsTaken: '执行操作',
    issuesFound: '发现问题',
    uptime: '运行时间',
    nextCheck: '下次检查',
    checkInterval: '检查间隔',
    addSource: '添加源',
    removeSource: '移除',
    noActivity: '暂无活动记录',
    noSources: '暂无监控源',
    notConfigured: 'KAIROS 尚未配置',
    notConfiguredDesc: '启用 KAIROS 以启动 7×24 主动自主监控代理',
    activateKairos: '激活 KAIROS',
    sourceGit: 'Git 仓库',
    sourceFiles: '文件系统',
    sourceScheduled: '定时任务',
    sourceGitDesc: '监控 Git 提交和分支变化',
    sourceFilesDesc: '监控关键文件修改',
    sourceScheduledDesc: '执行定时健康检查',
    autoDetected: '自动检测到',
    autoAnalyzed: '自动分析了',
    healthCheck: '定时健康检查已完成',
    cronCompleted: '定时任务执行完成',
    securityScan: '安全扫描已完成',
    dependencyUpdate: '依赖更新检查完成',
    minutes: '分钟',
    hours: '小时',
    days: '天',
    enabled: '已启用',
    disabled: '已禁用',
  },
  bridge: {
    title: 'Bridge 远程终端',
    subtitle: '通过 WebSocket REPL 远程控制 CodeBot',
    connectionStatus: '连接状态',
    connected: '已连接',
    disconnected: '未连接',
    connecting: '连接中...',
    connect: '连接',
    disconnect: '断开',
    terminal: '终端',
    commandPlaceholder: '输入命令... (Enter 发送)',
    send: '发送',
    clear: '清空',
    connectionInfo: '连接信息',
    url: '地址',
    uptime: '运行时间',
    messagesSent: '发送消息',
    messagesReceived: '接收消息',
    commands: '可用命令',
    commandsDesc: '支持以下 REPL 命令',
    cmdPing: 'ping',
    cmdPingDesc: '测试连接延迟',
    cmdEcho: 'echo <text>',
    cmdEchoDesc: '回显文本',
    cmdStatus: 'status',
    cmdStatusDesc: '查看服务状态',
    cmdHelp: 'help',
    cmdHelpDesc: '显示帮助信息',
    cmdListFiles: 'list-files',
    cmdListFilesDesc: '列出项目文件',
    cmdGetFile: 'get-file <path>',
    cmdGetFileDesc: '获取文件内容',
    cmdEval: 'eval <expr>',
    cmdEvalDesc: '执行表达式 (受限)',
    error: '错误',
    serviceNotRunning: 'Bridge 服务未运行，请先启动 mini-service',
    reconnectFailed: '重连失败',
    welcome: 'Bridge REPL',
    welcomeDesc: '输入 help 查看可用命令',
  },
};

const en: Translations = {
  nav: {
    dashboard: 'Dashboard',
    chat: 'Chat',
    modelHub: 'Model Hub',
    tools: 'Tools',
    skills: 'Skills',
    modes: 'Modes',
    memory: 'Memory',
    agents: 'Agents',
    security: 'Security',
    aiCaps: 'AI Capabilities',
    analytics: 'Analytics',
    git: 'Git',
    kairos: 'KAIROS',
    bridge: 'Bridge',
    settings: 'Settings',
  },
  sidebar: {
    newChat: 'New Chat',
    recentSessions: 'Recent Sessions',
    noSessionsYet: 'No sessions yet',
    activeMode: 'Active Mode',
    sessions: 'Sessions',
    free: 'Free',
  },
  chat: {
    sendPlaceholder: 'Type a message... (Enter to send)',
    online: 'Online',
    ready: 'Ready',
    messages: 'Messages',
    enterToSend: 'Enter to send',
    shiftEnterForNewline: 'Shift + Enter for newline',
    thinking: 'Thinking',
    noResponse: 'No response received',
    stop: 'Stop',
    chatExported: 'Chat exported as Markdown',
    exportChat: 'Export Chat',
    sessionManager: 'Session Manager',
    templates: 'Templates',
    quickTemplates: 'Quick Templates',
    searchSessions: 'Search sessions...',
    noMatchingSessions: 'No matching sessions',
    noSessions: 'No sessions',
    createSession: 'Create Session',
    newChatCreated: 'New chat created',
    failedCreateSession: 'Failed to create chat',
    attachImage: 'Attach Image',
    exportDesc: 'Export current chat as a Markdown file',
  },
  welcome: {
    title: 'Hello, how can I help you?',
    subtitle: 'AI coding assistant with code generation, tool execution, and multi-agent collaboration',
    toolExecution: 'Tool Execution',
    toolExecutionDesc: 'AI can run commands, read/write files, and search code directly',
    thinkingMode: 'Deep Thinking',
    thinkingModeDesc: 'Enable chain-of-thought reasoning for complex programming problems',
    codeGeneration: 'Code Generation',
    codeGenerationDesc: 'Support multiple languages with high-quality code output',
    smartSearch: 'Smart Search',
    smartSearchDesc: 'Semantic search across codebase to quickly locate relevant code',
    quickStart: 'Quick Start',
    readyToAssist: 'Ready to assist. Choose a quick action or type your request directly.',
    quickActions: [
      'Write a REST API for me',
      'Analyze the project code structure',
      'Search for TODO comments in code',
      'Help me debug an issue',
    ],
  },
  modes: {
    interactive: 'Interactive',
    kairos: 'Kairos',
    plan: 'Plan',
    voice: 'Voice',
    coordinator: 'Coordinator',
    swarm: 'Swarm',
    teammate: 'Teammate',
    ultraplan: 'Ultraplan',
    dream: 'Dream',
    worktree: 'Worktree',
  },
  agentic: {
    thinking: 'Thinking',
    analyzing: 'Analyzing',
    executingTool: 'Executing Tool',
    generatingResponse: 'Generating Response',
    compressingContext: 'Compressing Context',
    iteration: 'Iterating',
  },
  common: {
    copy: 'Copy',
    copied: 'Copied',
    delete: 'Delete',
    confirm: 'Confirm',
    cancel: 'Cancel',
    save: 'Save',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    search: 'Search',
    enable: 'Enable',
    disable: 'Disable',
    on: 'On',
    off: 'Off',
    tokens: 'Tokens',
    clearAll: 'Clear All',
    clearAllSessions: 'Clear All Sessions',
    clickToClear: 'Click to clear',
  },
  voice: {
    startRecording: 'Start Recording',
    stopRecording: 'Stop Recording',
    recording: 'Recording...',
    voiceMode: 'Voice Mode',
    speakResponse: 'Read Aloud',
    stopSpeaking: 'Stop Speaking',
    speak: 'Speak',
    voiceSettings: 'Voice Settings',
    selectVoice: 'Select Voice',
    speed: 'Speed',
    transcriptionError: 'Speech recognition failed',
    ttsError: 'Text-to-speech failed',
    voiceModeActive: 'Voice mode active',
    listening: 'Listening...',
    processing: 'Processing...',
  },
  multiAgent: {
    workers: 'Workers',
    agents: 'Agents',
    spawning: 'Spawning',
    spawningAgents: 'Spawning agents...',
    executing: 'Executing',
    aggregating: 'Aggregating',
    aggregatingResults: 'Aggregating results...',
    dismiss: 'Dismiss',
  },
  plan: {
    title: 'Ultraplan',
    subtitle: 'AI-driven deep multi-step planning, breaking down complex tasks',
    describeTask: 'Describe your task...',
    generatePlan: 'Generate Plan',
    generating: 'Generating plan...',
    clearPlan: 'Clear Plan',
    executePlan: 'Execute Plan',
    exportPlan: 'Export Plan',
    steps: 'Steps',
    stepOf: 'Step {current} of {total}',
    completed: 'Completed',
    inProgress: 'In Progress',
    pending: 'Pending',
    noPlan: 'No plan yet. Describe a task and click generate.',
    planGenerated: 'Plan generated',
    planError: 'Failed to generate plan',
    complexity: 'Complexity',
    goal: 'Goal',
    stepTitle: 'Step Title',
    stepDescription: 'Step Description',
    markComplete: 'Mark Complete',
    estimatedTime: 'Estimated Time',
    collapse: 'Collapse',
    expand: 'Expand',
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  },
  buddy: {
    title: 'Buddy Pet',
    subtitle: 'Your coding companion',
    species: 'Species',
    selectSpecies: 'Select Species',
    currentSpecies: 'Current Species',
    mood: 'Mood',
    level: 'Level',
    xp: 'XP',
    interactions: 'Interactions',
    pet: 'Pet',
    feed: 'Feed',
    play: 'Play',
    rest: 'Rest',
    hide: 'Hide',
    show: 'Show',
    levelUp: 'Level Up!',
    personality: 'Personality',
    daysActive: 'Days Active',
    buddyEarnedXP: 'Earned {xp} XP!',
    rename: 'Rename',
    stats: 'Stats',
    companion: 'Companion',
    buddyName: 'Buddy Name',
    earnedXP: 'Earned XP',
    totalInteractions: 'Total Interactions',
    happy: 'Happy',
    neutral: 'Neutral',
    sleepy: 'Sleepy',
    excited: 'Excited',
    thinking: 'Thinking',
  },
  kairos: {
    title: 'KAIROS Proactive Monitor',
    subtitle: '7×24 proactive autonomous agent — monitors, analyzes, and acts independently',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    activating: 'Activating...',
    toggleOn: 'Enable KAIROS',
    toggleOff: 'Disable KAIROS',
    monitoredSources: 'Monitored Sources',
    activityTimeline: 'Activity Timeline',
    configuration: 'Configuration',
    stats: 'Statistics',
    totalChecks: 'Total Checks',
    actionsTaken: 'Actions Taken',
    issuesFound: 'Issues Found',
    uptime: 'Uptime',
    nextCheck: 'Next Check',
    checkInterval: 'Check Interval',
    addSource: 'Add Source',
    removeSource: 'Remove',
    noActivity: 'No activity yet',
    noSources: 'No monitored sources',
    notConfigured: 'KAIROS Not Configured',
    notConfiguredDesc: 'Enable KAIROS to start the 7×24 proactive autonomous monitoring agent',
    activateKairos: 'Activate KAIROS',
    sourceGit: 'Git Repository',
    sourceFiles: 'File System',
    sourceScheduled: 'Scheduled Tasks',
    sourceGitDesc: 'Monitor git commits and branch changes',
    sourceFilesDesc: 'Monitor critical file modifications',
    sourceScheduledDesc: 'Execute periodic health checks',
    autoDetected: 'Auto-detected',
    autoAnalyzed: 'Auto-analyzed',
    healthCheck: 'Scheduled health check completed',
    cronCompleted: 'Scheduled task executed',
    securityScan: 'Security scan completed',
    dependencyUpdate: 'Dependency update check completed',
    minutes: 'min',
    hours: 'hr',
    days: 'days',
    enabled: 'Enabled',
    disabled: 'Disabled',
  },
  bridge: {
    title: 'Bridge Remote Terminal',
    subtitle: 'Control CodeBot remotely via WebSocket REPL',
    connectionStatus: 'Connection Status',
    connected: 'Connected',
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connect: 'Connect',
    disconnect: 'Disconnect',
    terminal: 'Terminal',
    commandPlaceholder: 'Type a command... (Enter to send)',
    send: 'Send',
    clear: 'Clear',
    connectionInfo: 'Connection Info',
    url: 'URL',
    uptime: 'Uptime',
    messagesSent: 'Messages Sent',
    messagesReceived: 'Messages Received',
    commands: 'Available Commands',
    commandsDesc: 'Supported REPL commands',
    cmdPing: 'ping',
    cmdPingDesc: 'Test connection latency',
    cmdEcho: 'echo <text>',
    cmdEchoDesc: 'Echo text back',
    cmdStatus: 'status',
    cmdStatusDesc: 'View service status',
    cmdHelp: 'help',
    cmdHelpDesc: 'Show help information',
    cmdListFiles: 'list-files',
    cmdListFilesDesc: 'List project files',
    cmdGetFile: 'get-file <path>',
    cmdGetFileDesc: 'Get file contents',
    cmdEval: 'eval <expr>',
    cmdEvalDesc: 'Evaluate expression (limited)',
    error: 'Error',
    serviceNotRunning: 'Bridge service is not running. Start the mini-service first.',
    reconnectFailed: 'Reconnection failed',
    welcome: 'Bridge REPL',
    welcomeDesc: 'Type help to see available commands',
  },
};

export const translations: Record<Locale, Translations> = { zh, en };
