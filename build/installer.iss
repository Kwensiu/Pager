; Inno Setup 安装脚本
; 用于 Pager 应用程序的 Windows 安装程序

#define MyAppName GetEnv('APP_NAME')
#define MyAppVersion GetEnv('APP_VERSION')
#define MyAppPublisher "Kwensiu"
#define MyAppURL "https://github.com/Kwensiu/Pager"
#define MyAppExeName "Pager.exe"

[Setup]
; 应用程序基本信息
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
AppCopyright=Copyright © 2026 {#MyAppPublisher}

; 安装程序设置
DefaultDirName={commonpf}\{#MyAppName}
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
OutputDir=dist
OutputBaseFilename={#MyAppName}-{#MyAppVersion}-setup
SetupIconFile=icon.ico
Compression=lzma2
SolidCompression=yes
InternalCompressLevel=max

; 权限和兼容性
PrivilegesRequired=admin
MinVersion=6.1sp1

; 安装选项
DisableStartupPrompt=no
DisableDirPage=no
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableReadyMemo=yes
DisableFinishedPage=no
AlwaysShowComponentsList=false
ShowComponentSizes=no
ShowTasksTreeLines=false
ShowLanguageDialog=yes

; 卸载设置
UninstallFilesDir={app}
UninstallDisplayName={#MyAppName}
UninstallDisplayIcon={app}\{#MyAppExeName}
CreateUninstallRegKey=yes
UsePreviousAppDir=yes
UsePreviousGroup=yes
UsePreviousTasks=yes
UsePreviousLanguage=yes

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Messages]
english.BeveledLabel=English

[CustomMessages]
english.LaunchProgram=Launch {#MyAppName}
english.CreateDesktopShortcut=Create desktop shortcut
english.AssociateFiles=Associate file types
english.CreateQuickLaunchIcon=Create quick launch icon
english.AdditionalIcons=Additional icons
english.AutoStartProgramGroup=Auto-start program group

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopShortcut}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "launchprogram"; Description: "{cm:LaunchProgram}"; GroupDescription: "{cm:AutoStartProgramGroup}"; Flags: unchecked

[Files]
; 主应用程序文件
Source: "dist\win-unpacked\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

; 可选：许可证文件
; Source: "LICENSE.txt"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; 开始菜单快捷方式
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Comment: "{#MyAppName} - 多网站管理工具"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"

; 桌面快捷方式
Name: "{commondesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon; Comment: "{#MyAppName} - 多网站管理工具"

; 快速启动栏（已过时，现代 Windows 不再使用）
; Name: "{userappdata}\Microsoft\Internet Explorer\Quick Launch\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: quicklaunchicon

[Run]
; 安装完成后运行程序
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram}"; Tasks: launchprogram; Flags: shellexec postinstall skipifsilent

[Registry]
; 注册应用程序信息
Root: HKLM; Subkey: "SOFTWARE\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "InstallPath"; ValueData: "{app}"
Root: HKLM; Subkey: "SOFTWARE\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "Version"; ValueData: "{#MyAppVersion}"
Root: HKLM; Subkey: "SOFTWARE\{#MyAppPublisher}\{#MyAppName}"; ValueType: string; ValueName: "Publisher"; ValueData: "{#MyAppPublisher}"

; 添加到"程序和功能"中的显示信息
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "DisplayName"; ValueData: "{#MyAppName}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "DisplayVersion"; ValueData: "{#MyAppVersion}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "Publisher"; ValueData: "{#MyAppPublisher}"
Root: HKLM; Subkey: "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}"; ValueType: string; ValueName: "DisplayIcon"; ValueData: "{app}\{#MyAppExeName}"

[UninstallDelete]
; 卸载时删除所有文件
Type: filesandordirs; Name: "{app}"

[Code]
// 声明Windows API函数
function FindWindow(lpClassName: string; lpWindowName: string): HWND;
external 'FindWindowA@user32.dll stdcall';

function GetWindowText(hWnd: HWND; lpString: String; nMaxCount: Integer): Integer;
external 'GetWindowTextA@user32.dll stdcall';

// 检测应用是否正在运行（严格检测方法）
function IsAppRunning(): Boolean;
var
  WindowHandle: HWND;
  WindowText: String;
begin
  Result := False;
  
  // 方法1：检测具有正确标题的窗口
  // 这是最可靠的方法，只检测具有正确窗口标题的Pager应用
  WindowHandle := FindWindow('', 'Pager');
  if WindowHandle <> 0 then
  begin
    // 额外验证：确保窗口确实有内容
    SetLength(WindowText, 256);
    GetWindowText(WindowHandle, WindowText, 255);
    if WindowText = 'Pager' then
      Result := True;
  end
  else
  begin
    // 方法2：检测可能的完整标题
    WindowHandle := FindWindow('', 'Pager - 多网站管理工具');
    if WindowHandle <> 0 then
    begin
      SetLength(WindowText, 256);
      GetWindowText(WindowHandle, WindowText, 255);
      if WindowText = 'Pager - 多网站管理工具' then
        Result := True;
    end;
  end;
  
  // 注意：我们严格避免检测Chrome_WidgetWin_1类，因为可能有其他Electron应用
  // 只检测具有正确窗口标题的Pager应用
end;

// 强制关闭应用（多种方法）
function CloseApp(): Boolean;
var
  ResultCode: Integer;
begin
  Result := True;
  
  // 使用taskkill优雅关闭
  Exec('taskkill', '/IM Pager.exe', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
  Sleep(2000);
  
  // 强制关闭
  if IsAppRunning() then
  begin
    Exec('taskkill', '/F /IM Pager.exe /T', '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    Sleep(1000);
  end;
end;

// 检查是否已有安装版本（支持NSIS和Inno Setup）
function IsUpgrade(): Boolean;
var
  S: String;
begin
  Result := False;
  // 检查NSIS安装版本
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Pager_is1', 'UninstallString', S) then
    Result := True;
  // 检查Inno Setup安装版本
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}', 'UninstallString', S) then
    Result := True;
end;

// 卸载旧版本（支持NSIS和Inno Setup）
function UninstallOldVersion(): Integer;
var
  S: String;
  ResultCode: Integer;
begin
  Result := 0;
  
  // 尝试卸载NSIS版本
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Pager_is1', 'UninstallString', S) then
  begin
    S := RemoveQuotes(S);
    if Exec(S, '/SILENT', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := 0
    else
      Result := ResultCode;
  end;
  
  // 尝试卸载Inno Setup版本
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}', 'UninstallString', S) then
  begin
    S := RemoveQuotes(S);
    if Exec(S, '/SILENT', '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then
      Result := 0
    else
      Result := ResultCode;
  end;
end;

// 获取旧版本安装路径
function GetOldInstallPath(): String;
var
  S: String;
begin
  Result := '';
  
  // 尝试从NSIS注册表获取路径
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Pager_is1', 'InstallLocation', S) then
    Result := S;
    
  // 尝试从Inno Setup注册表获取路径
  if RegQueryStringValue(HKLM, 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\{#MyAppName}', 'InstallLocation', S) then
    Result := S;
end;

// 安装前检查和准备
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  ErrorCode: Integer;
  OldPath: String;
begin
  Result := '';
  
  // 如果是升级，先卸载旧版本
  if IsUpgrade() then
  begin
    // 保存旧安装路径
    OldPath := GetOldInstallPath();
    if OldPath <> '' then
    begin
      // 设置默认安装路径为旧路径
      WizardForm.DirEdit.Text := OldPath;
    end;
    
    ErrorCode := UninstallOldVersion();
    if ErrorCode <> 0 then
    begin
      Result := '卸载旧版本时出错，错误代码: ' + IntToStr(ErrorCode);
    end;
  end;
end;

// 自定义安装向导页面
function ShouldSkipPage(PageID: Integer): Boolean;
begin
  // 跳过某些页面以简化安装流程
  case PageID of
    wpSelectComponents: Result := True;  // 跳过组件选择页面
    wpSelectTasks: Result := False;     // 显示任务选择页面
    wpReady: Result := True;            // 跳过准备安装页面
  else
    Result := False;
  end;
end;

// 安装前的检查 - 在安装向导显示前执行
function InitializeSetup(): Boolean;
var
  Version: TWindowsVersion;
begin
  Result := True;
  
  // 检测应用是否运行
  if IsAppRunning() then
  begin
    // 显示提示对话框
    if MsgBox('检测到 Pager 正在运行。' + #13#10 + #13#10 + 
              '请先关闭 Pager，然后点击"重试"继续安装。' + #13#10 + 
              '或者点击"取消"强制关闭应用并继续。', 
              mbConfirmation, MB_RETRYCANCEL or MB_DEFBUTTON1) = IDRETRY then
    begin
      // 用户选择重试，等待用户手动关闭
      while IsAppRunning() do
      begin
        if MsgBox('Pager 仍在运行中。' + #13#10 + #13#10 + 
                    '请关闭应用后点击"确定"继续，或点击"取消"退出安装。', 
                    mbConfirmation, MB_OKCANCEL) = IDCANCEL then
        begin
          Result := False;
          Exit;
        end;
        Sleep(1000); // 等待1秒后重新检查
      end;
    end
    else
    begin
      // 用户选择强制关闭应用
      if MsgBox('确定要强制关闭 Pager 并继续安装吗？' + #13#10 + #13#10 + 
                '这可能会导致未保存的数据丢失。', 
                mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
      begin
        CloseApp();
        
        // 再次检查是否成功关闭
        if IsAppRunning() then
        begin
          MsgBox('无法关闭 Pager，请手动结束进程后重试。', mbError, MB_OK);
          Result := False;
        end;
      end
      else
      begin
        Result := False;
      end;
    end;
  end;
  
  // 检查Windows版本
  if Result then
  begin
    GetWindowsVersionEx(Version);
    if (Version.Major < 6) or ((Version.Major = 6) and (Version.Minor < 1)) then
    begin
      MsgBox('此应用程序需要 Windows 7 或更高版本。', mbError, MB_OK);
      Result := False;
    end;
  end;
end;

// 安装完成后的操作
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    // 可以在这里添加安装后的自定义操作
    // 例如：创建配置文件、注册服务等
  end;
end;

// 安装进度显示
procedure CurPageChanged(CurPageID: Integer);
begin
  case CurPageID of
    wpInstalling:
      begin
        // 安装进行中时的操作
        WizardForm.StatusLabel.Caption := '正在安装 ' + ExpandConstant('{#MyAppName}') + '...';
      end;
    wpFinished:
      begin
        // 安装完成时的操作
        WizardForm.FinishedLabel.Caption := ExpandConstant('{#MyAppName}') + ' 已成功安装！';
      end;
  end;
end;

// 卸载时询问是否保留数据
function UninstallNeedRestart(): Boolean;
begin
  if MsgBox('是否保留应用数据和配置文件？' + #13#10 + #13#10 + '选择"是"保留数据，选择"否"完全删除。', 
             mbConfirmation, MB_YESNO or MB_DEFBUTTON2) = IDYES then
  begin
    // 用户选择保留数据
    Result := False;
  end
  else
  begin
    // 用户选择删除数据，删除应用数据目录
    DelTree(ExpandConstant('{app}\..\..\..\..\Roaming\com.pager.ks'), True, True, True);
    DelTree(ExpandConstant('{app}\..\..\..\..\Local\com.pager.ks'), True, True, True);
    Result := False;
  end;
end;

// 卸载前的检查
function InitializeUninstall(): Boolean;
begin
  Result := True;
end;
