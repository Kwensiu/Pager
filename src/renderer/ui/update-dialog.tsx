import React from 'react'
import { marked } from 'marked'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './dialog'
import { Button } from './button'

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
  const processReleaseNotes = (notes: string): string => {
    const html = marked.parse(notes, {
      breaks: true,
      gfm: true
    }) as string
    return html
      .replace(/<blockquote/g, '<div class="border-l-2 border-muted-foreground pl-4"')
      .replace(/<\/blockquote>/g, '</div>')
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
            {available && !isChecking && (
              <Button
                onClick={() => {
                  // 这里可以添加下载更新的逻辑
                  window.open('https://github.com/Kwensiu/Pager/releases/latest', '_blank')
                }}
              >
                下载更新
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
