Dim wsh, fso
Set wsh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 크롬 경로 찾기 (TargetPath는 반드시 ASCII 경로여야 함)
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
    ' URL 인코딩으로 한글 경로 문제 완전 우회
    Dim url
    url = "file:///C:/Users/User/Downloads/260326_%EB%B6%81%EC%9D%BC%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90/StudyPlanner/popup.html"

    Dim args
    args = "--app=" & url & " --window-size=350,430 --window-position=1550,580 --no-first-run"

    ' 바탕화면에 단축키 생성
    ' TargetPath = Chrome 경로 (순수 ASCII) -> 오류 없음
    ' Arguments  = URL 인코딩된 주소 (순수 ASCII) -> 오류 없음
    Dim lnkPath
    lnkPath = wsh.SpecialFolders("Desktop") & "\BUGIL Widget.lnk"

    Dim sc
    Set sc = wsh.CreateShortcut(lnkPath)
    sc.TargetPath  = browser
    sc.Arguments   = args
    sc.Description = "BUGIL Widget"
    sc.Save

    MsgBox "바탕화면에 'BUGIL 위젯' 단축키가 생성됐습니다!" & Chr(10) & Chr(10) & _
           "이제 바탕화면 아이콘으로 바로 열 수 있습니다.", vbInformation, "BUGIL 위젯"
End If
