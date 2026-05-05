# frida-mcp

极简的 Frida MCP 服务器。

## 设计理念

- **Attach → LoadScript → Call/Listen → Unload** 的最短工作流
- **Frida语料被大多数模型广泛训练过** 可直接使用
- **工具数量最少化** 只暴露 6 个工具，少就是好，上下文精简

## 工具一览

| 工具 | 用途 |
|------|------|
| `attach` | Attach Frida 到进程（PID 或进程名）。进程 detach/crash 后必须重新调用 |
| `detach` | 主动断开当前进程并卸载所有持久脚本，适合换目标前调用 |
| `load_script` | 加载一段持久 Frida JS。可定义 `rpc.exports = {...}`，可用 `send(data)` 产出日志 |
| `call_rpc` | 调用 `load_script` 注册的 RPC 方法，同步返回结果 |
| `get_script_output` | 拉取并清空脚本的 `send(...)` 消息队列，类似 tail log |
| `unload_script` | 卸载并清理持久脚本 |

## 安装

**从源码：**

```bash
npm install
npm run build
```

**或从 Release 下载：** 在 [GitHub Releases](../../releases) 中选择与平台对应的压缩包（`win-x64` / `linux-x64` / `macos-arm64`），解压后即可使用，无需 `npm install`：

```bash
# 解压后会得到 frida-mcp/ 目录
node frida-mcp/dist/index.js
```

## 使用

### 直接启动（可选预附加 PID）

```bash
# 不带参数启动，由 LLM 通过 attach 工具连接
node dist/index.js

# 或启动时直接 attach 到 PID
node dist/index.js 12345
```

### MCP 客户端配置

```json
{
  "mcpServers": {
    "frida": {
      "command": "node",
      "args": ["e:/mcp-ida-frida/dist/index.js"]
    }
  }
}
```

## Thanks

- [Claude](https://claude.ai/) - AI 编程助手
- [Frida](https://frida.re/) - 动态插桩框架
- [MCP](https://modelcontextprotocol.io/) - 模型上下文协议