# Recovery Script for Cursor Local History
# Target Date: 2025-12-30 17:00:00

$targetDate = Get-Date "2025-12-30 17:00:00"
$historyPath = "$env:APPDATA\Cursor\User\History"
$projectPath = "C:\Users\patel\Documents\lms"
$recoveryPath = "$projectPath\_recovered_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "========================================="
Write-Host "Cursor Local History Recovery Script"
Write-Host "========================================="
Write-Host "Target Date: $targetDate"
Write-Host "History Path: $historyPath"
Write-Host "Project Path: $projectPath"
Write-Host "Recovery Path: $recoveryPath"
Write-Host "========================================="
Write-Host ""

# Create recovery directory
New-Item -ItemType Directory -Path $recoveryPath -Force | Out-Null
Write-Host "Created recovery directory: $recoveryPath"
Write-Host ""

# Find all entries.json files from the target date
Write-Host "Searching for history entries from $targetDate..."
$entryFiles = Get-ChildItem -Path $historyPath -Recurse -Filter "entries.json" -ErrorAction SilentlyContinue | 
    Where-Object { 
        $_.LastWriteTime.Date -eq $targetDate.Date -or 
        $_.LastWriteTime.Date -eq ($targetDate.AddDays(-1)).Date 
    }

Write-Host "Found $($entryFiles.Count) entry files"
Write-Host ""

$recoveredCount = 0
$skippedCount = 0

foreach ($entryFile in $entryFiles) {
    try {
        $entryData = Get-Content $entryFile.FullName -Raw | ConvertFrom-Json
        
        # Decode the resource path
        $resourceUri = $entryData.resource -replace 'file:///', ''
        $decodedPath = [System.Uri]::UnescapeDataString($resourceUri)
        
        # Normalize path separators - convert forward slashes to backslashes
        $originalPath = $decodedPath -replace '/', '\'
        
        # Ensure drive letter is uppercase for comparison
        if ($originalPath -match '^([a-z]):') {
            $driveLetter = $matches[1].ToUpper()
            $originalPath = "$driveLetter" + $originalPath.Substring(1)
        }
        
        # Only process files in the LMS project (case-insensitive)
        $projectPathLower = $projectPath.ToLower()
        $originalPathLower = $originalPath.ToLower()
        
        if ($originalPathLower -like "*$projectPathLower*") {
            # Extract relative path
            $relativePath = $originalPath.Substring($originalPathLower.IndexOf($projectPathLower) + $projectPath.Length).TrimStart('\')
            
            # Find the entry closest to target time (before or at target time)
            $targetTimestamp = [DateTimeOffset]::new($targetDate).ToUnixTimeMilliseconds()
            $closestEntry = $entryData.entries | 
                Where-Object { $_.timestamp -le $targetTimestamp } | 
                Sort-Object timestamp -Descending | 
                Select-Object -First 1
            
            if ($closestEntry) {
                $historyFile = Join-Path $entryFile.DirectoryName $closestEntry.id
                
                if (Test-Path $historyFile) {
                    $recoveredFilePath = Join-Path $recoveryPath $relativePath
                    $recoveredFileDir = Split-Path $recoveredFilePath -Parent
                    
                    # Create directory structure
                    if (-not (Test-Path $recoveredFileDir)) {
                        New-Item -ItemType Directory -Path $recoveredFileDir -Force | Out-Null
                    }
                    
                    # Copy the file
                    Copy-Item $historyFile $recoveredFilePath -Force
                    $recoveredCount++
                    
                    $entryTime = [DateTimeOffset]::FromUnixTimeMilliseconds($closestEntry.timestamp).LocalDateTime
                    Write-Host "[$recoveredCount] Recovered: $relativePath (from $entryTime)"
                }
            }
        }
    }
    catch {
        $skippedCount++
        Write-Host "Error processing $($entryFile.FullName): $_" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================="
Write-Host "Recovery Complete!"
Write-Host "========================================="
Write-Host "Files recovered: $recoveredCount"
Write-Host "Files skipped: $skippedCount"
Write-Host "Recovery location: $recoveryPath"
Write-Host ""
Write-Host "Next steps:"
Write-Host "1. Review the recovered files in: $recoveryPath"
Write-Host "2. Compare with current files"
Write-Host "3. Copy needed files back to the project"
Write-Host "========================================="

