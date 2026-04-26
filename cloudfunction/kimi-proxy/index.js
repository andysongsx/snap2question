const https = require('https')

const API_KEY = process.env.KIMI_API_KEY || ''
const MODEL = process.env.KIMI_MODEL || 'moonshot-v1-32k-vision-preview'
const API_URL = 'api.moonshot.cn'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
}

function requestAPI(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const options = {
      hostname: API_URL,
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 110000
    }
    const req = https.request(options, (res) => {
      let d = ''
      res.setEncoding('utf8')
      res.on('data', (c) => { d += c })
      res.on('end', () => {
        try {
          const j = JSON.parse(d)
          if (j.error) { reject(new Error(j.error.message)); return }
          resolve(j)
        } catch (e) { reject(new Error(`解析失败: ${d.slice(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('请求Kimi API超时')) })
    req.end(data)
  })
}

function parseJSON(content) {
  try { return JSON.parse(content) } catch (e) {
    // 尝试去掉可能的 markdown 代码块包裹
    const cleaned = content.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    try { return JSON.parse(cleaned) } catch (e2) {}
  }
  return null
}

exports.main_handler = async (event) => {
  console.log('收到请求:', new Date().toISOString())
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }
  try {
    let body = event.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch (e) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'JSON格式错误' }) }
      }
    }
    const { image_base64, level, grade, count } = body || {}
    if (!image_base64) return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: '缺少 image_base64' }) }

    const targetLevel = level || '初中'
    const targetGrade = grade || '初三'
    const targetCount = parseInt(count) || 1

    console.log('图片长度:', image_base64.length, '学段:', targetLevel, '年级:', targetGrade, '数量:', targetCount)

    const res = await requestAPI({
      model: MODEL,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}` } },
          { type: 'text', text: `请识别图片中的题目，分析并生成类似题型。目标学段：${targetLevel}，目标年级：${targetGrade}，生成数量：${targetCount}道。

分析原始题目：
- original_question：写出原始题目的完整文字内容
- original_answer：原始题目的正确答案
- original_analysis：详细解析原始题目，包括解题思路、关键步骤、涉及的知识点
- original_error_analysis：如果原始题目本身有错误（条件矛盾、答案错误、逻辑漏洞等），详细指出错误在哪里、为什么错了、正确的做法应该是什么。如果没有错误，填""

生成新题目（questions数组，每项包含）：
- type：几何/图形题为"svg"，其他为"text"
- question：新题目的完整文字内容
- svg_code：仅svg类型需要，附完整SVG代码
- answer：新题目的正确答案
- analysis：详细解析，包含完整的思考过程、关键步骤、知识点说明

要求：
1. 新题目数据不同、题干不同，但核心考察点与原始题目一致
2. 解析要详细具体，不要只写结论
3. 只输出JSON，不要任何其他文字或markdown标记` }
        ]
      }]
    })

    const content = res.choices?.[0]?.message?.content || ''
    console.log('返回长度:', content.length, 'finish_reason:', res.choices?.[0]?.finish_reason)
    const parsed = parseJSON(content)

    // 兼容旧格式和新格式
    let result
    if (parsed && parsed.questions && Array.isArray(parsed.questions)) {
      result = parsed
    } else if (parsed) {
      result = {
        original_question: parsed.original_question || '',
        original_answer: parsed.original_answer || '',
        original_analysis: parsed.original_analysis || '',
        original_error_analysis: parsed.original_error_analysis || '',
        questions: [{
          type: parsed.type || 'text',
          question: parsed.question || '',
          svg_code: parsed.svg_code || '',
          answer: parsed.answer || '',
          analysis: parsed.analysis || ''
        }]
      }
    } else {
      result = {
        original_question: '', original_answer: '', original_analysis: '', original_error_analysis: '',
        questions: [{ type: 'text', question: content, svg_code: '', answer: '', analysis: '' }]
      }
    }

    console.log('处理完成:', new Date().toISOString())
    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(result) }

  } catch (err) {
    console.error('云函数执行错误:', err)
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) }
  }
}
