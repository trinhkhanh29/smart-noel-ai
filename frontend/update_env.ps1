$api = Invoke-RestMethod http://127.0.0.1:4040/api/tunnels
$link = $api.tunnels[0].public_url

(Get-Content .env.local) -replace 'NEXT_PUBLIC_API_URL=.*', "NEXT_PUBLIC_API_URL=$link" |
    Set-Content .env.local

Write-Host "NEXT_PUBLIC_API_URL updated to $link"
