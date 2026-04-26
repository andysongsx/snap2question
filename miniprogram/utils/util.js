const config = require('../config.js')

/**
 * 将临时文件转为 Base64
 */
function fileToBase64(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager()
    fs.readFile({
      filePath,
      encoding: 'base64',
      success: res => resolve(res.data),
      fail: reject
    })
  })
}

/**
 * 检查并压缩图片
 */
function compressImage(src) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src,
      success: (info) => {
        let targetWidth = info.width
        const maxWidth = config.imageCompress.maxWidth
        
        if (targetWidth > maxWidth) {
          targetWidth = maxWidth
        }
        
        // 使用小程序内置压缩
        wx.compressImage({
          src,
          quality: config.imageCompress.quality * 100,
          success: (res) => resolve(res.tempFilePath),
          fail: reject
        })
      },
      fail: reject
    })
  })
}

/**
 * 调用云函数/Kimi API
 * @param {string} base64Image - base64 图片
 * @param {object} options - 配置参数 {level, grade, count}
 */
function callKimiAPI(base64Image, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: config.API_BASE_URL,
      method: 'POST',
      header: {
        'Content-Type': 'application/json'
      },
      data: {
        image_base64: base64Image,
        level: options.level || '初中',
        grade: options.grade || '初三',
        count: options.count || '1'
      },
      timeout: 120000,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          reject(new Error(res.data?.error || `请求失败: ${res.statusCode}`))
        }
      },
      fail: reject
    })
  })
}

/**
 * 读取配置
 */
function getConfig() {
  try {
    return wx.getStorageSync('app_config') || null
  } catch (e) {
    return null
  }
}

/**
 * 保存配置
 */
function saveConfig(config) {
  try {
    wx.setStorageSync('app_config', config)
  } catch (e) {
    console.error('保存配置失败', e)
  }
}

/**
 * 保存题目到本地历史
 */
function saveToHistory(record) {
  try {
    let history = wx.getStorageSync('question_history') || []
    
    // 兼容新格式（questions数组）：把第一道题的题目提取到顶层，供历史列表显示
    if (!record.question && record.questions && record.questions.length > 0) {
      record.question = record.questions[0].question
    }
    
    record.id = Date.now().toString()
    record.createTime = new Date().toLocaleString()
    history.unshift(record)
    // 最多保留50条
    if (history.length > 50) history = history.slice(0, 50)
    wx.setStorageSync('question_history', history)
    return history
  } catch (e) {
    console.error('保存历史失败', e)
    return []
  }
}

/**
 * 获取历史记录
 */
function getHistory() {
  try {
    return wx.getStorageSync('question_history') || []
  } catch (e) {
    return []
  }
}

/**
 * 删除单条历史
 */
function removeHistory(id) {
  let history = getHistory()
  history = history.filter(item => item.id !== id)
  wx.setStorageSync('question_history', history)
  return history
}

module.exports = {
  fileToBase64,
  compressImage,
  callKimiAPI,
  saveToHistory,
  getHistory,
  removeHistory,
  getConfig,
  saveConfig
}
