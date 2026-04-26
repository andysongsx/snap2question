#!/usr/bin/env node
/**
 * 交互式一键部署脚本
 * 用法: node deploy.js
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a.trim())))

const ENV_PATH = path.join(__dirname, '.env')

function run(cmd, opts = {}) {
  console.log(`\n> ${cmd}\n`)
  const pathEnv = process.env.PATH || ''
  const homebrewPath = '/opt/homebrew/bin'
  const enhancedPath = pathEnv.includes(homebrewPath) ? pathEnv : `${homebrewPath}:${pathEnv}`
  const homeEnv = process.env.HOME || require('os').homedir()
  return execSync(cmd, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PATH: enhancedPath, HOME: homeEnv, ...opts.env },
    ...opts
  })
}

function hasCommand(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return {}
  const content = fs.readFileSync(ENV_PATH, 'utf-8')
  const env = {}
  content.split('\n').forEach((line) => {
    const match = line.match(/^([^#=\s]+)=(.*)$/)
    if (match) env[match[1]] = match[2]
  })
  return env
}

function saveEnv(env) {
  const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`)
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8')
  console.log('\n✅ 配置已保存到 .env（已自动加入 .gitignore，不会提交到仓库）')
}

async function ensureServerless() {
  if (hasCommand('sls') || hasCommand('serverless')) {
    console.log('✅ Serverless Framework 已安装')
    return
  }

  console.log('⚠️ 未检测到 Serverless Framework，需要全局安装')
  const ok = await ask('是否自动安装? (Y/n): ')
  if (ok && ok.toLowerCase() === 'n') {
    console.log('请手动执行: npm install -g serverless')
    process.exit(1)
  }

  run('npm install -g serverless')
}

async function ensureCredentials() {
  let env = loadEnv()

  // 如果 .env 里已有完整配置，询问是否复用
  const hasLLMKey = env.KIMI_API_KEY || env.DEEPSEEK_API_KEY || env.MINIMAX_API_KEY
  if (
    env.TENCENT_SECRET_ID &&
    env.TENCENT_SECRET_KEY &&
    hasLLMKey
  ) {
    console.log('\n📄 检测到已有 .env 配置:')
    console.log(`   TENCENT_SECRET_ID: ${env.TENCENT_SECRET_ID.slice(0, 6)}...`)
    const llmKey = env.KIMI_API_KEY || env.DEEPSEEK_API_KEY || env.MINIMAX_API_KEY
    console.log(`   LLM_API_KEY: ${llmKey.slice(0, 10)}...`)
    const reuse = await ask('是否使用已有配置直接部署? (Y/n): ')
    if (reuse === '' || reuse.toLowerCase() === 'y') {
      return env
    }
  }

  console.log('\n--- 请输入部署配置 ---')
  console.log('提示: 腾讯云密钥从 https://console.cloud.tencent.com/cam/capi 获取\n')

  env.TENCENT_SECRET_ID = await ask('腾讯云 SecretId: ')
  env.TENCENT_SECRET_KEY = await ask('腾讯云 SecretKey: ')
  env.KIMI_API_KEY = await ask('Kimi (Moonshot) API Key: ')

  const model = await ask(`Kimi 模型名 (默认 kimi-latest): `)
  env.KIMI_MODEL = model || 'kimi-latest'

  // 保存到 .env
  saveEnv(env)
  return env
}

async function deploy(env) {
  console.log('\n🚀 开始部署云函数 + API 网关...')
  console.log('   区域: ap-guangzhou')
  console.log('   函数: kimi-proxy')
  console.log('   内存: 512MB')
  console.log('   超时: 60s\n')

  try {
    run('/opt/homebrew/bin/node /opt/homebrew/lib/node_modules/serverless/run.js deploy', {
      env: {
        TENCENT_SECRET_ID: env.TENCENT_SECRET_ID,
        TENCENT_SECRET_KEY: env.TENCENT_SECRET_KEY,
        KIMI_API_KEY: env.KIMI_API_KEY,
        KIMI_MODEL: env.KIMI_MODEL
      }
    })
  } catch (err) {
    console.error('\n❌ 部署失败:', err.message)
    console.log('\n常见原因:')
    console.log('  1. 腾讯云密钥错误或欠费')
    console.log('  2. 当前账号未开通 SCF 或 API 网关服务')
    console.log('  3. 网络问题，建议重试')
    process.exit(1)
  }
}

async function main() {
  console.log('========================================')
  console.log('  📸 拍照出题助手 - 自动化部署')
  console.log('========================================\n')

  await ensureServerless()
  const env = await ensureCredentials()
  await deploy(env)

  console.log('\n========================================')
  console.log('  ✅ 部署完成！')
  console.log('========================================')
  console.log('\n下一步:')
  console.log('  1. 从上方输出中找到 API 网关 URL')
  console.log('  2. 将其填入 miniprogram/config.js 的 API_BASE_URL')
  console.log('  3. 打开微信开发者工具导入 miniprogram/ 目录')

  rl.close()
}

main().catch((err) => {
  console.error(err)
  rl.close()
  process.exit(1)
})
