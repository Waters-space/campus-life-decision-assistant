# 部署指南

## 1. 本地开发

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env
pnpm dev
```

默认前端端口为 5174，API 端口为 8788。

## 2. 构建

```bash
pnpm check
pnpm test
pnpm build
```

Vite 产物位于 `dist/`。如果只使用外部 WebChat，静态前端可以部署到任意静态站点；若需要管理端和本地 API，则还要运行 `server/index.ts` 或把相同接口迁移到正式后端。

## 3. Linux 服务

生产环境建议把前端、API、时间服务和智能体平台分开托管：

```text
Nginx / HTTPS
├─ /              → Vite 静态文件
├─ /api           → Express API
└─ 智能体入口 URL → 外部 WebChat

内部网络
├─ 时间服务       → 仅供工作流访问
└─ 工作流平台     → 知识库、Skill 与地图 API
```

Express API 与时间服务应使用 systemd、Docker Compose 或其他进程管理器开机自启。正常部署后，使用者不需要等待管理员登录服务器。

## 4. 环境变量

| 变量 | 所在位置 | 说明 |
| --- | --- | --- |
| `VITE_PRIMARY_AGENT_URL` | 前端 | 主智能体公开聊天地址 |
| `VITE_USED_BOOK_AGENT_URL` | 前端 | 二手教材智能体公开地址 |
| `ADMIN_INTERNAL_CODE` | 服务端 | 首次创建管理员的内部码 |
| `MAAS_ENABLED` | 服务端 | 是否启用 MaaS API |
| `MAAS_WORKFLOW_URL` | 服务端 | 工作流 API 地址 |
| `MAAS_APP_ID` | 服务端 | 应用 ID |
| `MAAS_API_KEY` | 服务端 | Bearer Token，绝不进入前端 |

## 5. 上线检查

- 域名已启用 HTTPS，反向代理大小和超时配置符合图片上传需求。
- `.env` 未进入 Git 历史，平台 Key 已限制权限并可随时轮换。
- `/api/health` 正常，管理端注册和登录可用。
- 时间服务重启服务器后能自动恢复。
- 六个 Skill 分别通过单项测试，多 Skill 问题通过联动测试。
- 路线工作流遇到相似 POI 时会拒绝错误替代。
- 知识库资料有来源、更新时间和现场核验提示。
