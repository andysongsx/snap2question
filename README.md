# 📸 Snap2Question — 拍照出题助手

> 微信小程序 + 腾讯云 SCF + Kimi AI —— 拍一道题，AI 生成相似题型

中小学生拍照上传题目，手指框选区域后，由 AI 多模态模型识别并生成难度相同的类似题型。支持学段/年级/数量配置，每道题附带详细解析和勘误。

---

## ✨ 功能特性

| 功能 | 说明 |
|------|------|
| 📷 **拍照出题** | 拍照或从相册选择，支持练习册、试卷、手写题目 |
| ✂️ **手指框选** | Canvas 2D 拖拽框选题目区域，自动裁剪上传 |
| 🔄 **自动旋转** | 竖版照片自动校正 EXIF 方向，横屏全屏显示 |
| 🎓 **学段配置** | 小学/初中 + 年级 + 出题数量，配置保存到本地 |
| 📝 **原题解析** | 识别原题文字，给出详细解题思路和知识点讲解 |
| ⚠️ **题目勘误** | 若原题有错误（条件矛盾、答案错误），指出错误原因和正确做法 |
| 📋 **多道题生成** | 一次生成 1-5 道类似题型，swiper 滑动切换 |
| 🎨 **图形题支持** | 几何题自动生成 SVG 代码，小程序内直接渲染 |
| 💾 **本地历史** | 结果保存到本地，支持查看、复制、删除 |

---

## 🏗️ 技术架构

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  微信小程序  │────▶│ 腾讯云 SCF  │────▶│  Kimi AI   │
│  (前端)      │◀────│  (Node.js)  │◀────│  (多模态)   │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **前端**：微信小程序原生框架，Canvas 2D 框选，swiper 多题切换
- **后端**：腾讯云 Serverless Cloud Function (SCF)，Node.js 18
- **AI**：Moonshot Kimi `moonshot-v1-32k-vision-preview`，支持图片输入
- **部署**：Python SDK 一键更新函数代码和环境变量

---

## 📁 目录结构

```
.
├── miniprogram/                    # 微信小程序前端
│   ├── pages/
│   │   ├── index/                  # 首页：拍照入口 + 配置面板 + 历史记录
│   │   ├── crop/                   # 框选页：手指拖拽框选 + 自动旋转
│   │   └── result/                 # 结果页：原题解析 + 多题 swiper + 答案/解析
│   ├── utils/util.js               # 工具函数：压缩、Base64、API调用、配置缓存
│   ├── config.js                   # API 地址配置
│   └── app.json                    # 页面路由 + 全局配置
│
├── cloudfunction/kimi-proxy/       # 腾讯云 SCF 云函数
│   ├── index.js                    # 主逻辑：接收图片 → 调用 Kimi → 返回 JSON
│   └── package.json                # 云函数依赖（空，无第三方包）
│
├── deploy_tencent.py               # 自动化部署脚本（Python SDK）
├── create_func_url.py              # 创建函数 URL 脚本
├── .env.example                    # 环境变量模板
└── README.md                       # 本文件
```

---

## 🚀 快速部署

### 1. 准备工作

- 注册 [腾讯云账号](https://cloud.tencent.com/) 并完成实名认证
- 注册 [Moonshot AI](https://platform.moonshot.cn/) 获取 API Key
- 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 准备一个小程序 AppID（个人主体即可）

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```bash
# 腾讯云密钥 (从 https://console.cloud.tencent.com/cam/capi 获取)
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey

# Kimi API 配置 (从 https://platform.moonshot.cn 获取)
KIMI_API_KEY=你的KimiAPIKey
KIMI_MODEL=moonshot-v1-32k-vision-preview
```

### 3. 部署后端云函数

```bash
# 加载环境变量
export $(cat .env | xargs)

# 一键部署/更新云函数
python3 deploy_tencent.py
```

部署成功后会输出函数 URL，例如：
```
https://1255419991-xxxx.ap-guangzhou.tencentscf.com
```

### 4. 配置小程序前端

打开 `miniprogram/config.js`，填入你的函数 URL：

```javascript
module.exports = {
  API_BASE_URL: 'https://你的函数URL.ap-guangzhou.tencentscf.com',
}
```

### 5. 配置小程序服务器域名

登录 [微信公众平台](https://mp.weixin.qq.com/) → 你的小程序 → **开发** → **开发设置** → **服务器域名**：

- `request合法域名`：添加你的函数 URL（如 `https://1255419991-xxxx.ap-guangzhou.tencentscf.com`）

> ⚠️ 域名添加后需等待 1-5 分钟生效，且必须为 HTTPS。

### 6. 导入微信开发者工具

1. 打开微信开发者工具 → **导入项目**
2. 选择 `miniprogram/` 目录
3. 填入你的小程序 AppID
4. 点击编译预览

### 7. 真机调试

1. 点击**真机调试**，扫码在手机上测试
2. 确认拍照 → 框选 → 生成全流程正常
3. 点击**上传**提交微信审核

---

## ⚙️ 云函数手动配置（备选）

如果不想用自动化脚本，也可以手动在腾讯云控制台部署：

1. 登录 [腾讯云 SCF 控制台](https://console.cloud.tencent.com/scf)
2. 新建函数：**函数名称** `kimi-proxy`，**运行环境** Node.js 18
3. 将 `cloudfunction/kimi-proxy/index.js` 粘贴为入口文件
4. **函数配置** → **环境变量**：
   - `KIMI_API_KEY` = 你的 Kimi API Key
   - `KIMI_MODEL` = `moonshot-v1-32k-vision-preview`
5. **函数管理** → **函数 URL** → 开启并配置 CORS
6. 复制函数 URL 填入小程序 `config.js`

---

## 🔧 关键设计说明

### 前端裁剪（节省 Token）

用户框选后，前端只裁剪出目标题目区域上传，而非整张照片：
- 大幅减少 Token 消耗（整页练习册 vs 单题）
- 避免 AI 被旁边题目干扰
- 输出尺寸限制最大边 800px，质量 70%，控制文件体积

### 自动旋转 EXIF

手机横拍的照片带有 EXIF 方向信息，`wx.getImageInfo` 返回的是原始像素尺寸。使用 `wx.compressImage` 自动校正方向后，竖版照片不会再被错误地竖屏显示。

### 多道题 swiper

结果页使用 `swiper` 组件展示多道生成题目，每道题独立展开/收起答案和解析。切换题目时自动收起上一题的展开状态。

### response_format 强制 JSON

后端调用 Kimi API 时设置 `response_format: { type: 'json_object' }`，强制模型只输出纯 JSON，避免 Markdown 代码块包裹或格式说明嵌套进字段。

---

## 🐛 常见问题

| 问题 | 解决方案 |
|------|---------|
| 真机请求失败 / 433 | 检查小程序后台「服务器域名」是否已添加函数 URL |
| Kimi 返回空内容 | 通常是图片太大或模型处理超时，前端已做压缩，可适当再降低 `maxSide` |
| 框选时页面滚动 | 已使用 `catchtouch*` 事件阻止页面滚动 |
| SVG 无法显示 | 确保 SVG 包含 `viewBox` 且无外部依赖；基础库需 2.7.0+ |
| LaTeX 公式显示源码 | 小程序端暂未引入 KaTeX，公式以等宽字体展示；可后续引入 `towxml` |

---

## 📜 License

MIT
