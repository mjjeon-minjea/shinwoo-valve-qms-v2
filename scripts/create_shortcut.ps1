$desktop = [Environment]::GetFolderPath('Desktop')
$path = Join-Path $desktop "QMS 서버 위젯.lnk"
$wshell = New-Object -ComObject WScript.Shell
$shortcut = $wshell.CreateShortcut($path)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\scripts\QMS_Widget_Launcher.vbs`""
$shortcut.WorkingDirectory = "C:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\scripts"
$shortcut.IconLocation = "powershell.exe,0"
$shortcut.Save()

$oldPs1 = Join-Path $desktop "QMS_서버위젯.ps1"
$oldBat = Join-Path $desktop "QMS_서버위젯_실행.bat"

if (Test-Path $oldPs1) { Remove-Item $oldPs1 -Force }
if (Test-Path $oldBat) { Remove-Item $oldBat -Force }
