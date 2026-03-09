# Test all key endpoints
echo "=== 1. Landing page ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/
echo ""

echo "=== 2. Login page ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/login
echo ""

echo "=== 3. Dashboard (should redirect to login) ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/dashboard
echo ""

echo "=== 4. Auth CSRF ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/api/auth/csrf
echo ""

echo "=== 5. Auth providers ==="
curl -s http://localhost:3000/api/auth/providers | python3 -m json.tool 2>/dev/null
echo ""

echo "=== 6. Create tracked email (DB test) ==="
curl -s -X POST http://localhost:3000/api/emails -H "Content-Type: application/json" -d '{"recipient":"verify@test.com","subject":"Full Flow Test","senderEmail":"user@test.com"}'
echo ""

echo "=== 7. Track pixel ==="
TRACK_ID=$(curl -s -X POST http://localhost:3000/api/emails -H "Content-Type: application/json" -d '{"recipient":"pixel@test.com","subject":"Pixel Test","senderEmail":"user@test.com"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
curl -s -o /dev/null -w "HTTP %{http_code} Content-Type: " http://localhost:3000/api/track/$TRACK_ID
curl -s -D - -o /dev/null http://localhost:3000/api/track/$TRACK_ID 2>&1 | grep -i content-type
echo ""

echo "=== 8. Auth signin redirect (Google) ==="
curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:3000/api/auth/signin/google
echo ""
