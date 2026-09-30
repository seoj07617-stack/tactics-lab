# ============================================================
#  知行金融学院 · 本地/局域网预览服务器（零依赖，无需安装任何环境）
#  用法：右键「使用 PowerShell 运行」
#  本机访问：  http://localhost:8787
#  手机/平板： 连接同一 WiFi，访问窗口里显示的「局域网地址」
#  首次运行如弹出 Windows 防火墙提示，请点「允许访问」（勾选专用网络）
# ============================================================
$ErrorActionPreference = "SilentlyContinue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8787

# 局域网模式：若 8787 被占用自动换 8788
$tryPort = $port
$l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $tryPort)
while ($true) {
  try { $l.Start(); $port = $tryPort; break }
  catch { $tryPort++; $l = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $tryPort) }
}

# 取本机局域网 IPv4
$lanIp = ""
Get-NetIPAddress -AddressFamily IPv4 | ForEach-Object {
  if ($_.IPAddress -match '^192\.168\.|^10\.|^172\.(1[6-9]|2\d|3[01])\.') { $lanIp = $_.IPAddress }
}
$types = @{
  ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".js"="application/javascript; charset=utf-8"
  ".json"="application/json; charset=utf-8"; ".svg"="image/svg+xml"; ".png"="image/png"; ".jpg"="image/jpeg"
  ".ico"="image/x-icon"; ".md"="text/plain; charset=utf-8"; ".woff2"="font/woff2"; ".map"="application/json"
  ".webmanifest"="application/manifest+json"
}

Write-Host ""
Write-Host "  TacticLab" -ForegroundColor Yellow
Write-Host "  ---------------------------------------" -ForegroundColor DarkGray
Write-Host "  本机访问：  http://localhost:$port" -ForegroundColor Green
if ($lanIp) { Write-Host ("  局域网访问（手机/平板连同一 WiFi）：") -ForegroundColor Green
  Write-Host ("  http://" + $lanIp + ":" + $port) -ForegroundColor Green }
Write-Host "  ---------------------------------------" -ForegroundColor DarkGray
Write-Host "  停止服务：关闭本窗口" -ForegroundColor DarkGray
Write-Host "  提示：首次运行若防火墙弹窗，请点「允许访问」" -ForegroundColor DarkYellow
Write-Host ""
try { Start-Process ("http://localhost:" + $port) } catch {}

$enc = [Text.Encoding]::UTF8
$diag = Join-Path $root ".serve.log"
function Log($m) { [IO.File]::AppendAllText($diag, (Get-Date -Format "HH:mm:ss.fff") + " " + $m + "`r`n") }
Log "loop start"
while ($true) {
  $body = $null
  try {
    $client = $l.AcceptTcpClient()
    $stream = $client.GetStream()
    # 轮询等待请求数据（最多 4 秒），防止浏览器预连接（只连不发）卡死循环
    $buf = New-Object byte[] 8192
    $total = 0
    $deadline = [DateTime]::UtcNow.AddSeconds(4)
    while ($total -eq 0 -and [DateTime]::UtcNow -lt $deadline) {
      if ($stream.DataAvailable) { $total = $stream.Read($buf, 0, $buf.Length) }
      else { Start-Sleep -Milliseconds 20 }
    }
    if ($total -gt 0) {
      $req = $enc.GetString($buf, 0, $total)
      $line = ($req -split "`r`n")[0]
      $path = "/"
      if ($line -match '^\w+\s+(\S+)') { $path = [string]$Matches[1] }
      $path = $path.Split('?')[0]
      # 手工百分号解码（PowerShell 5.1 的 [Uri]::UnescapeDataString 在部分环境重载解析失败）
      $path = [Regex]::Replace($path, '%([0-9A-Fa-f]{2})', { param($m) [char][Convert]::ToInt32($m.Groups[1].Value, 16) })
      if ($path -eq "/") { $path = "/index.html" }
      $file = Join-Path $root ($path -replace "/", "\")
      $full = [IO.Path]::GetFullPath($file)
      if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        $body = $enc.GetBytes("403 Forbidden")
        $head = $enc.GetBytes("HTTP/1.1 403 Forbidden`r`nContent-Type: text/plain`r`nConnection: close`r`nContent-Length: " + $body.Length + "`r`n`r`n")
      }
      elseif (Test-Path $full -PathType Leaf) {
        $ext = [IO.Path]::GetExtension($full).ToLower()
        $bytes = [IO.File]::ReadAllBytes($full)
        $ct = "application/octet-stream"
        if ($types.ContainsKey($ext)) { $ct = $types[$ext] }
        $head = $enc.GetBytes("HTTP/1.1 200 OK`r`nContent-Type: " + $ct + "`r`nCache-Control: no-cache`r`nConnection: close`r`nContent-Length: " + $bytes.Length + "`r`n`r`n")
        $stream.Write($head, 0, $head.Length)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush(); $client.Close(); continue
      }
      else {
        $msg = "404 Not Found: " + $path
        $body = $enc.GetBytes($msg)
        $head = $enc.GetBytes("HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nConnection: close`r`nContent-Length: " + $body.Length + "`r`n`r`n")
      }
      $stream.Write($head, 0, $head.Length)
      if ($body) { $stream.Write($body, 0, $body.Length) }
      $stream.Flush()
    }
    $client.Close()
  } catch { Log ("EXC " + $_.Exception.Message); Start-Sleep -Milliseconds 30 }
}


