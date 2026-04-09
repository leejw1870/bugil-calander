Dim wsh, fso
Set wsh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 한글 경로를 URL 인코딩으로 미리 변환 (북일고등학교 = %EB%B6%81%EC%9D%BC%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90)
Dim url
url = "file:///C:/Users/User/Downloads/260326_%EB%B6%81%EC%9D%BC%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90/StudyPlanner/popup.html"

' 화면 해상도 감지
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
On Error Resume Next

' 창 크기 및 위치 (오른쪽 아래)
Dim winW, winH, posX, posY
winW = 350 : winH = 430
posX = screenW - winW - 20
posY = screenH - winH - 60

' 브라우저 찾기
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
    MsgBox "Chrome 또는 Edge를 찾을 수 없습니다!", vbExclamation, "BUGIL 위젯"
Else
    ' 메인 앱과 같은 프로필 사용 (localStorage 공유를 위해)
    Dim userDataDir
    If InStr(LCase(browser), "chrome") > 0 Then
        userDataDir = wsh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Google\Chrome\User Data"
    Else
        userDataDir = wsh.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Microsoft\Edge\User Data"
    End If

    Dim cmd
    cmd = """" & browser & """" & _
          " --app=" & url & _
          " --user-data-dir=""" & userDataDir & """" & _
          " --window-size=" & winW & "," & winH & _
          " --window-position=" & posX & "," & posY & _
          " --no-first-run"
    wsh.Run cmd, 1, False
End If
