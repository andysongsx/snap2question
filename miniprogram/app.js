App({
  onLaunch() {
    // 检查本地存储的历史记录
    const history = wx.getStorageSync('question_history') || []
    this.globalData.history = history
  },
  globalData: {
    history: []
  }
})
