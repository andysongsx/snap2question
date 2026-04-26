const util = require('../../utils/util.js')

Page({
  data: {
    src: '',
    canvasWidth: 0,
    canvasHeight: 0,
    imgWidth: 0,
    imgHeight: 0,
    selecting: false,
    hasSelection: false,
    startX: 0,
    startY: 0,
    endX: 0,
    endY: 0,
    rotation: 0
  },

  canvas: null,
  ctx: null,
  cropCanvas: null,
  cropCtx: null,
  imageObj: null,
  dpr: 1,
  autoRotated: false,

  onLoad(options) {
    const src = decodeURIComponent(options.src)
    // 先用 compressImage 自动校正 EXIF 方向，输出的图就是"看到的样子"
    wx.compressImage({
      src,
      quality: 90,
      success: (res) => {
        this.setData({ src: res.tempFilePath })
        this.initCanvas(res.tempFilePath)
      },
      fail: () => {
        this.setData({ src })
        this.initCanvas(src)
      }
    })
  },

  initCanvas(src) {
    wx.getImageInfo({
      src,
      success: (info) => {
        const sysInfo = wx.getSystemInfoSync()
        const screenWidth = sysInfo.windowWidth
        const screenHeight = sysInfo.windowHeight

        // 计算可用区域（顶部提示 + 底部按钮 + 安全区）
        const pxRatio = sysInfo.windowWidth / 750
        const reservedHeight = (140 + 220 + (sysInfo.safeAreaInsets?.bottom || 0)) * pxRatio
        const availableHeight = screenHeight - reservedHeight

        // 全屏宽度，不保留左右边距；高度限制在可用区域内
        const maxDisplayWidth = screenWidth
        const maxDisplayHeight = availableHeight

        // 等比例缩放，完整显示图片（contain），不截断、不超出屏幕
        const scale = Math.min(
          maxDisplayWidth / info.width,
          maxDisplayHeight / info.height
        )

        const canvasWidth = info.width * scale
        const canvasHeight = info.height * scale

        this.setData({
          imgWidth: info.width,
          imgHeight: info.height,
          canvasWidth: Math.round(canvasWidth),
          canvasHeight: Math.round(canvasHeight)
        }, () => {
          this.setupCanvas(src)
        })
      },
      fail: () => {
        wx.showToast({ title: '图片加载失败', icon: 'none' })
      }
    })
  },

  setupCanvas(src) {
    const query = wx.createSelectorQuery()
    query.select('#imageCanvas').fields({ node: true, size: true }).exec((res) => {
      if (!res[0]) return
      const canvas = res[0].node
      const ctx = canvas.getContext('2d')
      const dpr = wx.getSystemInfoSync().pixelRatio

      canvas.width = this.data.canvasWidth * dpr
      canvas.height = this.data.canvasHeight * dpr
      ctx.scale(dpr, dpr)

      this.canvas = canvas
      this.ctx = ctx
      this.dpr = dpr

      const img = canvas.createImage()
      img.onload = () => {
        this.imageObj = img
        ctx.drawImage(img, 0, 0, this.data.canvasWidth, this.data.canvasHeight)
      }
      img.onerror = () => {
        wx.showToast({ title: '图片绘制失败', icon: 'none' })
      }
      img.src = src
    })

    // 初始化隐藏裁剪canvas
    const cropQuery = wx.createSelectorQuery()
    cropQuery.select('#cropCanvas').fields({ node: true, size: true }).exec((res) => {
      if (res[0]) {
        this.cropCanvas = res[0].node
        this.cropCtx = this.cropCanvas.getContext('2d')

        // cropCanvas 初始化完成，可在这里做后续操作
        // （EXIF 方向已在 onLoad 中通过 compressImage 自动校正）
      }
    })
  },

  onTouchStart(e) {
    if (!this.imageObj) return
    const touch = e.touches[0]
    this.setData({
      selecting: true,
      hasSelection: false,
      startX: touch.x,
      startY: touch.y,
      endX: touch.x,
      endY: touch.y
    })
    this.drawBase()
  },

  onTouchMove(e) {
    if (!this.data.selecting || !this.imageObj) return
    const touch = e.touches[0]
    this.setData({
      endX: touch.x,
      endY: touch.y
    })
    this.drawSelectionFrame()
  },

  onTouchEnd() {
    if (!this.data.selecting) return
    this.setData({ selecting: false, hasSelection: true })
    this.drawSelectionFrame()
  },

  drawBase() {
    if (!this.ctx || !this.imageObj) return
    const { canvasWidth, canvasHeight } = this.data
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    this.ctx.drawImage(this.imageObj, 0, 0, canvasWidth, canvasHeight)
  },

  drawSelectionFrame() {
    if (!this.ctx || !this.imageObj) return
    this.drawBase()

    const { startX, startY, endX, endY, canvasWidth, canvasHeight } = this.data
    const x = Math.min(startX, endX)
    const y = Math.min(startY, endY)
    const w = Math.abs(endX - startX)
    const h = Math.abs(endY - startY)

    if (w < 5 || h < 5) return

    const ctx = this.ctx

    // 用4个矩形画遮罩（避免从原始大图挖空的坐标错误）
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(0, 0, canvasWidth, y)           // 上方
    ctx.fillRect(0, y + h, canvasWidth, canvasHeight - y - h)  // 下方
    ctx.fillRect(0, y, x, h)                     // 左方
    ctx.fillRect(x + w, y, canvasWidth - x - w, h)  // 右方

    // 画高亮边框
    ctx.strokeStyle = '#07c160'
    ctx.lineWidth = 2.5
    ctx.setLineDash([6, 4])
    ctx.strokeRect(x, y, w, h)
    ctx.setLineDash([])

    // 画四个角的控制点（视觉提示）
    const cornerSize = 12
    ctx.fillStyle = '#07c160'
    ctx.fillRect(x - 2, y - 2, cornerSize, 3)
    ctx.fillRect(x - 2, y - 2, 3, cornerSize)
    ctx.fillRect(x + w - cornerSize + 2, y - 2, cornerSize, 3)
    ctx.fillRect(x + w - 2, y - 2, 3, cornerSize)
    ctx.fillRect(x - 2, y + h - cornerSize + 2, 3, cornerSize)
    ctx.fillRect(x - 2, y + h - 2, cornerSize, 3)
    ctx.fillRect(x + w - cornerSize + 2, y + h - 2, cornerSize, 3)
    ctx.fillRect(x + w - 2, y + h - cornerSize + 2, 3, cornerSize)
  },

  resetSelection() {
    this.setData({
      hasSelection: false,
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0
    })
    this.drawBase()
  },

  rotateImage() {
    if (!this.cropCanvas || !this.cropCtx) {
      wx.showToast({ title: '初始化中，请稍候', icon: 'none' })
      return
    }

    const { imgWidth, imgHeight, rotation } = this.data
    const newRotation = (rotation + 90) % 360
    const dpr = this.dpr

    // 旋转后的画布尺寸
    const isSwapped = newRotation === 90 || newRotation === 270
    const canvasW = isSwapped ? imgHeight : imgWidth
    const canvasH = isSwapped ? imgWidth : imgHeight

    this.cropCanvas.width = canvasW * dpr
    this.cropCanvas.height = canvasH * dpr
    this.cropCtx.scale(dpr, dpr)
    this.cropCtx.clearRect(0, 0, canvasW, canvasH)

    this.cropCtx.save()
    this.cropCtx.translate(canvasW / 2, canvasH / 2)
    this.cropCtx.rotate(newRotation * Math.PI / 180)
    this.cropCtx.translate(-imgWidth / 2, -imgHeight / 2)

    const img = this.cropCanvas.createImage()
    img.onload = () => {
      this.cropCtx.drawImage(img, 0, 0, imgWidth, imgHeight)
      this.cropCtx.restore()

      wx.canvasToTempFilePath({
        canvas: this.cropCanvas,
        x: 0,
        y: 0,
        width: canvasW,
        height: canvasH,
        destWidth: canvasW,
        destHeight: canvasH,
        fileType: 'jpg',
        quality: 0.92,
        success: (res) => {
          this.setData({
            src: res.tempFilePath,
            rotation: newRotation,
            hasSelection: false,
            startX: 0,
            startY: 0,
            endX: 0,
            endY: 0
          })
          this.initCanvas(res.tempFilePath)
        },
        fail: (err) => {
          wx.showToast({ title: '旋转失败', icon: 'none' })
          console.error(err)
        }
      })
    }
    img.onerror = () => {
      wx.showToast({ title: '图片加载失败', icon: 'none' })
    }
    img.src = this.data.src
  },

  confirmCrop() {
    const { startX, startY, endX, endY, canvasWidth, canvasHeight, imgWidth, imgHeight } = this.data
    const x = Math.min(startX, endX)
    const y = Math.min(startY, endY)
    const w = Math.abs(endX - startX)
    const h = Math.abs(endY - startY)

    if (w < 30 || h < 30) {
      wx.showToast({ title: '框选区域太小，请重新框选', icon: 'none' })
      return
    }

    wx.showLoading({ title: '裁剪中...', mask: true })

    // 计算在原图中的裁剪坐标
    const scaleX = imgWidth / canvasWidth
    const scaleY = imgHeight / canvasHeight
    const sx = Math.max(0, Math.round(x * scaleX))
    const sy = Math.max(0, Math.round(y * scaleY))
    const sWidth = Math.min(Math.round(w * scaleX), imgWidth - sx)
    const sHeight = Math.min(Math.round(h * scaleY), imgHeight - sy)

    // 确保裁剪canvas已初始化
    if (!this.cropCanvas) {
      const cropQuery = wx.createSelectorQuery()
      cropQuery.select('#cropCanvas').fields({ node: true, size: true }).exec((res) => {
        if (res[0]) {
          this.cropCanvas = res[0].node
          this.cropCtx = this.cropCanvas.getContext('2d')
          this.performCrop(sx, sy, sWidth, sHeight)
        } else {
          wx.hideLoading()
          wx.showToast({ title: '初始化失败', icon: 'none' })
        }
      })
    } else {
      this.performCrop(sx, sy, sWidth, sHeight)
    }
  },

  performCrop(sx, sy, sWidth, sHeight) {
    const cropCanvas = this.cropCanvas
    const cropCtx = this.cropCtx
    const dpr = this.dpr

    // 限制输出尺寸，控制文件大小和Token消耗
    let outWidth = sWidth
    let outHeight = sHeight
    const maxSide = 800  // 从1200降到800，减少模型处理时间
    if (outWidth > maxSide || outHeight > maxSide) {
      const scale = maxSide / Math.max(outWidth, outHeight)
      outWidth = Math.round(outWidth * scale)
      outHeight = Math.round(outHeight * scale)
    }

    cropCanvas.width = outWidth * dpr
    cropCanvas.height = outHeight * dpr
    cropCtx.scale(dpr, dpr)
    cropCtx.clearRect(0, 0, outWidth, outHeight)

    const img = cropCanvas.createImage()
    img.onload = () => {
      cropCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, outWidth, outHeight)

      wx.canvasToTempFilePath({
        canvas: cropCanvas,
        x: 0,
        y: 0,
        width: outWidth,
        height: outHeight,
        destWidth: outWidth,
        destHeight: outHeight,
        fileType: 'jpg',
        quality: 0.70,  // 从0.85降到0.70
        success: (res) => {
          wx.hideLoading()
          this.uploadAndGenerate(res.tempFilePath)
        },
        fail: (err) => {
          wx.hideLoading()
          wx.showToast({ title: '裁剪导出失败', icon: 'none' })
          console.error(err)
        }
      })
    }
    img.onerror = () => {
      wx.hideLoading()
      wx.showToast({ title: '图片加载失败', icon: 'none' })
    }
    img.src = this.data.src
  },

  async uploadAndGenerate(filePath) {
    wx.showLoading({ title: '正在识别题目并生成...\n约需 10-30 秒', mask: true })
    try {
      // 获取文件大小，如果太大则进一步压缩
      const fs = wx.getFileSystemManager()
      const stats = fs.statSync(filePath)
      let finalPath = filePath
      
      if (stats.size > 500 * 1024) {
        // 超过500KB，进一步压缩
        const compressRes = await wx.compressImage({
          src: filePath,
          quality: 50
        })
        finalPath = compressRes.tempFilePath
      }

      // 转为base64
      const base64 = await util.fileToBase64(finalPath)

      // 读取用户配置（学段/年级/数量）
      const cfg = util.getConfig() || { levelIndex: 1, gradeIndex: 2, countIndex: 0 }
      const levels = ['小学', '初中']
      const gradesMap = {
        '小学': ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
        '初中': ['初一', '初二', '初三']
      }
      const level = levels[cfg.levelIndex] || '初中'
      const grade = (gradesMap[level] || gradesMap['初中'])[cfg.gradeIndex] || '初三'
      const count = ['1', '2', '3', '4', '5'][cfg.countIndex] || '1'

      // 调用 Kimi API（传入配置参数）
      const result = await util.callKimiAPI(base64, { level, grade, count })

      // 保存到本地历史
      util.saveToHistory(result)

      wx.hideLoading()
      wx.navigateTo({
        url: `/pages/result/result?data=${encodeURIComponent(JSON.stringify(result))}`
      })
    } catch (err) {
      wx.hideLoading()
      wx.showModal({
        title: '生成失败',
        content: err.message || '网络异常或API配置错误，请检查',
        showCancel: false
      })
      console.error('生成题目失败:', err)
    }
  }
})
