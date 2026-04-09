Option Explicit

Dim fso, wsh
Set fso = CreateObject("Scripting.FileSystemObject")
Set wsh = CreateObject("WScript.Shell")

' popup.html 경로 → file:// URL
Dim scriptDir, popupPath, url
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
popupPath = scriptDir & "\popup.html"
url = "file:///" & Replace(popupPath, "\", "/")

' 화면 해상도 자동 감지 (오른쪽 아래 위치 계산용)
Dim screenW, screenH
screenW = 1920 : screenH = 1080
On Error Resume Next
Dim wmi, items, itm
Set wmi = GetObject("winmgmts:\\.\root\cimv2")
Set items = wmi.ExecQuery("SELECT CurrentHorizontalResolution, CurrentVerticalResolution FROM Win32_VideoController")
For Each itm In items
    If itm.CurrentHorizontalResolution > 0 Then
        screenW = itm.CurrentHorizontalResolution
        screenH = itm.CurrentVerticalResolution
        Exit For
    End If
Next
On Error GoTo 0

' 창 크기 및 위치 (오른쪽 아래)
Dim winW, winH, posX, posY
winW = 350 : winH = 430
posX = screenW - winW - 20
posY = screenH - winH - 60

' 브라우저 찾기 (Chrome 우선, Edge 차선)
Dim paths(4), browser, i
paths(0) = "C:\Program Files\Google\Chrome\Application\chrome.exe"
paths(1) = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
paths(2) = wsh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\Application\chrome.exe"
paths(3) = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
paths(4) = wsh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Microsoft\Edge\Application\msedge.exe"

browser = ""
For i = 0 To 4
    If fso.FileExists(paths(i)) Then
        browser = paths(i)
        Exit For
    End If
Next

If browser = "" Then
    MsgBox "Chrome 또는 Edge를 찾을 수 없습니다!" & Chr(10) & "설치 후 다시 시도해주세요.", _
           vbExclamation + vbOKOnly, "BUGIL 위젯"
Else
    Dim cmd
    cmd = """" & browser & """" & _
          " --app=""" & url & """" & _
          " --window-size=" & winW & "," & winH & _
          " --window-position=" & posX & "," & posY & _
          " --no-first-run"
    wsh.Run cmd, 1, False
End If
