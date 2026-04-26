Page({
  data: {
    original_question: '',
    original_answer: '',
    original_analysis: '',
    original_error_analysis: '',
    questions: [],
    currentIndex: 0,
    showAnswer: false,
    showAnalysis: false,
    showOriginalAnalysis: false,
    showErrorAnalysis: false,
    svgBase64: ''
  },

  onLoad(options) {
    try {
      const dataStr = decodeURIComponent(options.data)
      const result = JSON.parse(dataStr)

      // 兼容旧格式
      let questions = []
      if (result.questions && Array.isArray(result.questions)) {
        questions = result.questions
      } else {
        questions = [{
          type: result.type || 'text',
          question: result.question || '',
          svg_code: result.svg_code || '',
          answer: result.answer || '',
          analysis: result.analysis || ''
        }]
      }

      // 如果有SVG代码，转为base64
      let svgBase64 = ''
      const firstSvg = questions.find(q => q.type === 'svg' && q.svg_code)
      if (firstSvg) {
        svgBase64 = this.utf8ToBase64(firstSvg.svg_code)
      }

      this.setData({
        original_question: result.original_question || '',
        original_answer: result.original_answer || '',
        original_analysis: result.original_analysis || '',
        original_error_analysis: result.original_error_analysis || '',
        questions,
        currentIndex: 0,
        showAnswer: false,
        showAnalysis: false,
        showOriginalAnalysis: false,
        showErrorAnalysis: false,
        svgBase64
      })
    } catch (e) {
      wx.showToast({ title: '数据加载失败', icon: 'none' })
      console.error(e)
    }
  },

  onSwiperChange(e) {
    this.setData({
      currentIndex: e.detail.current,
      showAnswer: false,
      showAnalysis: false
    })
  },

  prevQuestion() {
    if (this.data.currentIndex > 0) {
      this.setData({
        currentIndex: this.data.currentIndex - 1,
        showAnswer: false,
        showAnalysis: false
      })
    }
  },

  nextQuestion() {
    if (this.data.currentIndex < this.data.questions.length - 1) {
      this.setData({
        currentIndex: this.data.currentIndex + 1,
        showAnswer: false,
        showAnalysis: false
      })
    }
  },

  toggleAnswer() {
    this.setData({ showAnswer: !this.data.showAnswer })
  },

  toggleAnalysis() {
    this.setData({ showAnalysis: !this.data.showAnalysis })
  },

  toggleOriginalAnalysis() {
    this.setData({ showOriginalAnalysis: !this.data.showOriginalAnalysis })
  },

  toggleErrorAnalysis() {
    this.setData({ showErrorAnalysis: !this.data.showErrorAnalysis })
  },

  copyQuestion() {
    const q = this.data.questions[this.data.currentIndex]
    let text = ''
    
    if (this.data.original_question) {
      text += `【原始题目】\n${this.data.original_question}\n`
      if (this.data.original_answer) text += `答案：${this.data.original_answer}\n`
      if (this.data.original_analysis) text += `解析：${this.data.original_analysis}\n`
      text += '\n'
    }
    
    text += `【新题目】\n${q.question}\n\n`
    if (q.answer) text += `答案：\n${q.answer}\n\n`
    if (q.analysis) text += `解析：\n${q.analysis}`

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
      }
    })
  },

  goHome() {
    wx.reLaunch({ url: '/pages/index/index' })
  },

  previewSvg() {
    wx.showToast({ title: '长按可保存图片', icon: 'none' })
  },

  utf8ToBase64(str) {
    try {
      const utf8 = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(parseInt(p1, 16))
      })
      const bytes = new Uint8Array(utf8.length)
      for (let i = 0; i < utf8.length; i++) {
        bytes[i] = utf8.charCodeAt(i)
      }
      return wx.arrayBufferToBase64(bytes.buffer)
    } catch (e) {
      console.error('SVG编码失败', e)
      return ''
    }
  }
})
