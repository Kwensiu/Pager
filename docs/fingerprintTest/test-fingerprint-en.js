// Fingerprint Test Script
// Run this script in the browser console to verify the fingerprint obfuscation function
// Note: This script must be run in a browser environment, not in Node.js

// Check runtime environment
if (typeof window === 'undefined') {
  console.error('This script must be run in a browser environment!')
  console.log('Please follow these steps:')
  console.log('1. Start the application: pnpm dev')
  console.log('2. Open a website and enable fingerprint obfuscation')
  console.log('3. Press F12 to open developer tools')
  console.log('4. Paste and run this script in the console')
  process.exit(1)
}

console.log('=== Fingerprint Obfuscation Test Started ===')

// 1. Check basic fingerprint information
console.log('1. Basic fingerprint information:')
console.log('User-Agent:', navigator.userAgent)
console.log('Platform:', navigator.platform)
console.log('Language:', navigator.language)
console.log('Languages:', navigator.languages)

// 2. Check hardware fingerprint
console.log('\n2. Hardware fingerprint:')
console.log('Hardware Concurrency:', navigator.hardwareConcurrency)
console.log('Device Memory:', navigator.deviceMemory)
console.log('Max Touch Points:', navigator.maxTouchPoints)

// 3. Check screen fingerprint
console.log('\n3. Screen fingerprint:')
console.log('Screen Width:', screen.width)
console.log('Screen Height:', screen.height)
console.log('Screen AvailWidth:', screen.availWidth)
console.log('Screen AvailHeight:', screen.availHeight)
console.log('Color Depth:', screen.colorDepth)
console.log('Pixel Ratio:', window.devicePixelRatio)

// 4. Check timezone
console.log('\n4. Timezone information:')
console.log('Timezone:', Intl.DateTimeFormat().resolvedOptions().timeZone)

// 5. Check Canvas fingerprint
console.log('\n5. Canvas fingerprint test:')
const canvas = document.createElement('canvas')
const ctx = canvas.getContext('2d')
ctx.textBaseline = 'top'
ctx.font = '14px Arial'
ctx.fillText('Fingerprint test', 2, 2)
const canvasFingerprint = canvas.toDataURL()
console.log('Canvas Fingerprint (first 50 chars):', canvasFingerprint.substring(0, 50) + '...')

// 6. Check WebGL fingerprint
console.log('\n6. WebGL fingerprint test:')
const gl = document.createElement('canvas').getContext('webgl')
if (gl) {
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  if (debugInfo) {
    console.log('WebGL Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
    console.log('WebGL Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
  }
}

// 7. Check audio fingerprint
console.log('\n7. Audio fingerprint test:')
try {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  const audioContext = new AudioContext()
  console.log('Audio Context Sample Rate:', audioContext.sampleRate)
  audioContext.close()
} catch (e) {
  console.log('Audio Context not available:', e.message)
}

console.log('\n=== Fingerprint Obfuscation Test Completed ===')

// 8. Check if modified (by checking if properties are writable)
console.log('\n8. Property writability check:')
const userAgentDescriptor = Object.getOwnPropertyDescriptor(navigator, 'userAgent')
console.log('User-Agent is writable:', userAgentDescriptor?.writable)
console.log('User-Agent is configurable:', userAgentDescriptor?.configurable)

const platformDescriptor = Object.getOwnPropertyDescriptor(navigator, 'platform')
console.log('Platform is writable:', platformDescriptor?.writable)
console.log('Platform is configurable:', platformDescriptor?.configurable)

console.log(
  '\n=== Test completed, please compare this output with the expected fingerprint obfuscation settings ==='
)
