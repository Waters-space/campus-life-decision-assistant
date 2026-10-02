# 校园生活决策助手

一个把校园信息查询进一步变成“可执行决策”的 AI 应用示例。项目包含响应式用户端、内容管理端、演示 API、离线 Mock 决策逻辑，以及与外部智能体 / 元景 MaaS 工作流对接的配置入口。

> 本仓库公开的是通用前端与工程思路。真实知识库、平台账号、API Key、工作流 UUID、管理员数据和原校园素材不在仓库中。

## 能力范围

- 餐饮查询：食堂、菜品、参考价格、营业时间和用餐建议。
- 快递查询：快递点、地址、取件信息和营业时间。
- 空闲教室：教学楼、教室目录、自习时段和开放说明。
- 二手教材：教材版本、参考价格、卖家与交易说明。
- 当前时间：为“现在是否营业、先做什么”等判断提供时间基准。
- 路线规划：地点名称匹配、步行距离、预计用时和逐段路线。
- 多事项联动：按时间约束和资料有效性整合多个 Skill 的结果。

## 技术栈

- React 19、TypeScript、Vite
- Framer Motion、GSAP、Lucide React
- Express 5、Zod
- Vitest
- 可选：元景 MaaS / 万物平台智能体与 Skill

## 快速开始

要求 Node.js 22+ 与 pnpm 9+。

```bash
pnpm install
cp .env.example .env
pnpm dev
```

浏览器访问：

- 用户端：`http://localhost:5174`
- 管理端：`http://localhost:5174/admin`
- API 健康检查：`http://localhost:8788/api/health`

首次进入管理端前，请在 `.env` 中设置一个足够长且随机的 `ADMIN_INTERNAL_CODE`。管理端创建的凭据会写入被 Git 忽略的 `server/data/admin-auth.json`。

## 智能体入口配置

用户端的按钮只需要公开的聊天页面地址：

```dotenv
VITE_PRIMARY_AGENT_URL=https://your-agent.example.com/chat
VITE_USED_BOOK_AGENT_URL=https://your-used-book-agent.example.com/chat
```

这两个变量会进入浏览器构建产物，不能存放任何密钥。未配置时，界面会显示“尚未配置智能体入口”，不会跳转到示例或旧地址。

## 可选 MaaS API 配置

如果需要让本地 Express API 直接调用 MaaS 工作流，在服务器环境中配置：

```dotenv
MAAS_ENABLED=true
MAAS_WORKFLOW_URL=https://your-maas-endpoint.example.com/workflow/run
MAAS_APP_ID=replace-me
MAAS_API_KEY=replace-me
```

`MAAS_API_KEY` 只能存在于服务端环境变量中。默认 `MAAS_ENABLED=false`，项目使用可离线运行的演示数据。

## 常用命令

```bash
pnpm dev       # 同时启动前端和 API
pnpm dev:web   # 只启动前端
pnpm dev:api   # 只启动 API
pnpm check     # TypeScript 检查
pnpm test      # 单元测试
pnpm build     # 生产构建
```

## 目录结构

```text
.
├─ public/              # PWA 文件、字体和可替换的占位素材
├─ server/              # Express API、Mock 决策、管理端鉴权
│  └─ data/             # 仅保留示例；运行数据被 Git 忽略
├─ src/                 # 用户端、管理端、样式和 UI 组件
├─ workflow/            # 初版 MaaS 工作流规范、提示词和测试用例
├─ docs/                # 设计理念、架构、Skill、知识库和部署文档
└─ .env.example         # 安全配置模板
```

## 文档导航

- [设计理念](docs/design-philosophy.md)
- [整体架构](docs/architecture.md)
- [前端设计](docs/frontend-design.md)
- [智能体与 Skill](docs/agent-and-skills.md)
- [时间与路线工作流](docs/workflows.md)
- [知识库构建](docs/knowledge-base.md)
- [部署指南](docs/deployment.md)
- [开源边界与发布检查](docs/open-source-boundaries.md)

## 数据真实性边界

本仓库中的菜单、教室、二手商品和路线结果属于演示数据，不代表实时状态。部署到真实校园前，应接入经过核验的资料，并在答案中标明来源、更新时间和未知项。对于库存、空位、临时营业调整等动态信息，应提示用户以现场或官方通知为准。

## 许可证

代码采用 [MIT License](LICENSE)。仓库中的占位 SVG 可随代码使用；部署者自行上传的校徽、照片、字体、知识库资料和第三方服务仍受各自许可约束，详见 [ASSETS.md](ASSETS.md)。
