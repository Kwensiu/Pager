// 指纹伪装测试脚本
// 在浏览器控制台中运行此脚本来验证指纹伪装功能
// 注意：此脚本必须在浏览器环境中运行，不能在 Node.js 中运行

// 检查运行环境
if (typeof window === 'undefined') {
  console.error('此脚本必须在浏览器环境中运行！')
  console.log('请按以下步骤操作：')
  console.log('1. 启动应用: pnpm dev')
  console.log('2. 打开一个网站并启用指纹伪装')
  console.log('3. 按 F12 打开开发者工具')
  console.log('4. 在控制台中粘贴并运行此脚本')
  process.exit(1)
}

console.log('=== 指纹伪装测试开始 ===')

// 1. 检查基本指纹信息
console.log('1. 基本指纹信息:')
console.log('User-Agent:', navigator.userAgent)
console.log('Platform:', navigator.platform)
console.log('Language:', navigator.language)
console.log('Languages:', navigator.languages)

// 2. 检查硬件指纹
console.log('\n2. 硬件指纹:')
console.log('Hardware Concurrency:', navigator.hardwareConcurrency)
console.log('Device Memory:', navigator.deviceMemory)
console.log('Max Touch Points:', navigator.maxTouchPoints)

// 3. 检查屏幕指纹
console.log('\n3. 屏幕指纹:')
console.log('Screen Width:', screen.width)
console.log('Screen Height:', screen.height)
console.log('Screen AvailWidth:', screen.availWidth)
console.log('Screen AvailHeight:', screen.availHeight)
console.log('Color Depth:', screen.colorDepth)
console.log('Pixel Ratio:', window.devicePixelRatio)

// 4. 检查时区
console.log('\n4. 时区信息:')
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)

// 5. 检查Canvas指纹
console.log('\n5. Canvas指纹测试:')
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
ctx.textBaseline = 'top'
ctx.font = '14px Arial'
ctx.fillText('Fingerprint test', 2, 2)
const canvasFingerprint = canvas.toDataURL()
console.log('Canvas Fingerprint (first 50 chars):', canvasFingerprint.substring(0, 50) + '...')

// 6. 检查WebGL指纹
console.log('\n6. WebGL指纹测试:')
const gl = document.createElement('canvas').getContext('webgl')
if (gl) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  if (debugInfo) {
    console.log('WebGL Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
    console.log('WebGL Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
  }
}

// 7. 检查音频指纹
console.log('\n7. 音频指纹测试:')
try {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  const audioContext = new AudioContext()
  console.log('Audio Context Sample Rate:', audioContext.sampleRate)
  audioContext.close()
} catch (e) {
  console.log('Audio Context not available:', e.message)
}

console.log('\n=== 指纹伪装测试完成 ===')

// 8. 检查是否被修改（通过检查属性是否可写）
console.log('\n8. 属性可写性检查:')
const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
console.log('User-Agent is writable:', userAgentDescriptor?.writable)
console.log('User-Agent is configurable:', userAgentDescriptor?.configurable)

const platformDescriptor = Object.getOwnPropertyDescriptor(navigator, 'platform')
console.log('Platform is writable:', platformDescriptor?.writable)
console.log('Platform is configurable:', platformDescriptor?.configurable)

console.log('\n=== 测试完成，请将此输出与预期指纹伪装设置对比 ===')
