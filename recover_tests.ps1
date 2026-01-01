# Recovery Script for Test Files from Cursor Local History
# Target Date: December 29, 2025 at 11:08 AM

$targetDate = Get-Date "2025-12-29 11:08:00"
$historyPath = "$env:APPDATA\Cursor\User\History"
$projectPath = "C:\Users\patel\Documents\lms"
$testPath = "$projectPath\frontend\src\components\__tests__"

Write-Host "========================================="
Write-Host "Test Files Recovery Script"
Write-Host "========================================="
Write-Host "Target Date: $targetDate"
Write-Host "History Path: $historyPath"
Write-Host "Project Path: $projectPath"
Write-Host "Test Path: $testPath"
Write-Host "========================================="
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
$testFilesRecovered = 0

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
        
        # Only process test files in the __tests__ directory
        $projectPathLower = $projectPath.ToLower()
        $originalPathLower = $originalPath.ToLower()
        
        if ($originalPathLower -like "*$projectPathLower*" -and $originalPathLower -like "*__tests__*" -and $originalPathLower -like "*.test.tsx") {
            # Extract relative path
            $relativePath = $originalPath.Substring($originalPathLower.IndexOf($projectPathLower) + $projectPath.Length).TrimStart('\')
            
            # Find the entry closest to target time (before or at target time, but within 1 hour window)
            $targetTimestamp = [DateTimeOffset]::new($targetDate).ToUnixTimeMilliseconds()
            $oneHourBefore = [DateTimeOffset]::new($targetDate.AddHours(-1)).ToUnixTimeMilliseconds()
            
            $closestEntry = $entryData.entries | 
                Where-Object { $_.timestamp -ge $oneHourBefore -and $_.timestamp -le $targetTimestamp } | 
                Sort-Object timestamp -Descending | 
                Select-Object -First 1
            
            # If no entry in the 1-hour window, try to get the closest one before target time
            if (-not $closestEntry) {
                $closestEntry = $entryData.entries | 
                    Where-Object { $_.timestamp -le $targetTimestamp } | 
                    Sort-Object timestamp -Descending | 
                    Select-Object -First 1
            }
            
            if ($closestEntry) {
                $historyFile = Join-Path $entryFile.DirectoryName $closestEntry.id
                
                if (Test-Path $historyFile) {
                    # Restore directly to the test directory
                    $recoveredFilePath = Join-Path $projectPath $relativePath
                    $recoveredFileDir = Split-Path $recoveredFilePath -Parent
                    
                    # Create directory structure if needed
                    if (-not (Test-Path $recoveredFileDir)) {
                        New-Item -ItemType Directory -Path $recoveredFileDir -Force | Out-Null
                    }
                    
                    # Copy the file back to its original location
                    Copy-Item $historyFile $recoveredFilePath -Force
                    $recoveredCount++
                    $testFilesRecovered++
                    
                    $entryTime = [DateTimeOffset]::FromUnixTimeMilliseconds($closestEntry.timestamp).LocalDateTime
                    Write-Host "[$testFilesRecovered] Recovered: $relativePath (from $entryTime)" -ForegroundColor Green
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
Write-Host "Test files recovered: $testFilesRecovered"
Write-Host "Total files processed: $recoveredCount"
Write-Host "Files skipped: $skippedCount"
Write-Host ""
Write-Host "Test files have been restored to: $testPath"
Write-Host "========================================="



