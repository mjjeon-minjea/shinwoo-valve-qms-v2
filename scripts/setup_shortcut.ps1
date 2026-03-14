$desktopPath = [Environment]::GetFolderPath('Desktop')
$shortcutPath = Join-Path $desktopPath "QMS_Server_Widget.lnk"

# 동적으로 현재 디렉토리 기반 경로 생성
$vbsPath = Join-Path $PSScriptRoot "QMS_Widget_Launcher.vbs"
$workDir = $PSScriptRoot

$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$vbsPath`""
$shortcut.WorkingDirectory = $workDir
$shortcut.IconLocation = "powershell.exe,0"
$shortcut.Save()

Write-Host "Shortcut created successfully at $shortcutPath"

# 옛날 파일들 청소
$oldFiles = @("QMS 서버 위젯.lnk", "QMS_서버위젯_실행.bat", "QMS_서버위젯.ps1", "qms_widget_ui.ps1", "QMS_위젯_실행.vbs", "QMS_서버위젯_실행")
foreach ($f in $oldFiles) {
    Remove-Item (Join-Path $desktopPath $f) -ErrorAction SilentlyContinue
}
