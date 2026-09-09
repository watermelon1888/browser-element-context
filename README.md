# 浏览器元素上下文

`browser-element` 是一个需要用户显式调用的 Codex Skill。它读取通过 VS Code Integrated Browser 的 **Add Element to Chat** 加入共享 Chat 输入框的渲染后 HTML 元素，并将这些元素作为当前任务的上下文。

## 使用方式

先在 VS Code Integrated Browser 中选中元素并执行 **Add Element to Chat**，保持元素附件仍在共享 Chat 输入框中，然后在 Codex 对话中输入：

```text
$browser-element 把刚才选择的按钮改成橙色
```

也可以只读取和分析元素：

```text
$browser-element 分析刚才选择的元素为什么出现布局错位
```

Skill 只在用户明确输入 `$browser-element` 时调用，不会被模型自动触发。

## 安装

将本项目的 `skills/browser-element` 目录复制到当前用户的 Codex Skills 目录：

```text
~/.codex/skills/browser-element
```

安装后的目录结构应为：

```text
~/.codex/skills/browser-element/
├── SKILL.md
├── agents/
│   └── openai.yaml
└── scripts/
    └── read-elements.mjs
```

重新加载 VS Code 窗口或新建 Codex 对话后即可通过 `$browser-element` 调用。

## 工作原理

调用 Skill 后，Codex 会运行随附的只读 Node.js 脚本。脚本会：

1. 根据当前工作区路径定位对应的 VS Code `workspaceStorage`。
2. 读取该工作区最新的共享 Chat JSONL 会话。
3. 按顺序回放初始快照和 `inputState.attachments` 更新。
4. 筛选当前输入框中的 `element` 附件。
5. 输出 VS Code 已生成的 URL、HTML Path、outerHTML、尺寸和 CSS 文本。

元素截图的 Base64 数据不会输出，脚本也不会修改 VS Code Chat 存储。

## 支持范围

- Windows、macOS 和 Linux
- VS Code Stable 和 VS Code Insiders
- 不依赖用户名或固定工作区路径
- 本地文件夹工作区，以及工作区子目录中的 Codex 会话

脚本默认检查各系统的标准 VS Code 数据目录。使用自定义 `--user-data-dir` 启动 VS Code 时，可以显式传入对应的 `workspaceStorage`：

```text
node scripts/read-elements.mjs \
  --workspace <workspace-path> \
  --workspace-storage <path-to-workspaceStorage>
```

## 依赖

- Codex
- 支持 **Add Element to Chat** 的 VS Code Integrated Browser
- Node.js 18 或更高版本

脚本只使用 Node.js 标准库，不需要安装 npm 依赖。

## 与 Claude 共用

当前仓库只提供 Codex Skill。`scripts/read-elements.mjs` 本身不依赖 Codex API，其标准输出是普通 Markdown，因此以后可以直接被 Claude Skill、斜杠命令或其他编辑器代理调用，无需修改元素读取逻辑。

## 限制

- 必须先通过 **Add Element to Chat** 将元素加入 VS Code 共享 Chat 输入框。
- 必须在附件仍处于当前输入草稿时调用；脚本不会回退到旧会话冒充当前选择。
- VS Code 的 `chatSessions` 是内部数据格式；如果其结构发生变化，读取脚本可能需要同步更新。
- 渲染元素上下文不能证明对应源码位置，Codex 在修改前仍需检查项目源码。

## 项目结构

```text
.
├── README.md
├── LICENSE
└── skills/
    └── browser-element/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        └── scripts/
            └── read-elements.mjs
```

## License

MIT
