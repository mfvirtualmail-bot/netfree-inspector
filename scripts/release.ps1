<#
.SYNOPSIS
  Cut a new NetFree Inspector version: bump the manifest, build the ZIP
  (both a versioned name and the stable netfree-inspector.zip), and create
  a GitHub PRE-RELEASE.

.DESCRIPTION
  A pre-release does NOT touch the live download button on the landing page.
  The button follows releases/latest/download/netfree-inspector.zip, and
  GitHub never auto-promotes a pre-release to "Latest". So this script lets
  you publish a build to test manually; the site keeps serving the last
  confirmed-good version until you promote this one.

  To promote once you've confirmed it works well:
    gh release edit v1.7.0 --repo mfvirtualmail-bot/netfree-inspector --latest --prerelease=false
  (or on github.com: Releases -> the version -> Edit -> "Set as latest release")

.PARAMETER Version
  The new version, e.g. 1.7.0 (no leading "v"). Written into manifest.json
  and used for the tag v1.7.0 and asset netfree-inspector-v1.7.0.zip.

.PARAMETER Notes
  Release notes (markdown). If omitted, a sensible default is used.

.PARAMETER Message
  Commit subject for the manifest bump. Defaults to "v<Version>".

.PARAMETER SkipGit
  Skip committing/pushing the manifest bump. Build + release from the
  current working tree as-is (handy for a quick local test build).

.EXAMPLE
  ./scripts/release.ps1 -Version 1.7.0

.EXAMPLE
  ./scripts/release.ps1 -Version 1.7.0 -Notes "Fixes Reload & Record recording."
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d+\.\d+\.\d+$')]
  [string]$Version,

  [string]$Notes,

  [string]$Message,

  [switch]$SkipGit
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo    = Split-Path $PSScriptRoot -Parent        # repo root (scripts/ is one level down)
$tag     = "v$Version"
$distDir = Join-Path $repo 'dist'
$stage   = Join-Path $distDir 'stage'
$manifestPath = Join-Path $repo 'manifest.json'

if (-not $Message) { $Message = $tag }

# --- 0. sanity checks -------------------------------------------------------
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "GitHub CLI (gh) not found on PATH. Install it or run 'gh auth login'."
}
if (-not (Test-Path $manifestPath)) {
  throw "manifest.json not found at $manifestPath - run this from inside the repo."
}
$slug = (gh repo view --json nameWithOwner -q .nameWithOwner).Trim()
Write-Host "Repo:    $slug"
Write-Host "Version: $Version  (tag $tag)"

# --- 1. bump manifest.json version (regex, preserves formatting) ------------
$raw = [IO.File]::ReadAllText($manifestPath)
$old = [regex]::Match($raw, '"version"\s*:\s*"([^"]*)"')
if (-not $old.Success) { throw 'Could not find a "version" field in manifest.json' }
Write-Host "Bumping manifest version $($old.Groups[1].Value) -> $Version"
$new = [regex]::Replace($raw, '("version"\s*:\s*")[^"]*(")', "`${1}$Version`${2}", 1)
[IO.File]::WriteAllText($manifestPath, $new, (New-Object System.Text.UTF8Encoding($false)))

# --- 2. build the ZIP -------------------------------------------------------
# Stage every top-level runtime file/folder; exclude repo/dev/site material.
$exclude = @('.git', '.github', '.gitignore', '.vscode', '.idea',
             '.local-research', 'docs', 'store', 'scripts', 'dist',
             'create-icons.js')

New-Item -ItemType Directory -Path $stage -Force | Out-Null
Get-ChildItem $stage -Force | ForEach-Object { Remove-Item $_.FullName -Recurse -Force }

Get-ChildItem $repo -Force | Where-Object {
  $exclude -notcontains $_.Name -and $_.Extension -ne '.md'
} | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $stage $_.Name) -Recurse -Force
}

if (-not (Test-Path (Join-Path $stage 'manifest.json'))) {
  throw 'Build error: manifest.json did not make it into the staging folder.'
}

$versionedZip = Join-Path $distDir "netfree-inspector-$tag.zip"
$stableZip    = Join-Path $distDir 'netfree-inspector.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $versionedZip -CompressionLevel Optimal -Force
Copy-Item $versionedZip $stableZip -Force
Write-Host "Built:   $versionedZip"
Write-Host "Built:   $stableZip"

# --- 3. commit + push the version bump --------------------------------------
if (-not $SkipGit) {
  git -C $repo add manifest.json
  git -C $repo commit -m $Message | Out-Null
  git -C $repo push origin HEAD
  Write-Host "Committed & pushed manifest bump: $Message"
} else {
  Write-Host "SkipGit: manifest bump left uncommitted."
}

# --- 4. create the GitHub pre-release ---------------------------------------
if (-not $Notes) {
  $Notes = @"
NetFree Inspector $tag.

## Install (manual / unpacked)
1. Download **netfree-inspector-$tag.zip** below and unzip it.
2. Open ``chrome://extensions`` and turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the unzipped folder (the one with ``manifest.json``).

_This is a pre-release. The website download button keeps serving the current
Latest release until this one is promoted._
"@
}

gh release create $tag $versionedZip $stableZip `
  --repo $slug --prerelease --title $tag --notes $Notes

Write-Host ""
Write-Host "Pre-release $tag published (not yet Latest)." -ForegroundColor Green
Write-Host "Test it, then promote with:" -ForegroundColor Green
Write-Host "  gh release edit $tag --repo $slug --latest --prerelease=false"
