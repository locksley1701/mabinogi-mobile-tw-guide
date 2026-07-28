param(
    [string]$ProjectPath = 'D:\workbench\mabinogi-mobile-tw-guide',
    [string]$Repository = 'locksley1701/mabinogi-mobile-tw-guide'
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $ProjectPath

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "找不到必要指令：$Name"
    }
}

Assert-Command git
Assert-Command gh

gh auth status
if ($LASTEXITCODE -ne 0) {
    throw 'GitHub CLI 尚未登入，請先執行 gh auth login。'
}

if (-not (Test-Path -LiteralPath '.git')) {
    git init -b main
}

$remoteExists = $false
git remote get-url origin *> $null
if ($LASTEXITCODE -eq 0) {
    $remoteExists = $true
}

$repoExists = $true
gh repo view $Repository --json nameWithOwner *> $null
if ($LASTEXITCODE -ne 0) {
    $repoExists = $false
}

if (-not $repoExists) {
    gh repo create $Repository `
        --public `
        --description '法那提歐的愛爾琳手札｜瑪奇 Mobile 台版全方位攻略' `
        --source . `
        --remote origin
    if ($LASTEXITCODE -ne 0) {
        throw '建立 GitHub repository 失敗。'
    }
} elseif (-not $remoteExists) {
    git remote add origin "https://github.com/$Repository.git"
}

git add --all
$pending = git status --porcelain
if ($pending) {
    git commit -m 'feat: 建立法那提歐的愛爾琳手札首版網站'
}

git branch -M main
git push -u origin main
if ($LASTEXITCODE -ne 0) {
    throw '推送 main 分支失敗。'
}

$pagesExists = $true
gh api "/repos/$Repository/pages" *> $null
if ($LASTEXITCODE -ne 0) {
    $pagesExists = $false
}

$payload = @{
    build_type = 'legacy'
    source = @{
        branch = 'main'
        path = '/'
    }
} | ConvertTo-Json -Depth 4 -Compress

if ($pagesExists) {
    $payload | gh api --method PUT "/repos/$Repository/pages" --input - *> $null
} else {
    $payload | gh api --method POST "/repos/$Repository/pages" --input - *> $null
}

if ($LASTEXITCODE -ne 0) {
    Write-Warning '網站已推送，但 GitHub Pages API 設定失敗。請到 Settings → Pages，選擇 Deploy from a branch、main、/(root)。'
} else {
    Write-Host ''
    Write-Host '部署設定完成。' -ForegroundColor Green
    Write-Host '網站網址：https://locksley1701.github.io/mabinogi-mobile-tw-guide/' -ForegroundColor Cyan
}

git status --short --branch
git log -1 --oneline
