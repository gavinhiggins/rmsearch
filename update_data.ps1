# update_data.ps1 - Fetch latest RoboMaster BBS articles (2020 to present)
# Run with: powershell -ExecutionPolicy Bypass -File update_data.ps1

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host " RoboMaster BBS Article Crawler & Sync   " -ForegroundColor Cyan
Write-Host " Target: https://bbs.robomaster.com/     " -ForegroundColor Cyan
Write-Host " Source: search.scutbot.cn (MeiliSearch) " -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

$t2020 = ([DateTimeOffset](Get-Date -Year 2020 -Month 1 -Day 1)).ToUnixTimeMilliseconds()
$currBefore = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() + 86400000
$allClean = @()
$seenIds = @{}
$batchNum = 0

Write-Host "`nFetching articles in batches of 100..." -ForegroundColor Yellow

while ($currBefore -gt $t2020 -and $batchNum -lt 60) {
    $payload = @{
        q = ""
        filter = "source = `"论坛文章`" AND create_time >= $t2020 AND create_time < $currBefore"
        sort = @("create_time:desc")
        limit = 100
    } | ConvertTo-Json

    [System.IO.File]::WriteAllText("$PSScriptRoot/temp_q.json", $payload, (New-Object System.Text.UTF8Encoding($false)))
    curl.exe -s -X POST https://search.scutbot.cn/api/ms/indexes/rm-search/search -H "Content-Type: application/json" -d "@$PSScriptRoot/temp_q.json" -o "$PSScriptRoot/temp_batch.json"
    
    if (-not (Test-Path "$PSScriptRoot/temp_batch.json")) {
        Write-Host "Failed to receive response." -ForegroundColor Red
        break
    }

    $respText = [System.IO.File]::ReadAllText("$PSScriptRoot/temp_batch.json", [System.Text.Encoding]::UTF8)
    $resp = $respText | ConvertFrom-Json
    
    if (-not $resp.hits -or $resp.hits.Count -eq 0) {
        Write-Host "Completed crawl at batch $batchNum." -ForegroundColor Green
        break
    }
    
    $added = 0
    foreach ($h in $resp.hits) {
        if (-not $seenIds.ContainsKey($h.id)) {
            $seenIds[$h.id] = $true
            $allClean += $h
            $added++
        }
    }
    
    $lastTime = $resp.hits[-1].create_time
    Write-Host "Batch $batchNum : added $added articles (total: $($allClean.Count))"
    
    if ($lastTime -ge $currBefore) {
        $currBefore = $lastTime - 1
    } else {
        $currBefore = $lastTime
    }
    $batchNum++
    
    if ($resp.hits.Count -lt 100) {
        break
    }
}

Remove-Item "$PSScriptRoot/temp_q.json", "$PSScriptRoot/temp_batch.json" -Force -ErrorAction SilentlyContinue

Write-Host "`nProcessing $($allClean.Count) articles into optimized index..." -ForegroundColor Cyan

$processed = @()
$uniqueSchools = @{}

foreach ($a in $allClean) {
    $content = $a.content
    if (-not $content) { $content = "" }
    
    $hasPdf = ($content -match '\.pdf|pdf附件' -or $a.title -match '\.pdf|pdf')
    $hasZip = ($content -match '\.zip|\.rar|\.7z|\.tar\.gz' -or $a.title -match '\.zip|\.rar|\.7z')
    $hasBaidu = ($content -match 'pan\.baidu\.com|提取码|百度网盘|百度云')
    
    $baiduUrls = @()
    if ($content -match '(https?://pan\.baidu\.com/s/[a-zA-Z0-9_\-\?=&]+)') {
        $bUrl = $Matches[1]
        if ($content -match '(?:提取码|密码|pwd)[:：\s]*([a-zA-Z0-9]{4})') {
            $bUrl = "$bUrl?pwd=$($Matches[1])"
        }
        $baiduUrls += $bUrl
    }
    
    $college = ""
    if ($a.college_name -and $a.college_name.Count -gt 0) {
        $firstCollege = $a.college_name[0]
        if ($firstCollege -and $firstCollege -ne "未分类" -and $firstCollege.Trim() -ne "") {
            $college = $firstCollege.Trim()
            $uniqueSchools[$college] = ($uniqueSchools[$college] + 1)
        }
    }
    
    $cleanContent = $content -replace '\s+', ' '
    $snippet = $cleanContent
    if ($cleanContent.Length -gt 220) {
        $snippet = $cleanContent.Substring(0, 220) + "..."
    }
    
    $item = [PSCustomObject]@{
        id = $a.id -replace '^bbs-post-', ''
        title = $a.title
        author = $a.author_nickname
        avatar = $a.author_avatar
        college = $college
        time = $a.create_time
        url = $a.url
        img = $a.image
        snippet = $snippet
        has_pdf = [bool]$hasPdf
        has_zip = [bool]$hasZip
        has_baidu = [bool]$hasBaidu
        baidu_links = $baiduUrls
    }
    $processed += $item
}

$schoolsArray = @()
foreach ($k in $uniqueSchools.Keys) {
    $schoolsArray += [PSCustomObject]@{
        name = $k
        count = $uniqueSchools[$k]
    }
}
$sortedSchools = $schoolsArray | Sort-Object -Property count -Descending

$jsonArticles = $processed | ConvertTo-Json -Depth 5 -Compress
$jsonSchools = $sortedSchools | ConvertTo-Json -Depth 5

New-Item -ItemType Directory -Force -Path "$PSScriptRoot/data" | Out-Null
New-Item -ItemType Directory -Force -Path "$PSScriptRoot/public/data" | Out-Null

[System.IO.File]::WriteAllText("$PSScriptRoot/data/articles.json", $jsonArticles, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$PSScriptRoot/public/data/articles.json", $jsonArticles, (New-Object System.Text.UTF8Encoding($false)))

[System.IO.File]::WriteAllText("$PSScriptRoot/data/schools.json", $jsonSchools, (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllText("$PSScriptRoot/public/data/schools.json", $jsonSchools, (New-Object System.Text.UTF8Encoding($false)))

Write-Host "`nSuccessfully updated!" -ForegroundColor Green
Write-Host "Articles: $($processed.Count)"
Write-Host "Schools:  $($sortedSchools.Count)"
