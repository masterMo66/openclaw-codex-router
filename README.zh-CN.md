<h1 align="center">OpenClaw Codex Router</h1>

<p align="center">
  <strong>让你在 Telegram 里复用同一个 Codex 会话，而不是反复手搓 ACP 命令。</strong>
</p>

<p align="center">
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-1677ff?style=for-the-badge" alt="MIT License"></a>
  <a href="./openclaw.plugin.json"><img src="https://img.shields.io/badge/OpenClaw-Plugin-111827?style=for-the-badge" alt="OpenClaw Plugin"></a>
  <a href="./scripts/install.sh"><img src="https://img.shields.io/badge/install-一键安装-16a34a?style=for-the-badge" alt="One-command install"></a>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#你会得到什么">你会得到什么</a> ·
  <a href="#限制说明">限制说明</a>
</p>

---

## 它解决了什么问题

如果你已经在 Telegram 里用 OpenClaw，真正烦人的通常不是“能不能调起 Codex”，而是“怎么把它变成一个顺手的日常工具”。

典型痛点基本是下面这些：

| 痛点 | 实际情况 |
| --- | --- |
| Codex 明明已经能跑 | 但你还是得手动拼 ACP 命令才能真正开始干活 |
| Telegram 本来就是最自然的入口 | 但普通消息不能直接绑定到 ACP 子会话 |
| `/acp spawn`、`/focus`、session key 都是现成能力 | 真正使用时却变成了运行时记忆负担 |
| 你需要的是稳定命令体验 | 结果却要记一堆底层实现细节 |

这个插件做的事情很直接：

- `/codex`
- `/codex <任务>`
- `/codex_status`
- `/codex_reset`
- `/backclaw`
- `/backclaw <分钟>`

它不改 OpenClaw 核心，只在现有能力范围内，把 Telegram + Codex 的体验整理成一个可复用的命令层。

## 你会得到什么

- 一个 Telegram 对话对应一个持久 Codex 会话
- 多次 `/codex <任务>` 自动复用同一个会话上下文
- `/backclaw` 后按 TTL 延迟回收会话
- `/codex_status` 可以看会话状态和过期时间
- 安装轻，不需要改 OpenClaw 核心

## 快速开始

克隆仓库后执行：

```bash
./scripts/install.sh
```

安装脚本会自动做这几件事：

1. 检查 `openclaw`
2. 把当前目录作为 OpenClaw 插件安装
3. 启用插件
4. 在缺失时写入默认配置
5. 重启 OpenClaw gateway

然后你就可以在 Telegram 里用：

```text
/codex
/codex 列出当前 workspace 顶层文件
/codex_status
/backclaw
/backclaw 1
/backclaw 0
```

## 前置条件

- OpenClaw 已经安装并正常运行
- Telegram 已经接到 OpenClaw
- ACPX backend 已启用
- 你的 OpenClaw 环境已经能跑 Codex

## 工作方式

这个插件不是替代 OpenClaw，而是在它上面补一层更适合 Telegram 的命令交互。

- 每个 Telegram 对话会映射到一个稳定的 Codex session name
- `/codex` 会创建或复用这个会话
- `/codex <任务>` 会把任务发到这个持久会话里执行
- `/backclaw` 不一定立即关闭，而是进入保留期
- `/backclaw 0` 代表立刻关闭
- `/codex_status` 会显示当前状态和过期信息

## Session 复用规则

只要下面这些事没有发生，就会继续复用同一个会话：

- `/codex_reset`
- `/backclaw 0`
- `/backclaw <分钟>` 后 TTL 到期
- 底层 ACPX session 不可用

默认 TTL 是：

- `10` 分钟

你可以在下面这个配置里修改：

- `~/.openclaw/openclaw.json`

示例：

```json
{
  "plugins": {
    "entries": {
      "codex-router": {
        "enabled": true,
        "config": {
          "defaultCwd": "~/.openclaw/workspace",
          "idleTtlMinutes": 10
        }
      }
    }
  }
}
```

## 限制说明

这个项目是按当前 OpenClaw Telegram 的真实边界来设计的，不是做一个“听起来更强”的壳子。

它支持得很稳定的是：

- `/codex <任务>` + 持久 session 复用

它**不声称**支持的是：

- 输入 `/codex` 后，所有普通 Telegram 消息自动进入 Codex 子会话

原因也很明确：

- OpenClaw Telegram 当前没有 ACP thread binding
- OpenClaw 插件当前没有公开的“拦截所有普通 Telegram 消息并重路由”的接口

所以这个仓库做的是“今天能稳定跑”的最优方案，而不是靠文案夸大能力。

## 卸载

```bash
./scripts/uninstall.sh
```

## 仓库结构

- [plugin/index.js](./plugin/index.js)：实际运行的插件
- [openclaw.plugin.json](./openclaw.plugin.json)：插件清单
- [scripts/install.sh](./scripts/install.sh)：安装脚本
- [scripts/uninstall.sh](./scripts/uninstall.sh)：卸载脚本

`src/` 目录里是早期脚手架代码，正常使用这个插件时不必关心。

## License

[MIT](./LICENSE)
