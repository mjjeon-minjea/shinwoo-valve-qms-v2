# scripts/qms_status.ps1
# QMS System Status Bar - Premium Revamp (Clean Version)
# Author: Antigravity AI

function Draw-ProgressBar($percent, $color) {
    try {
        $width = 15
        $filled = [math]::Floor($percent / (100 / $width))
        if ($filled -lt 0) { $filled = 0 }
        if ($filled -gt $width) { $filled = $width }
        $empty = $width - $filled
        # 유니코드 에러 방지를 위해 가독성 좋은 배합 사용
        $bar = ("#" * $filled) + ("-" * $empty)
        return "[$bar]"
    } catch { return "[---------------]" }
}

function Show-QMSStatus {
    $ESC = [char]27
    $Reset = "$ESC[0m"
    $Bold = "$ESC[1m"
    
    # ANSI Color Palette (Premium 24-bit TrueColor)
    $Cyan = "$ESC[38;2;6;182;212m"
    $Green = "$ESC[38;2;34;197;94m"
    $Yellow = "$ESC[38;2;234;179;8m"
    $Red = "$ESC[38;2;239;68;68m"
    $Magenta = "$ESC[38;2;217;70;239m"
    $Blue = "$ESC[38;2;59;130;246m"
    $Gray = "$ESC[38;2;107;114;128m"

    # 설정 파일 경로 (절대 경로 강제)
    $configPath = "c:\Users\mjjeon\Desktop\QMS 프로젝트\shinwoo-valve-qms\scripts\qms_config.json"
    if (!(Test-Path $configPath)) { return }

    try {
        $configRaw = Get-Content -LiteralPath $configPath
        $config = $configRaw -join "" | ConvertFrom-Json
        
        # 1. 컨텍스트 기반 색상 로직
        $percent = $config.usage_percent
        $contextColor = $Green
        if ($percent -ge 75) { $contextColor = $Red }
        elseif ($percent -ge 50) { $contextColor = $Yellow }

        # 2. Git 브랜치 확인
        $branch = "offline"
        if (Test-Path ".git") {
            try { $branch = (git rev-parse --abbrev-ref HEAD 2>$null) } catch {}
        }

        # UI 구성 요소 정의
        $sep = " $Gray|$Reset "
        $barUI = Draw-ProgressBar $percent $contextColor
        
        # 항목 빌드 (순서: Model -> Bar -> % -> Tokens -> Branch -> Project)
        $part1 = "$Bold$Cyan$($config.model_name)$Reset"
        $part2 = "$contextColor$barUI$Reset"
        $part3 = "$contextColor$($percent)%$Reset"
        $part4 = "$Magenta$($config.tokens) Tokens$Reset"
        $part5 = "$Green$branch$Reset"
        $part6 = "$Blue$($config.project_name)$Reset"

        # 최종 출력
        Write-Host ""
        Write-Host " $part1$sep$part2 $part3$sep$part4$sep$part5$sep$part6 "
        Write-Host "$Gray--------------------------------------------------------------------------------$Reset"
        Write-Host ""
    } catch {
        # 에러 발생 시 디버깅 메시지 숨김
    }
}

# 실행
Show-QMSStatus
