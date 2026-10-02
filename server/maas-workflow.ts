type MaaSWorkflowPayload = {
  answer?: unknown
  message?: unknown
  code?: unknown
  msg?: unknown
}

const defaultWorkflowUrl = 'https://maas-api.ai-yuanjing.com/openapi/console/api/yuanjing_workflow/run'

function configuration() {
  return {
    enabled: process.env.MAAS_ENABLED === 'true',
    endpoint: process.env.MAAS_WORKFLOW_URL?.trim() || defaultWorkflowUrl,
    appId: process.env.MAAS_APP_ID?.trim() || '',
    apiKey: process.env.MAAS_API_KEY?.trim() || '',
  }
}

export function isMaaSEnabled() {
  return configuration().enabled
}

export async function runMaaSWorkflow(question: string): Promise<string> {
  const { enabled, endpoint, appId, apiKey } = configuration()
  if (!enabled) throw new Error('MaaS 工作流尚未启用。')
  if (!appId || !apiKey) throw new Error('MaaS 工作流缺少服务器端配置，请联系管理员。')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'X-App-ID': appId,
      },
      body: JSON.stringify({ question }),
      signal: controller.signal,
    })
    const payload = await response.json().catch(() => ({})) as MaaSWorkflowPayload
    if (!response.ok) {
      if (response.status === 429 && payload.code === 5006) throw new Error('当前工作流所用模型不支持 API 在线试用；请在元景平台申请该模型的 API 调用权限，或更换为支持 API 调用的模型。')
      if (response.status === 429) throw new Error('MaaS 当前请求过于频繁或额度受限，请稍后再试。')
      if (response.status === 401 || response.status === 403) throw new Error('MaaS 鉴权未通过，请检查服务器端 API Key 和 App ID。')
      throw new Error(`MaaS 工作流暂时无法响应（HTTP ${response.status}）。`)
    }
    const answer = typeof payload.answer === 'string' ? payload.answer.trim() : ''
    if (!answer) throw new Error(typeof payload.message === 'string' ? payload.message : 'MaaS 工作流未返回答案。')
    return answer
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('MaaS 工作流响应超时，请稍后重试。')
    throw error
  } finally {
    clearTimeout(timeout)
  }
}
