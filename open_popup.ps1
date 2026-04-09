# BUGIL 팝업 위젯 실행 스크립트

# popup.html 경로 → file:// URL 변환 (한글 경로 인코딩 처리)
$popupPath = Join-Path $PSScriptRoot "popup.html"
$uri = [System.Uri]::new($popupPath)
$url = $uri.AbsoluteUri   # file:///C:/... 형식으로 자동 변환

# 화면 해상도에 맞춰 오른쪽 아래 위치 계산
Add-Type -AssemblyName System.Windows.Forms
$screen = [System.Windows.Forms.Screen]::PrimaryScreen
$winW = 350; $winH = 430
$posX = $screen.Bounds.Width  - $winW - 20
$posY = $screen.Bounds.Height - $winH - 60

# 브라우저 경로 후보
$candidates = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ([Environment]::GetFolderPath("LocalApplicationData") + "\Google\Chrome\Application\chrome.exe"),
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ([Environment]::GetFolderPath("ProgramFiles") + "\Microsoft\Edge\Application\msedge.exe")
)

$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($browser) {
    $launchArgs = "--app=`"$url`" --window-size=$winW,$winH --window-position=$posX,$posY --no-first-run"
    Start-Process -FilePath $browser -ArgumentList $launchArgs
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Chrome 또는 Edge를 찾을 수 없습니다.`n설치 후 다시 시도해주세요.",
        "BUGIL 위젯",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
}
