/**
 * 通知工具函数
 */

export interface NotificationConfig {
  title: string
  body: string
}

/**
 * 显示成功通知
 */
export async function showSuccessNotification(config: NotificationConfig): Promise<void> {
  if (window.electron?.ipcRenderer) {
    try {
      await window.electron.ipcRenderer.invoke('window-manager:show-notification', config)
    } catch (error) {
      console.error('显示成功通知失败:', error)
    }
  }
}

/**
 * 显示错误通知
 */
export async function showErrorNotification(title: string, error: unknown): Promise<void> {
  const config: NotificationConfig = {
    title,
    body: error instanceof Error ? error.message : '未知错误'
  }

  if (window.electron?.ipcRenderer) {
    try {
      await window.electron.ipcRenderer.invoke('window-manager:show-notification', config)
    } catch (notificationError) {
      console.error('显示错误通知失败:', notificationError)
    }
  }
}
