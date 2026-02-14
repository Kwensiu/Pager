import React, { useState } from 'react'
import { marked } from 'marked'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { Button } from './button'
import { Loader2, Download, CheckCircle, XCircle, ExternalLink } from 'lucide-react'

interface UpdateDialogProps {
  open: boolean
  onClose: () => void
  currentVersion: string
  latestVersion?: string
  available: boolean
  releaseNotes?: string
  error?: string
  isChecking?: boolean
}

export const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onClose,
  currentVersion,
  latestVersion,
  available,
  releaseNotes,
  error,
  isChecking = false
}) => {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const processReleaseNotes = (notes: string): string => {
    const html = marked.parse(notes, {
      breaks: true,
      gfm: true
    }) as string
    return html
      .replace(/<blockquote/g, '<div class="border-l-2 border-muted-foreground pl-4"')
      .replace(/<\/blockquote>/g, '</div>')
  }

  const handleDownloadUpdate = async (): Promise<void> => {
    if (!window.api?.enhanced?.versionChecker) {
      setDownloadError('更新功能不可用')
      return
    }

    setIsDownloading(true)
    setDownloadError(null)
    setDownloadSuccess(false)

    try {
      // 调用下载 API
      const result = await window.api.enhanced.versionChecker.downloadUpdate()

      if (result.success) {
        setDownloadSuccess(true)

        // 3秒后自动关闭应用并安装更新
        setTimeout(() => {
          if (window.api?.enhanced?.windowManager?.exitApp) {
            window.api.enhanced.windowManager.exitApp()
          }
        }, 3000)
      } else {
        // 如果是开发环境的错误，提供 GitHub 链接
        if (result.error?.includes('开发环境')) {
          setDownloadError(result.error)
        } else {
          setDownloadError(result.error || '下载失败')
        }
      }
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : '未知错误')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleOpenGitHub = async (): Promise<void> => {
    try {
      await window.api.shell.openExternal('https://github.com/Kwensiu/Pager/releases/latest')
    } catch (err) {
      console.error('Failed to open external link:', err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isChecking ? '检查更新中...' : available ? '发现新版本' : '已是最新版本'}
          </DialogTitle>
          <DialogDescription>
            {isChecking
              ? '正在检查是否有可用更新...'
              : available
                ? `新版本 ${latestVersion} 已发布`
                : `您当前使用的是最新版本 ${currentVersion}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {isChecking && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
              <p className="text-sm text-destructive">检查更新失败: {error}</p>
            </div>
          )}

          {downloadError && (
            <div className="bg-amber-600/10 border border-amber-600/20 rounded-md p-3">
              <p className="text-sm text-amber-600 flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                {downloadError}
              </p>

            </div>
          )}

          {downloadSuccess && (
            <div className="bg-green-600/10 border border-green-600/20 rounded-md p-3">
              <p className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                更新下载完成！应用将在 3 秒后关闭并安装更新。
              </p>
            </div>
          )}

          {!isChecking && !error && (
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">当前版本:</span>
                  <p className="font-medium">{currentVersion}</p>
                </div>
                {latestVersion && (
                  <div>
                    <span className="text-muted-foreground">最新版本:</span>
                    <p className={`font-medium ${available ? 'text-green-600' : ''}`}>
                      {latestVersion}
                    </p>
                  </div>
                )}
              </div>

              {available && releaseNotes && (
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <h4 className="text-sm font-medium mb-2">更新内容:</h4>
                  <div className="bg-muted/50 rounded-md p-3 flex-1 overflow-y-auto max-h-[50vh]">
                    <div
                      className="text-xs prose prose-xs max-w-none prose-headings:mb-2 prose-p:mb-2 prose-li:my-1 prose-ul:my-2 prose-ol:my-2 prose-hr:my-3 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs prose-pre:bg-muted prose-pre:p-2 prose-pre:rounded prose-pre:overflow-x-auto"
                      dangerouslySetInnerHTML={{
                        __html: processReleaseNotes(releaseNotes)
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              {isChecking ? '取消' : '关闭'}
            </Button>
            {available && !isChecking && !downloadSuccess && (
              <>
                <Button
                  variant="outline"
                  onClick={handleOpenGitHub}
                  disabled={isDownloading}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  前往 GitHub
                </Button>
                <Button
                  onClick={handleDownloadUpdate}
                  disabled={isDownloading}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      下载中...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      下载更新
                    </>
                  )}
                </Button>
              </>
            )}
            {downloadSuccess && (
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                <CheckCircle className="h-4 w-4 mr-2" />
                下载完成，即将安装
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
