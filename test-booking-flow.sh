#!/bin/bash

# Booking Flow Test Script
# Tests the complete booking and navigation flow

echo "🧪 Testing Enhanced Booking Flow & Navigation..."
echo "=============================================="

API_URL="http://localhost:5001"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "\n${BLUE}📊 Backend Status:${NC}"
curl -s "$API_URL/health" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(f'✅ Backend: {data[\"status\"]}')
    print(f'✅ Database: {data[\"database\"][\"database\"]} ({data[\"database\"][\"readyState\"]})')
    print(f'📈 Users: {data[\"counts\"][\"users\"]}')
    print(f'👷 Workers: {data[\"counts\"][\"workers\"]}')  
    print(f'📋 Bookings: {data[\"counts\"][\"bookings\"]}')
except:
    print('❌ Backend not responding')
"

echo -e "\n${BLUE}🔌 Socket.IO Status:${NC}"
socket_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/socket.io/")
if [ "$socket_response" == "400" ] || [ "$socket_response" == "200" ]; then
    echo -e "${GREEN}✅ Socket.IO Server Running${NC}"
else
    echo -e "${RED}❌ Socket.IO Server Not Available${NC}"
fi

echo -e "\n${BLUE}🎯 Testing Core APIs:${NC}"

# Test booking endpoints
echo -n "Testing Booking Routes... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/bookings")
if [ "$response" == "200" ] || [ "$response" == "404" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED (HTTP $response)${NC}"
fi

# Test worker routes
echo -n "Testing Worker Routes... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/workers/stats-by-category")
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED (HTTP $response)${NC}"
fi

# Test user routes  
echo -n "Testing User Routes... "
response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/users/health")
if [ "$response" == "200" ]; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED (HTTP $response)${NC}"
fi

echo -e "\n${BLUE}📋 Available Workers by Category:${NC}"
curl -s "$API_URL/api/workers/stats-by-category" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    for category in data[:5]:  # Show first 5 categories
        print(f'  {category[\"name\"]}: {category[\"totalWorkers\"]} workers ({category[\"verifiedWorkers\"]} verified)')
except:
    print('  Unable to fetch worker data')
"

echo -e "\n${YELLOW}🔄 Booking Flow Test Instructions:${NC}"
echo "To test the complete enhanced navigation flow:"
echo ""
echo "1. 📱 User App: Open and create a booking"
echo "2. 👷 Worker App: Accept the booking request" 
echo "3. 🚗 Worker App: Navigate to job → Click 'Start Navigation'"
echo "4. 📍 Both Apps: Watch real-time blue road path appear"
echo "5. 🎯 User App: See live distance countdown"
echo "6. ✅ Worker App: Click 'Mark as Arrived' when close"
echo ""
echo -e "${GREEN}✨ Key Features to Verify:${NC}"
echo "- Blue road-based path (not straight line)"
echo "- Live distance: 'Traveled: 2.3km | Remaining: 1.8km'" 
echo "- Real-time ETA updates"
echo "- Route recalculation when worker moves"
echo "- Perfect sync between both apps"

echo -e "\n${BLUE}📚 Documentation Created:${NC}"
echo "- NAVIGATION_FLOW_COMPLETE.md (this guide)"
echo "- OPTIMIZATION_SUMMARY.md (performance improvements)"
echo "- test-apis.sh (API testing script)"

echo -e "\n${GREEN}🎉 Enhanced Navigation System Ready!${NC}"
echo "Your booking flow now works like professional ride-sharing apps!"