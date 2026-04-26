// 配置文件：请根据你的实际部署情况修改
module.exports = {
  // 腾讯云SCF函数URL
  API_BASE_URL: 'https://1255419991-lgs67dyyqh.ap-guangzhou.tencentscf.com',
  
  // 图片压缩参数
  imageCompress: {
    maxWidth: 1200,      // 最大宽度
    quality: 0.85,       // 压缩质量
    maxFileSize: 1500    // 最大文件大小KB，超过则进一步压缩
  }
}
