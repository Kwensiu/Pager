; 自定义卸载脚本 - 在卸载开始时询问是否保留应用数据
; 默认行为是删除数据，用户需要主动选择保留

!macro customUnInstall
  ${ifNot} ${isUpdated}
    ; 在卸载开始时询问用户是否保留数据
    ${If} $LANGUAGE == 2052 ; 简体中文
      MessageBox MB_YESNO|MB_ICONQUESTION "是否保留应用数据和配置文件？$\r$\n$\r$\n选择 '是' 保留数据，选择 '否' 完全删除。" IDYES keep_data
    ${ElseIf} $LANGUAGE == 1028 ; 繁体中文
      MessageBox MB_YESNO|MB_ICONQUESTION "是否保留應用數據和配置文件？$\r$\n$\r$\n選擇 '是' 保留數據，選擇 '否' 完全刪除。" IDYES keep_data
    ${Else} ; 英文等其他语言
      MessageBox MB_YESNO|MB_ICONQUESTION "Keep application data and configuration files?$\r$\n$\r$\nClick 'Yes' to keep data, 'No' to delete completely." IDYES keep_data
    ${EndIf}
    
    ; 用户选择删除，执行完全清理（不显示成功提示）
    ; 删除漫游应用数据（主要配置文件）
    RMDir /r "$APPDATA\com.pager.ks"
    
    ; 删除本地应用数据（缓存、临时文件等）
    RMDir /r "$LOCALAPPDATA\com.pager.ks"
    
    goto end
    
    keep_data:
    ; 用户选择保留数据，不显示提示
    
    end:
  ${endIf}
!macroend
