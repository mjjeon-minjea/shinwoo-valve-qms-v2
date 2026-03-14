Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "QMS 서버 접속 상태"
$form.Size = New-Object System.Drawing.Size(430, 260)
$form.FormBorderStyle = 'FixedToolWindow'
$form.StartPosition = "Manual"

$workingArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$form.Location = New-Object System.Drawing.Point($workingArea.Right - 450, $workingArea.Bottom - 280)
$form.TopMost = $true
$form.MaximizeBox = $false
$form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(35, 39, 46)
$form.ForeColor = [System.Drawing.Color]::FromArgb(230, 240, 255)

$label = New-Object System.Windows.Forms.Label
$label.Size = New-Object System.Drawing.Size(410, 220)
$label.Location = New-Object System.Drawing.Point(15, 15)
$label.Font = New-Object System.Drawing.Font("Malgun Gothic", 10, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($label)

function Check-Port {
    param([string]$hostName, [int]$port)
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $result = $tcp.BeginConnect($hostName, $port, $null, $null)
        $success = $result.AsyncWaitHandle.WaitOne(300, $false)
        if ($success) {
            $tcp.EndConnect($result)
            $tcp.Close()
            return "켜짐"
        } else {
            $tcp.Close()
            return "꺼짐"
        }
    } catch {
        return "꺼짐"
    }
}

function Get-NetworkInfo {
    try {
        $nic = [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() | 
            Where-Object { $_.OperationalStatus -eq 'Up' -and ($_.NetworkInterfaceType -eq 'Ethernet' -or $_.NetworkInterfaceType -eq 'Wireless80211') } | 
            Select-Object -First 1

        if ($nic) {
            $type = if ($nic.NetworkInterfaceType -eq 'Ethernet') { "랜" } else { "wifi" }
            $props = $nic.GetIPProperties()
            $ipObj = $props.UnicastAddresses | Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' } | Select-Object -First 1
            if ($ipObj) {
                return @{ Type = $type; IP = $ipObj.Address.ToString() }
            }
        }
    } catch {}
    return @{ Type = "알 수 없음"; IP = "127.0.0.1" }
}

function Update-Status {
    $netInfo = Get-NetworkInfo
    $localIp = $netInfo.IP
    $conType = $netInfo.Type

    $local5173 = Check-Port "127.0.0.1" 5173
    $local3001 = Check-Port "127.0.0.1" 3001
    
    $netIpStatus = if ($localIp -ne "127.0.0.1") { "켜짐" } else { "꺼짐" }
    $net5173 = Check-Port $localIp 5173

    $text =  "1. 현재 접속 방식 : ${conType}`n"
    $text += "2. 현재 접속한 ip : ${localIp}`n`n"
    $text += "3. 서버 접속 상태 - 네트워크 IP 주소 (내부망 접속용)`n"
    $text += "  1) ${localIp} - ${netIpStatus}`n"
    $text += "  2) http://${localIp}:5173 - ${net5173}`n`n"
    $text += "4. 서버 접속 상태 - 로컬 개발 서버 주소 (현재 PC 접속용)`n"
    $text += "  1) http://localhost:5173 - ${local5173}`n"
    $text += "  2) http://localhost:3001 - ${local3001}`n"

    $label.Text = $text
}

Update-Status

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 3000
$timer.Add_Tick({ Update-Status })
$timer.Start()

[void]$form.ShowDialog()
