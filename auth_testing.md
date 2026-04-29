# Auth Testing Playbook — Casa de Poker

## Cookies
- Cookie name: `access_token` (httpOnly, secure, samesite=none)
- Frontend uses `withCredentials: true` on all axios calls

## Verify with curl
```
API_URL=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)
curl -c /tmp/cookies.txt -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@poker.com","password":"admin123"}'
curl -b /tmp/cookies.txt "$API_URL/api/auth/me"
```

## Mongo verification
```
mongosh
use test_database
db.users.find({}, {password_hash: 1, email: 1, role: 1}).pretty()
```
- `password_hash` should start with `$2b$`
- Indexes: `users.email` unique, `players.id` unique

## Brute force
- 5 failed login attempts within 15 minutes -> 429 lockout
