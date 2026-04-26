const util = require('../../utils/util.js')

const GRADE_MAP = {
  '小学': ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
  '初中': ['初一', '初二', '初三']
}

const DEFAULT_CONFIG = {
  levelIndex: 1,    // 初中
  gradeIndex: 2,    // 初三
  countIndex: 0     // 1道
}

Page({
  data: {
    history: [],
    gradeLevels: ['小学', '初中'],
    grades: GRADE_MAP['初中'],
    counts: ['1', '2', '3', '4', '5'],
    levelIndex: DEFAULT_CONFIG.levelIndex,
    gradeIndex: DEFAULT_CONFIG.gradeIndex,
    countIndex: DEFAULT_CONFIG.countIndex
  },

  onLoad() {
    this.loadHistory()
    this.loadConfig()
  },

  onShow() {
    this.loadHistory()
  },

  loadHistory() {
    const history = util.getHistory()
    this.setData({ history })
  },

  loadConfig() {
    const cfg = util.getConfig()
    if (cfg) {
      const level = this.data.gradeLevels[cfg.levelIndex] || '初中'
      this.setData({
        levelIndex: cfg.levelIndex,
        gradeIndex: cfg.gradeIndex,
        countIndex: cfg.countIndex,
        grades: GRADE_MAP[level] || GRADE_MAP['初中']
      })
    }
  },

  saveConfig(data) {
    util.saveConfig(data)
  },

  onLevelChange(e) {
    const index = parseInt(e.detail.value)
    const level = this.data.gradeLevels[index]
    const newGrades = GRADE_MAP[level]
    this.setData({
      levelIndex: index,
      grades: newGrades,
      gradeIndex: Math.min(this.data.gradeIndex, newGrades.length - 1)
    })
    this.saveConfig({
      levelIndex: index,
      gradeIndex: Math.min(this.data.gradeIndex, newGrades.length - 1),
      countIndex: this.data.countIndex
    })
  },

  onGradeChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({ gradeIndex: index })
    this.saveConfig({
      levelIndex: this.data.levelIndex,
      gradeIndex: index,
      countIndex: this.data.countIndex
    })
  },

  onCountChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({ countIndex: index })
    this.saveConfig({
      levelIndex: this.data.levelIndex,
      gradeIndex: this.data.gradeIndex,
      countIndex: index
    })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath
        wx.showLoading({ title: '处理中...' })
        util.compressImage(tempFilePath)
          .then(compressedPath => {
            wx.hideLoading()
            wx.navigateTo({
              url: `/pages/crop/crop?src=${encodeURIComponent(compressedPath)}`
            })
          })
          .catch(err => {
            wx.hideLoading()
            wx.showToast({ title: '图片处理失败', icon: 'none' })
            console.error(err)
          })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) return
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    })
  },

  viewHistory(e) {
    const index = e.currentTarget.dataset.index
    const record = this.data.history[index]
    wx.navigateTo({
      url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(record))}`
    })
  },

  deleteHistory(e) {
    const id = e.currentTarget.dataset.id
    util.removeHistory(id)
    this.loadHistory()
  },

  clearAllHistory() {
    wx.showModal({
      title: '确认清空',
      content: '将删除所有本地历史记录，不可恢复',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('question_history')
          this.loadHistory()
        }
      }
    })
  }
})
