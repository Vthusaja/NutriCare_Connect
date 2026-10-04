$baseUrl = "http://localhost:8080/api/v1"

function Test-Api {
    param($name, $method, $path, $token, $body)
    try {
        $headers = @{}
        if ($token) { $headers["Authorization"] = "Bearer $token" }
        $params = @{
            Uri = "$baseUrl$path"
            Method = $method
            Headers = $headers
            ContentType = "application/json"
            ErrorAction = "Stop"
        }
        if ($body) { $params["Body"] = ($body | ConvertTo-Json -Depth 5) }
        $res = Invoke-RestMethod @params
        Write-Host "[PASS] $name" -ForegroundColor Green
        return $res
    } catch {
        Write-Host "[FAIL] $name : $($_.Exception.Message)" -ForegroundColor Red
        return $null
    }
}

Write-Host "=== Testing Auth ==="
$adminLogin = Test-Api "Admin Login" "POST" "/auth/login" $null @{ email = "admin@nutricare.demo"; password = "password" }
$adminToken = $adminLogin.token

$patientLogin = Test-Api "Patient Login" "POST" "/auth/login" $null @{ email = "amal@nutricare.demo"; password = "password" }
$patientToken = $patientLogin.token

$doctorLogin = Test-Api "Doctor Login" "POST" "/auth/login" $null @{ email = "ishara@nutricare.demo"; password = "password" }
$doctorToken = $doctorLogin.token

Write-Host "`n=== Testing Module 01: User Access ==="
Test-Api "Get Current User (Admin)" "GET" "/users/me" $adminToken
Test-Api "Get All Users (Admin)" "GET" "/users" $adminToken

Write-Host "`n=== Testing Module 02: Appointments & Billing ==="
Test-Api "Get Availability Slots" "GET" "/availability-slots" $patientToken
Test-Api "Get Appointments (Admin)" "GET" "/appointments" $adminToken
Test-Api "Get Invoices (Admin)" "GET" "/invoices" $adminToken

Write-Host "`n=== Testing Module 03: Health Checks ==="
Test-Api "Get Health Check History (Doctor)" "GET" "/checkups/patient/P001" $doctorToken
Test-Api "Get Health Alerts (Doctor)" "GET" "/health-alerts" $doctorToken
Test-Api "Ask NutriGuide (Patient)" "POST" "/patient-guide/ask" $patientToken @{ question = "What foods help lower blood sugar?" }

Write-Host "`n=== Testing Module 04: Diet & Progress ==="
Test-Api "Get Diet Plans (Doctor)" "GET" "/diet-plans/patient/P001" $doctorToken
Test-Api "Get Progress Logs (Doctor)" "GET" "/progress-logs/patient/P001" $doctorToken

Write-Host "`n=== Testing Module 05: Messaging & Reminders ==="
Test-Api "Get Messages (Doctor)" "GET" "/messages/patient/P001" $doctorToken
Test-Api "Get Notifications (Patient)" "GET" "/notifications/recipient/P001" $patientToken

Write-Host "`n=== Testing Module 06: Feedback & Analytics ==="
Test-Api "Get Feedback (Patient)" "GET" "/feedback/patient/P001" $patientToken
Test-Api "Get Complaints (Admin)" "GET" "/complaints" $adminToken
Test-Api "Get Reports Summary (Admin)" "GET" "/reports/summary?from=2026-01-01&to=2026-12-31" $adminToken

Write-Host "`n=== Testing Integration Endpoints ==="
Test-Api "Get Workspace Summary (Admin)" "GET" "/summary" $adminToken
Test-Api "Get Practitioners" "GET" "/practitioners" $adminToken
