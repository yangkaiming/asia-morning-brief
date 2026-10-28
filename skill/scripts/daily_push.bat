@echo off
rem 每日 8:06 从 GitHub 固定路径拉取当天早报 HTML，校验后通过 ClawBot iLink API 直发到微信
setlocal
set WORK=C:\Users\13091\CodeBuddy\Claw
set SKILL=%WORK%\.codebuddy\skills\asia-morning-brief\scripts
if not exist "%SKILL%\send_wechat.js" set SKILL=%USERPROFILE%\.codebuddy\skills\asia-morning-brief\scripts
set RAW=https://raw.githubusercontent.com/yangkaiming/asia-morning-brief/main/asia_morning_latest.html
set OUT=%WORK%\outbox\asia_morning_latest.html

echo [%date% %time%] pulling daily brief ...
curl.exe -sL --max-time 60 -o "%OUT%" "%RAW%"
if errorlevel 1 (
  echo PULL_FAILED
  exit /b 1
)

node "%SKILL%\verify.js" "%OUT%"
if errorlevel 1 (
  echo VERIFY_FAILED_SKIP_SEND
  exit /b 2
)

node "%SKILL%\send_wechat.js" sendfile "%OUT%"
if errorlevel 1 (
  echo SEND_FILE_FAILED
  exit /b 3
)

echo [%date% %time%] DAILY_PUSH_OK
