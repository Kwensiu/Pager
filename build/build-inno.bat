@echo off
setlocal enabledelayedexpansion

echo ========================================
echo Building Pager with Inno Setup
echo ========================================

REM 设置变量
set APP_NAME=Pager
set APP_VERSION=0.0.9
set BUILD_DIR=dist
set INNO_SCRIPT=installer.iss
set OUTPUT_DIR=%BUILD_DIR%

REM 检查 Inno Setup 是否安装
where iscc >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Inno Setup not found. Please install Inno Setup 6.x
    echo Download from: https://jrsoftware.org/isdl.php
    pause
    exit /b 1
)

REM 检查构建目录
if not exist "..\build\%BUILD_DIR%\win-unpacked" (
    echo Error: Application not built. Please run 'yarn build:unpack' first.
    pause
    exit /b 1
)

REM 检查 Inno 脚本
if not exist "%INNO_SCRIPT%" (
    echo Error: Inno Setup script not found: %INNO_SCRIPT%
    pause
    exit /b 1
)

REM 创建输出目录
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM 更新版本号（从package.json读取）
for /f "tokens=3" %%i in ('findstr "version" ..\package.json') do (
    set APP_VERSION=%%i
    set APP_VERSION=!APP_VERSION:"=!
    set APP_VERSION=!APP_VERSION:,=!
)

echo Building %APP_NAME% version %APP_VERSION%...

REM 编译 Inno Setup 安装程序
set APP_NAME=Pager
set APP_VERSION=%APP_VERSION%
set OUTPUT_DIR=..\%BUILD_DIR%
iscc "%INNO_SCRIPT%" /DAPP_NAME="%APP_NAME%" /DAPP_VERSION="%APP_VERSION%" /DOUTPUT_DIR="%OUTPUT_DIR%"

if %ERRORLEVEL% equ 0 (
    echo ========================================
    echo Build completed successfully!
    echo ========================================
    echo Output: ..\%BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe
    
    REM 显示文件信息
    if exist "..\%BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe" (
        for %%F in ("..\%BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe") do (
            echo Size: %%~zF bytes
        )
    )
) else (
    echo ========================================
    echo Build failed!
    echo ========================================
    pause
    exit /b 1
)

echo.
echo Build artifacts:
dir /b "..\build\%BUILD_DIR%\*.exe"

pause
