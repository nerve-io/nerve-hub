---
name: nerve-hub
description: >
  Nerve Hub 任务协作工具。当用户提到任务分包、任务认领、任务状态更新、
  上传任务成果、查看项目任务时，使用此 skill。
  触发词：任务分包、认领任务、更新任务状态、提交成果、查看任务、nerve hub。
allowed-tools: Read Write RunCommand Grep Glob
---

# Nerve Hub — 任务协作

通过 CLI 脚本与 Nerve Hub 交互，管理项目和任务。

## 前置条件

使用前先确认 Hub 服务是否运行：

```!bash
curl -sf http://localhost:3141/health | head -1
```

如果未运行，启动它：

```!bash
cd $NERVE_HUB_DIR && npx tsx src/cli/index.ts start &
sleep 2
curl -sf http://localhost:3141/health
```

> `$NERVE_HUB_DIR` 是 Nerve Hub 项目的根目录路径，由用户配置。

## 操作命令

### 查看项目列表

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh list-projects
```

### 创建项目

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh create-project "项目名称" "项目描述"
```

### 查看项目任务

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh list-tasks <projectId>
```

### 创建任务（分包）

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh create-task <projectId> "任务标题" \
  --description "详细描述" \
  --type code \
  --priority high \
  --assignee "claude" \
  --tags "前端,API"
```

参数说明：
- `--type`: `code`(写代码) `review`(审查) `test`(测试) `deploy`(部署) `research`(调研) `custom`(其他)，默认 `custom`
- `--priority`: `critical`(紧急) `high`(高) `medium`(中) `low`(低)，默认 `medium`
- `--assignee`: 负责人名称，默认空
- `--tags`: 逗号分隔的标签
- `--dependencies`: 逗号分隔的依赖任务 ID

### 认领任务（将状态改为 running）

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh claim-task <taskId> "你的名字"
```

### 更新任务状态

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh update-task <taskId> \
  --status done \
  --progress 100
```

状态选项：`pending` `running` `blocked` `waiting` `done` `failed` `archived`

### 提交任务成果

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh submit-result <taskId> \
  --type git \
  --path "https://github.com/org/repo" \
  --summary "实现了用户登录模块"
```

### 记录任务失败

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh fail-task <taskId> "错误原因描述"
```

### 查看任务详情

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh get-task <taskId>
```

### 查看任务变更历史

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh task-logs <taskId>
```

### 查看项目事件日志

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh events <projectId>
```

### 获取任务上下文（用于注入到新会话）

```!bash
bash ${CLAUDE_SKILL_DIR}/scripts/nerve.sh task-context <taskId>
```

此命令会输出该任务的完整上下文（描述 + 依赖任务结果 + 项目信息），可直接粘贴到新会话中。

## 典型工作流

### 作为任务分发者（Claude Code）

1. 创建项目
2. 将大任务拆分为多个子任务，设置依赖关系
3. 指定 assignee 或留空等待认领

### 作为任务执行者（任何 AI Agent）

1. 查看分配给自己或待认领的任务
2. 认领任务（状态 → running）
3. 读取任务上下文（描述 + 依赖产出）
4. 执行任务
5. 提交成果（git 地址等 URL）
6. 标记完成（状态 → done）

## 辅助文件

- [reference.md](reference.md) — REST API 完整速查表
- [scripts/nerve.sh](scripts/nerve.sh) — CLI 封装脚本
