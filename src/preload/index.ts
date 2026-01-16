import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { api } from './api'

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
    console.error(error)
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
}
