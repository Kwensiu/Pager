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

REM 检查构建目录 - 兼容本地和CI环境
echo Current directory: %CD%
echo Checking for build directory...

if exist "%BUILD_DIR%\win-unpacked" (
    echo Found build directory at: %BUILD_DIR%\win-unpacked
    set CHECK_PATH=%BUILD_DIR%\win-unpacked
    set ARTIFACT_PATH=%BUILD_DIR%\*.exe
    set INNO_SCRIPT=installer.iss
    set PKG_JSON_PATH=..\package.json
) else if exist "build\%BUILD_DIR%\win-unpacked" (
    echo Found build directory at: build\%BUILD_DIR%\win-unpacked
    echo Switching to build directory...
    cd build
    set CHECK_PATH=%BUILD_DIR%\win-unpacked
    set ARTIFACT_PATH=%BUILD_DIR%\*.exe
    set INNO_SCRIPT=installer.iss
    set PKG_JSON_PATH=..\package.json
) else (
    echo Error: Application not built. Please run 'yarn build:unpack' first.
    echo Expected paths:
    echo   - build\%BUILD_DIR%\win-unpacked
    echo   - %BUILD_DIR%\win-unpacked
    echo Current directory contents:
    dir /b
    pause
    exit /b 1
)

REM 检查 Inno 脚本
if exist "%INNO_SCRIPT%" (
    echo Found Inno script: %INNO_SCRIPT%
) else (
    echo Error: Inno Setup script not found: %INNO_SCRIPT%
    pause
    exit /b 1
)

REM 创建输出目录
if not exist "%OUTPUT_DIR%" mkdir "%OUTPUT_DIR%"

REM 更新版本号（从package.json读取或环境变量）
echo Reading version...
if defined APP_VERSION_ENV (
    set APP_VERSION=%APP_VERSION_ENV%
    echo Using version from environment: %APP_VERSION%
) else (
    echo Reading version from %PKG_JSON_PATH%...
    REM 使用Node.js解析JSON获取版本号
    for /f "delims=" %%i in ('node -e "try { const pkg = require('./%PKG_JSON_PATH%'); console.log(pkg.version); } catch(e) { process.exit(1); }"') do (
        set APP_VERSION=%%i
    )
    if "!APP_VERSION!"=="" (
        echo Error: Failed to extract version from package.json
        pause
        exit /b 1
    )
    echo Extracted version: !APP_VERSION!
)

echo Building %APP_NAME% version %APP_VERSION%...

REM 编译 Inno Setup 安装程序
set APP_NAME=Pager
set APP_VERSION=%APP_VERSION%
set OUTPUT_DIR=%BUILD_DIR%
iscc "%INNO_SCRIPT%" /DAPP_NAME="%APP_NAME%" /DAPP_VERSION="%APP_VERSION%" /DOUTPUT_DIR="%OUTPUT_DIR%"

if %ERRORLEVEL% equ 0 (
    echo ========================================
    echo Build completed successfully!
    echo ========================================
    echo Output: %BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe
    
    REM 显示文件信息
    if exist "%BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe" (
        for %%F in ("%BUILD_DIR%\%APP_NAME%-%APP_VERSION%-setup.exe") do (
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
dir /b "%ARTIFACT_PATH%"

pause
