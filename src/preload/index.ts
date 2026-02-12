import { contextBridge, ipcRenderer } from 'electron'
import { api } from './api'

// 尝试导入 @electron-toolkit/preload，如果不可用则使用空对象
let electronAPI: Record<string, unknown> = {}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  electronAPI = require('@electron-toolkit/preload').electronAPI
} catch (error) {
  console.warn('@electron-toolkit/preload not available, using fallback:', error)
  // 提供基本的 electronAPI 回退
  electronAPI = {
    ipcRenderer: {
      invoke: ipcRenderer.invoke.bind(ipcRenderer),
      on: ipcRenderer.on.bind(ipcRenderer),
      once: ipcRenderer.once.bind(ipcRenderer),
      removeListener: ipcRenderer.removeListener.bind(ipcRenderer),
      removeAllListeners: ipcRenderer.removeAllListeners.bind(ipcRenderer)
    }
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      shell: {
        openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
      },
      extension: {
        createConfigPage: (
          extensionId: string,
          extensionName: string,
          extensionPath: string,
          manifest: Record<string, unknown>
        ) =>
          ipcRenderer.invoke(
            'extension:create-config-page',
            extensionId,
            extensionName,
            extensionPath,
            manifest
          )
      },
      window: {
        loadExtensionUrl: (url: string) => ipcRenderer.invoke('window:load-extension-url', url)
      }
    })

    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing preload APIs:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    shell: {
      openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path)
    },
    extension: {
      createConfigPage: (
        extensionId: string,
        extensionName: string,
        extensionPath: string,
        manifest: Record<string, unknown>
      ) =>
        ipcRenderer.invoke(
          'extension:create-config-page',
          extensionId,
          extensionName,
          extensionPath,
          manifest
        )
    },
    window: {
      loadExtensionUrl: (url: string) => ipcRenderer.invoke('window:load-extension-url', url)
    }
  }
  // @ts-ignore (define in dts)
  window.api = api
  ipcRenderer.invoke('crash:simulate')
}
