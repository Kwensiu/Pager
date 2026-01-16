// 扩展隔离预加载脚本
// 为每个扩展提供隔离的运行环境

const { contextBridge, ipcRenderer } = window.electron || {}

// 向渲染进程暴露隔离相关的API
contextBridge.exposeInMainWorld('extensionIsolation', {
  /**
   * 获取扩展隔离信息
   */
  getIsolationInfo: () => ipcRenderer.invoke('extension-isolation:get-info'),

  /**
   * 请求权限
   */
  requestPermission: (permission, details) =>
    ipcRenderer.invoke('extension-isolation:request-permission', permission, details),

  /**
   * 记录扩展行为
   */
  logActivity: (activity) => ipcRenderer.send('extension-isolation:log-activity', activity),

  /**
   * 检查权限状态
   */
  checkPermission: (permission) =>
    ipcRenderer.invoke('extension-isolation:check-permission', permission)
})

// 监听扩展行为并记录
console.log('Extension isolation preload script loaded')

// 阻止某些敏感API的访问
if (typeof window !== 'undefined') {
  // 限制访问某些全局对象
  const restrictedGlobals = ['chrome', 'browser', 'require', 'module']

  restrictedGlobals.forEach((global) => {
    if (window[global]) {
      console.warn(`Extension attempting to access restricted global: ${global}`)
      // 可以选择性地重写或阻止访问
    }
  })
}

// 注入隔离相关的CSS样式
const isolationStyles = `
  /* 扩展隔离样式 */
  .extension-isolation-warning {
    position: fixed;
    top: 10px;
    right: 10px;
    background: #ffeb3b;
    color: #333;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  
  .extension-isolation-indicator {
    position: fixed;
    bottom: 10px;
    left: 10px;
    background: rgba(0,0,0,0.7);
    color: white;
    padding: 4px 8px;
    border-radius: 3px;
    font-size: 10px;
    z-index: 10000;
  }
`

// 添加隔离样式到页面
const styleElement = document.createElement('style')
styleElement.textContent = isolationStyles
document.head.appendChild(styleElement)

// 创建隔离指示器
const indicator = document.createElement('div')
indicator.className = 'extension-isolation-indicator'
indicator.textContent = 'Extension Isolation Active'
document.body.appendChild(indicator)

// 监听页面变化
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList') {
      // 检查是否有新的脚本注入
      mutation.addedNodes.forEach((node) => {
        if (node.tagName === 'SCRIPT' || node.tagName === 'IFRAME') {
          console.log('Extension isolation detected script/iframe injection:', node)
          // 可以选择阻止或记录
        }
      })
    }
  })
})

// 开始观察DOM变化
observer.observe(document.body, {
  childList: true,
  subtree: true
})

// 页面卸载时清理
window.addEventListener('beforeunload', () => {
  observer.disconnect()
  if (indicator.parentNode) {
    indicator.parentNode.removeChild(indicator)
  }
})

console.log('Extension isolation environment initialized')
