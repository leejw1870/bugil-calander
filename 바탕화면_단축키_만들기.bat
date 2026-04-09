@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -Command ^
  "$batPath  = '%~dp0팝업열기.bat'; " ^
  "$lnkPath  = [Environment]::GetFolderPath('Desktop') + '\BUGIL 위젯.lnk'; " ^
  "$shell    = New-Object -ComObject WScript.Shell; " ^
  "$shortcut = $shell.CreateShortcut($lnkPath); " ^
  "$shortcut.TargetPath   = $batPath; " ^
  "$shortcut.WorkingDirectory = '%~dp0'; " ^
  "$shortcut.WindowStyle  = 7; " ^
  "$shortcut.IconLocation = '%SystemRoot%\System32\shell32.dll,13'; " ^
  "$shortcut.Description  = 'BUGIL 위젯 열기'; " ^
  "$shortcut.Save(); " ^
  "Add-Type -AssemblyName System.Windows.Forms; " ^
  "[System.Windows.Forms.MessageBox]::Show('바탕화면에 BUGIL 위젯 단축키가 생성됐습니다!', 'BUGIL 위젯', 'OK', 'Information')"
