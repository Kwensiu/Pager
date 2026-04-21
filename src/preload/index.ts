import { contextBridge, ipcRenderer } from 'electron'
import { api } from './api'

const ELECTRON_IPC_ON_CHANNELS = new Set([
  'window-manager:always-on-top-changed',
  'window-manager:refresh-page',
  'window-manager:copy-url'
])
const ELECTRON_IPC_SEND_CHANNELS = new Set([
  'window-manager:refresh-page',
  'window-manager:copy-url'
])
const ELECTRON_IPC_INVOKE_CHANNELS = new Set([
  'clear-cache',
  'shell:openPath',
  'shell:openExternal',
  'extension:create-config-page',
  'window:load-extension-url',
  'window:create-extension-options',
  'window:open-extension-in-new-window',
  'window:open-extension-options-in-main',
  'window-manager:get-always-on-top-state',
  'window-manager:toggle-always-on-top',
  'window-manager:show-notification',
  'window-manager:copy-to-clipboard'
])

function isAllowedElectronIpcChannel(allowedChannels: Set<string>, channel: string): boolean {
  return typeof channel === 'string' && allowedChannels.has(channel)
}

function logBlockedElectronIpc(
  method: 'on' | 'once' | 'removeListener' | 'removeAllListeners' | 'send' | 'invoke',
  channel: string
): void {
  console.warn(`[preload] Blocked window.electron.ipcRenderer.${method} on channel: ${channel}`)
}

interface SafeElectronIpcRenderer {
  on: (channel: string, listener: (...args: unknown[]) => void) => void
  once: (channel: string, listener: (...args: unknown[]) => void) => void
  removeListener: (channel: string, listener: (...args: unknown[]) => void) => void
  removeAllListeners: (channel: string) => void
  send: (channel: string, ...args: unknown[]) => void
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
}

function createSafeElectronIpcRenderer(): SafeElectronIpcRenderer {
  return {
    on: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_ON_CHANNELS, channel)) {
        logBlockedElectronIpc('on', channel)
        return
      }
      ipcRenderer.on(channel, listener)
    },
    once: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_ON_CHANNELS, channel)) {
        logBlockedElectronIpc('once', channel)
        return
      }
      ipcRenderer.once(channel, listener)
    },
    removeListener: (channel: string, listener: (...args: unknown[]) => void) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_ON_CHANNELS, channel)) {
        logBlockedElectronIpc('removeListener', channel)
        return
      }
      ipcRenderer.removeListener(channel, listener)
    },
    removeAllListeners: (channel: string) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_ON_CHANNELS, channel)) {
        logBlockedElectronIpc('removeAllListeners', channel)
        return
      }
      ipcRenderer.removeAllListeners(channel)
    },
    send: (channel: string, ...args: unknown[]) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_SEND_CHANNELS, channel)) {
        logBlockedElectronIpc('send', channel)
        return
      }
      ipcRenderer.send(channel, ...args)
    },
    invoke: (channel: string, ...args: unknown[]) => {
      if (!isAllowedElectronIpcChannel(ELECTRON_IPC_INVOKE_CHANNELS, channel)) {
        logBlockedElectronIpc('invoke', channel)
        return Promise.reject(new Error(`Blocked window.electron.ipcRenderer.invoke: ${channel}`))
      }
      return ipcRenderer.invoke(channel, ...args)
    }
  }
}

const safeElectronIpcRenderer = createSafeElectronIpcRenderer()

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
      ipcRenderer: safeElectronIpcRenderer,
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
    ipcRenderer: safeElectronIpcRenderer,
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
