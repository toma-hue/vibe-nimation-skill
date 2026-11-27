# Vibe-nimation — instalare pe Windows, dintr-o singură comandă (PowerShell):
#   powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/toma-hue/vibe-nimation-skill/main/install.ps1 | iex"
# Alt folder:  $env:VN_ROOT = 'E:\Vibe-nimation'; apoi aceeași comandă.
# Ce face: instalează (dacă lipsesc) Node.js LTS, ffmpeg, Python 3.11 și Git cu winget; creează proiectul
# D:\Vibe-nimation (sau C:\Users\<nume>\Vibe-nimation dacă nu există D:), pune skill-ul în .claude\skills\vibe-nimation
# și rulează setup.py (mediul Python privat + modelele, ~4 GB, o singură dată). Se poate rula din nou oricând.
$ErrorActionPreference = 'Stop'
function Say($m) { Write-Host "`n== $m" -ForegroundColor Magenta }
function Refresh-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Has($cmd) { [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }

$Root = if ($env:VN_ROOT) { $env:VN_ROOT } elseif (Test-Path 'D:\') { 'D:\Vibe-nimation' } else { Join-Path $HOME 'Vibe-nimation' }
$Skill = Join-Path $Root '.claude\skills\vibe-nimation'
$Repo = 'https://github.com/toma-hue/vibe-nimation-skill.git'

Say "Proiect: $Root"
if (-not (Has 'winget')) { Write-Host 'winget lipsește: instalează "App Installer" din Microsoft Store, apoi rulează din nou.' -ForegroundColor Red; return }

# 1 · uneltele
$tools = @(
  @{ cmd = 'node';   id = 'OpenJS.NodeJS.LTS';   name = 'Node.js LTS' },
  @{ cmd = 'ffmpeg'; id = 'Gyan.FFmpeg';         name = 'ffmpeg' },
  @{ cmd = 'git';    id = 'Git.Git';             name = 'Git' }
)
foreach ($t in $tools) {
  if (Has $t.cmd) { Write-Host "$($t.name): ok" }
  else { Say "instalez $($t.name)…"; winget install --id $t.id -e --silent --accept-source-agreements --accept-package-agreements | Out-Host; Refresh-Path }
}
# Python: "python" poate fi doar scurtătura spre Microsoft Store — verificăm că rulează cu adevărat
$py = $null
foreach ($c in @('py -3.11', 'py -3', 'python')) {
  try { $v = & cmd /c "$c --version 2>&1"; if ($LASTEXITCODE -eq 0 -and $v -match 'Python 3\.(1[0-9])') { $py = $c; break } } catch {}
}
if (-not $py) {
  Say 'instalez Python 3.11…'; winget install --id Python.Python.3.11 -e --silent --accept-source-agreements --accept-package-agreements | Out-Host; Refresh-Path
  foreach ($c in @('py -3.11', 'python')) { try { $v = & cmd /c "$c --version 2>&1"; if ($LASTEXITCODE -eq 0 -and $v -match 'Python 3') { $py = $c; break } } catch {} }
}
if (-not $py) { Write-Host 'Python nu răspunde încă: închide PowerShell, deschide unul nou și rulează comanda din nou.' -ForegroundColor Red; return }
Write-Host "Python: ok ($py)"
foreach ($t in $tools) { if (-not (Has $t.cmd)) { Write-Host "$($t.name) s-a instalat, dar terminalul nu-l vede încă: deschide un PowerShell NOU și rulează comanda din nou." -ForegroundColor Yellow; return } }

# 2 · folderele proiectului
Say 'creez folderele'
foreach ($d in @($Root, (Join-Path $Root 'Episoade'), (Join-Path $Root '.claude\skills'))) { New-Item -ItemType Directory -Force -Path $d | Out-Null }

# 3 · skill-ul (clonat sau actualizat)
# un singur branch: main. Actualizarea aduce mereu ultima versiune de pe main (și revine pe main dacă era pe alt branch).
if (Test-Path (Join-Path $Skill '.git')) {
  Say 'actualizez skill-ul'
  git -C $Skill fetch origin main | Out-Host
  git -C $Skill checkout -B main origin/main | Out-Host
}
else { Say 'descarc skill-ul'; git clone $Repo $Skill | Out-Host }

# 4 · instrucțiuni pentru Claude Code în proiect
$claudeMd = Join-Path $Root 'CLAUDE.md'
if (-not (Test-Path $claudeMd)) {
@'
# Vibe-nimation

Acest proiect transformă episoade de seriale în short-uri animate cu skill-ul **vibe-nimation**
(`.claude/skills/vibe-nimation`). Vorbește cu mine în română.

- Episoadele noi le pun în `Episoade\`. Când îți dau un episod, folosește skill-ul vibe-nimation.
- Rezultatele: `Vibe-nimation episodes\` (short-uri, fișe de personaje și locații). Fișiere de lucru: `_lucru\`.
- Actualizare skill: `git -C .claude\skills\vibe-nimation pull`
'@ | Set-Content -Encoding UTF8 $claudeMd
}

# 5 · setup (mediul Python, modelele, testul plăcii video și al vocii)
Say 'rulez setup-ul skill-ului (prima dată durează câteva minute și descarcă ~4 GB)'
& cmd /c "$py `"$Skill\scripts\setup.py`" --root `"$Root`""
if ($LASTEXITCODE -ne 0) { Write-Host "`nSetup-ul nu a terminat. Trimite-i lui Claude ce scrie mai sus." -ForegroundColor Red; return }

Say 'Gata!'
Write-Host "Proiectul: $Root"
Write-Host "Pune episoadele în: $(Join-Path $Root 'Episoade')"
Write-Host "Deschide Claude Code în $Root și scrie: Folosește vibe-nimation pe episodul $(Join-Path $Root 'Episoade')\<fișier>"
