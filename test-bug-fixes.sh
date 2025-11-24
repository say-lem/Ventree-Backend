#!/bin/bash

# ============================================================================
# Bug Fixes Verification Test Script
# Tests all 3 bug fixes: Owner-only access, Reset removal, No duplicates
# ============================================================================

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
OWNER_TOKEN="${1}"
STAFF_TOKEN="${2}"
SHOP_ID="${3}"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "============================================================================"
echo "       Bug Fixes Verification Test Suite"
echo "============================================================================"
echo ""
echo "Testing:"
echo "  1. Owner-only access enforcement (Bug #1)"
echo "  2. Reset endpoint removal (Bug #2)"
echo "  3. No duplicate notifications (Bug #3)"
echo ""

# Validation
if [ -z "$OWNER_TOKEN" ] || [ -z "$SHOP_ID" ]; then
    echo -e "${RED}Error: Missing required parameters${NC}"
    echo "Usage: ./test-bug-fixes.sh <OWNER_TOKEN> [STAFF_TOKEN] <SHOP_ID>"
    echo ""
    echo "Example:"
    echo "  ./test-bug-fixes.sh eyJhbGc... eyJhbGc... 673d9c7f42f38ceea1ec4575"
    exit 1
fi

# Helper functions
start_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test $TOTAL_TESTS: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

test_pass() {
    echo -e "${GREEN}✓ PASSED${NC} - $1"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

test_fail() {
    echo -e "${RED}✗ FAILED${NC} - $1"
    echo "  Response: $2"
    FAILED_TESTS=$((FAILED_TESTS + 1))
}

# ============================================================================
# BUG FIX #1: OWNER-ONLY ACCESS
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  BUG FIX #1: OWNER-ONLY ACCESS ENFORCEMENT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 1: Owner can access settings
start_test "Owner Can Get Settings"
RESPONSE=$(curl -s "$BASE_URL/api/v1/notifications/settings?shopId=$SHOP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")

if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q "lowStockEnabled"; then
    test_pass "Owner can access settings"
else
    test_fail "Owner should be able to access settings" "$RESPONSE"
fi

# Test 2: Owner can update settings
start_test "Owner Can Update Settings"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": false
  }")

if echo "$RESPONSE" | grep -q '"success":true' && echo "$RESPONSE" | grep -q '"lowStockEnabled":false'; then
    test_pass "Owner can update settings"
else
    test_fail "Owner should be able to update settings" "$RESPONSE"
fi

# Test 3: Staff cannot access settings (if staff token provided)
if [ ! -z "$STAFF_TOKEN" ]; then
    start_test "Staff Cannot Get Settings (Should Get 403)"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$BASE_URL/api/v1/notifications/settings?shopId=$SHOP_ID" \
      -H "Authorization: Bearer $STAFF_TOKEN")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "403" ] || echo "$BODY" | grep -q "Only shop owners"; then
        test_pass "Staff correctly denied access (403)"
    else
        test_fail "Staff should get 403 Forbidden" "HTTP: $HTTP_CODE, Body: $BODY"
    fi
    
    # Test 4: Staff cannot update settings
    start_test "Staff Cannot Update Settings (Should Get 403)"
    RESPONSE=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE_URL/api/v1/notifications/settings" \
      -H "Authorization: Bearer $STAFF_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"shopId\": \"$SHOP_ID\",
        \"lowStockEnabled\": false
      }")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)
    
    if [ "$HTTP_CODE" = "403" ] || echo "$BODY" | grep -q "Only shop owners"; then
        test_pass "Staff correctly denied update access (403)"
    else
        test_fail "Staff should get 403 Forbidden on update" "HTTP: $HTTP_CODE, Body: $BODY"
    fi
else
    echo -e "${YELLOW}⚠ Skipping staff tests - STAFF_TOKEN not provided${NC}"
    echo "  To test staff access denial, provide staff token as second parameter"
fi

# ============================================================================
# BUG FIX #2: RESET ENDPOINT REMOVED
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  BUG FIX #2: RESET ENDPOINT REMOVED${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 5: Reset endpoint should return 404
start_test "Reset Endpoint Should Return 404"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/v1/notifications/settings/reset" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "404" ]; then
    test_pass "Reset endpoint correctly returns 404"
else
    test_fail "Reset endpoint should return 404" "HTTP: $HTTP_CODE, Body: $BODY"
fi

# Test 6: Manual reset via update endpoint works
start_test "Manual Reset Via Update Endpoint"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": true,
    \"outOfStockEnabled\": true,
    \"saleCompletedEnabled\": true
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    LOW=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
    OUT=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
    SALE=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)
    
    if [ "$LOW" = "true" ] && [ "$OUT" = "true" ] && [ "$SALE" = "true" ]; then
        test_pass "Manual reset via update endpoint works"
    else
        test_fail "Manual reset should enable all settings" "low: $LOW, out: $OUT, sale: $SALE"
    fi
else
    test_fail "Manual reset should succeed" "$RESPONSE"
fi

# ============================================================================
# BUG FIX #3: NO DUPLICATE NOTIFICATIONS
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  BUG FIX #3: NO DUPLICATE NOTIFICATIONS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 7: Create notification and check server logs
start_test "Create Notification (Check for Single Publish)"
RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/notifications" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"recipientType\": \"owner\",
    \"message\": \"Bug fix test notification\",
    \"type\": \"custom\"
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
    test_pass "Notification created successfully"
    echo ""
    echo -e "${YELLOW}⚠ Manual Verification Required:${NC}"
    echo "  1. Check server logs for publish messages"
    echo "  2. Should see SINGLE publish per channel (not duplicates)"
    echo "  3. Connect WebSocket client and verify single delivery"
    echo ""
    echo "  Expected in logs:"
    echo "    [NotificationEmitter] Published to owner channel: ... (1 subscribers)"
    echo "    [NotificationEmitter] Published to shop channel: ... (1 subscribers)"
    echo ""
    echo "  Should NOT see:"
    echo "    - Multiple publish logs for same channel"
    echo "    - Duplicate messages in WebSocket client"
else
    test_fail "Notification creation failed" "$RESPONSE"
fi

# Test 8: Verify NotificationEmitter has no pattern subscriptions
start_test "Verify Pattern Subscriptions Removed (Code Check)"
if grep -q "psubscribe" src/modules/notification/emitters/notification.emitter.ts 2>/dev/null; then
    test_fail "Pattern subscriptions (psubscribe) should be removed"
else
    test_pass "No pattern subscriptions found in code"
fi

if grep -q "initializeDefaultSubscriptions" src/modules/notification/emitters/notification.emitter.ts 2>/dev/null; then
    test_fail "initializeDefaultSubscriptions should be removed"
else
    test_pass "initializeDefaultSubscriptions method removed"
fi

# ============================================================================
# ADDITIONAL VERIFICATION TESTS
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  ADDITIONAL VERIFICATION${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 9: Verify role check in service
start_test "Verify Role Check in Service Code"
if grep -q "authContext.role !== 'owner'" src/modules/notification/services/notification-settings.service.ts 2>/dev/null; then
    test_pass "Role check found in service code"
else
    test_fail "Role check should be in validateShopAccess method"
fi

# Test 10: Verify resetSettings method removed
start_test "Verify resetSettings Method Removed"
if grep -q "resetSettings" src/modules/notification/services/notification-settings.service.ts 2>/dev/null; then
    test_fail "resetSettings method should be removed from service"
else
    test_pass "resetSettings method correctly removed"
fi

# Test 11: Verify reset route removed
start_test "Verify Reset Route Removed"
if grep -q "/settings/reset" src/modules/notification/routes/notification.routes.ts 2>/dev/null; then
    test_fail "Reset route should be removed"
else
    test_pass "Reset route correctly removed"
fi

# ============================================================================
# SUMMARY
# ============================================================================

echo ""
echo "============================================================================"
echo -e "${CYAN}                          TEST SUMMARY${NC}"
echo "============================================================================"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "${GREEN}Passed Tests: $PASSED_TESTS${NC}"
echo -e "${RED}Failed Tests: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}              ✓ ALL BUG FIXES VERIFIED! ✓${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "✅ Bug Fix #1: Owner-only access enforced"
    echo "✅ Bug Fix #2: Reset endpoint removed"
    echo "✅ Bug Fix #3: Pattern subscriptions removed"
    echo ""
    echo -e "${YELLOW}Note:${NC} For Bug #3 (duplicate notifications), also verify:"
    echo "  - WebSocket client receives notifications only once"
    echo "  - Server logs show single publish per channel"
    echo "  - Redis monitor shows single message"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}              ✗ SOME TESTS FAILED ✗${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Please review the failed tests above."
    exit 1
fi


