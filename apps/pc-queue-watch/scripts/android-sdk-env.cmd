@echo off
REM CollecTools mobile — optional local Android SDK paths (Windows)
REM Install Android Studio first: https://developer.android.com/studio
REM Then run this script in CMD before: npm run android:run

set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
set "ANDROID_SDK_ROOT=%ANDROID_HOME%"
set "PATH=%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\emulator;%PATH%"

where adb >nul 2>&1
if errorlevel 1 (
  echo adb not found. Install Android Studio and the Android SDK Platform-Tools.
  echo Default SDK path: %ANDROID_HOME%
  exit /b 1
)

echo ANDROID_HOME=%ANDROID_HOME%
adb version
