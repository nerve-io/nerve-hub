# Scripts

## wake-claude.sh

唤醒 Claude Desktop 应用并将消息发送到输入框。

```bash
bash scripts/wake-claude.sh "消息内容"
```

### 前置条件

**cliclick**（可选，用于全自动粘贴 + 发送）：

```bash
brew install cliclick
```

安装后需授予辅助功能权限：
1. 打开 **系统设置 → 隐私与安全性 → 辅助功能**
2. 点击 `+` 添加 `/opt/homebrew/bin/cliclick`
3. 开启其旁边的开关

若 cliclick 不可用，脚本将降级为系统通知 + 激活窗口模式（半自动）。
