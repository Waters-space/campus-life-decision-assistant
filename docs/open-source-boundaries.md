# 开源边界与发布检查

## 仓库包含

- React 用户端与管理端源码。
- Express 演示 API、Mock 决策引擎和测试。
- 通用系统提示词、工作流规范和测试用例。
- 架构、设计、知识库和部署说明。
- 可自由替换的占位图片。

## 仓库不包含

- 真实 `.env`、API Key、Bearer Token 和工作流 UUID。
- 管理员账号哈希、会话、反馈和运行期内容文件。
- 私有知识库原文件、学生个人信息和二手交易联系方式。
- 授权状态不明确的校徽、校园实拍图和比赛材料。
- `node_modules`、构建产物、录屏、PPT、PDF 和调试缓存。

## 发布前命令

```bash
pnpm check
pnpm test
pnpm build
git status --short
```

建议再搜索一次敏感内容：

```bash
rg -n --hidden -g '!node_modules/**' -g '!dist/**' \
  -e 'sk-[A-Za-z0-9_-]+' -e 'Bearer [A-Za-z0-9._-]+' \
  -e 'API_KEY=.+' -e 'passwordHash' -e 'admin-auth.json'
```

示例配置中的占位词可以被匹配到，但不应出现真实值。若密钥曾进入公开提交，必须在服务商控制台轮换；从最新提交删除并不足以消除泄露。

## GitHub 建议

- 仓库名称：`campus-life-decision-assistant`
- 简介：`面向校园餐饮、快递、自习、二手、时间和路线的可解释 AI 决策助手。`
- Topics：`react`、`typescript`、`ai-agent`、`rag`、`workflow`、`campus`
- 首个 Release：`v1.0.0-open-source`
