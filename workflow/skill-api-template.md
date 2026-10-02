# Skill API 文件模板

以下内容用于生成 Skill 时作为配置参考。不要把真实 API Key 或 UUID 提交到仓库。

## authentication.md

```markdown
# Authentication

This document describes the authentication method supported by this API.

## BearerAuth

**Type:** http

通过 `Authorization: Bearer [API Key]` 进行鉴权。

- **Scheme:** bearer
- **Bearer Format:** API Key

缺少变量时停止调用，不要在日志或回答中输出 API Key。
```

## workflowrun.md

```markdown
# POST /service/api/openapi/v1/workflow/run

**Resource:** 工作流

**Operation ID:** `workflowRun`

执行指定工作流并返回运行结果。通过 `parameters` 传入工作流需要的参数。

## Request Body

**Required:** Yes

**Content Type:** `application/json`

**Schema:** inline

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `uuid` | string | Yes | 工作流唯一 ID，此处应填写 UUID |
| `parameters` | object | Yes | 工作流执行所需参数对象 |

## Responses

| Status | Description |
| --- | --- |
| `200` | 成功响应，返回工作流输出 |
| `400` | 请求参数错误 |
| `401` | 鉴权失败 |
| `500` | 工作流或上游服务异常 |

**Success Response Schema:** inline

返回 JSON 对象，字段取决于已发布工作流的结束节点。

## Security

`BearerAuth`
```
