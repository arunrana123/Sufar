#!/bin/bash

# API Testing Script for Sufar Project
# Run this to verify all APIs are working properly

echo "🧪 Testing Sufar APIs..."
echo "========================"

API_URL="http://localhost:5001"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local description=$2
    
    echo -n "Testing $description... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
    
    if [ "$response" == "200" ]; then
        echo -e "${GREEN}✓ OK${NC}"
    else
        echo -e "${RED}✗ FAILED (HTTP $response)${NC}"
    fi
}

# Test Backend Health
echo -e "\n📊 Backend Health Check:"
curl -s "$API_URL/health" | python3 -m json.tool | head -20

# Test API Endpoints
echo -e "\n🔌 Testing API Endpoints:"
test_endpoint "/api/users/health" "User Routes"
test_endpoint "/api/dashboard/stats" "Dashboard Stats"
test_endpoint "/api/workers/stats-by-category" "Worker Stats"
test_endpoint "/api/services" "Services"
test_endpoint "/api/notifications" "Notifications"

# Test Socket.IO
echo -e "\n🔌 Testing Socket.IO Connection:"
echo -n "Socket.IO Server... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/socket.io/")
if [ "$response" == "400" ] || [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Database Connection Test
echo -e "\n💾 Database Status:"
curl -s "$API_URL/health" | python3 -c "
import json, sys
data = json.load(sys.stdin)
db = data.get('database', {})
if db.get('connected'):
    print('✓ MongoDB Connected')
    print(f'  Database: {db.get(\"database\")}')
    print(f'  Ready State: {db.get(\"readyState\")}')
else:
    print('✗ MongoDB Disconnected')
    print(f'  Error: {db.get(\"error\")}')
"

# Performance Metrics
echo -e "\n📈 Current Stats:"
curl -s "$API_URL/api/dashboard/stats" | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'  Total Users: {data[\"users\"][\"total\"]}')
print(f'  Total Workers: {data[\"workers\"][\"total\"]}')
print(f'  Total Bookings: {data[\"bookings\"][\"total\"]}')
print(f'  Active Services: {data[\"services\"][\"active\"]}')
"

echo -e "\n✅ API Testing Complete!"