# Test Backend API Endpoints
$BaseUrl = "http://localhost:3001/api"

Write-Host "🚀 Starting Backend API Tests..." -ForegroundColor Green
Write-Host ""

# Test 1: Get available models
Write-Host "🧪 Test 1: Get available models" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/models" -Method GET
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   📊 Models available: $($data.Count)" -ForegroundColor Cyan
    Write-Host "   🔍 First model: $($data[0].id) - $($data[0].displayName)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Get job status
Write-Host "🧪 Test 2: Get job status" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/jobs/status" -Method GET
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   📊 Jobs found: $($data.Count)" -ForegroundColor Cyan
    if ($data.Count -gt 0) {
        $completedJobs = ($data | Where-Object { $_.status -eq "completed" }).Count
        Write-Host "   ✅ Completed jobs: $completedJobs" -ForegroundColor Cyan
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Get results summary
Write-Host "🧪 Test 3: Get results summary" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/jobs/results-summary" -Method GET
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   📊 Total jobs: $($data.totalJobs)" -ForegroundColor Cyan
    Write-Host "   📈 Total results: $($data.totalResults)" -ForegroundColor Cyan
    Write-Host "   🎯 Best results per model: $($data.bestResultsPerModelMethod.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Get best results per model/method
Write-Host "🧪 Test 4: Get best results per model/method" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/jobs/best-results-per-model" -Method GET
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   📊 Total jobs: $($data.totalJobs)" -ForegroundColor Cyan
    Write-Host "   🎯 Models with best results: $($data.bestResultsPerModelMethod.Count)" -ForegroundColor Cyan
    
    if ($data.bestResultsPerModelMethod.Count -gt 0) {
        $firstModel = $data.bestResultsPerModelMethod[0]
        Write-Host "   🔍 First model: $($firstModel.modelType) - $($firstModel.displayName)" -ForegroundColor Cyan
        Write-Host "   🎯 Methods: $($firstModel.methods.method -join ', ')" -ForegroundColor Cyan
        
        foreach ($method in $firstModel.methods) {
            if ($method.bestResult) {
                Write-Host "      📈 $($method.method): $($method.bestResult.accuracy)% accuracy" -ForegroundColor White
            }
        }
    }
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Get best results (grid only)
Write-Host "🧪 Test 5: Get best results (grid only)" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/jobs/best-results-per-model?method=grid" -Method GET
    $data = $response.Content | ConvertFrom-Json
    Write-Host "   ✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "   📊 Models with grid results: $($data.bestResultsPerModelMethod.Count)" -ForegroundColor Cyan
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎉 Backend API Tests Completed!" -ForegroundColor Green 