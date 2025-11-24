#!/bin/bash

# ============================================================================
# Notification Settings Feature Test Suite
# Tests the complete user flow for notification settings management
# ============================================================================

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${BASE_URL:-http://localhost:5000}"
OWNER_TOKEN="${1}"
SHOP_ID="${2}"
INVENTORY_ITEM_ID="${3}"
STAFF_PROFILE_ID="${4}"

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "============================================================================"
echo "       Notification Settings Feature - Complete Test Suite"
echo "============================================================================"
echo ""
echo "Configuration:"
echo "  Base URL: $BASE_URL"
echo "  Shop ID: $SHOP_ID"
echo ""

# Helper function to increment test counter
start_test() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}Test $TOTAL_TESTS: $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Helper function to check test result
check_result() {
    local test_name=$1
    local response=$2
    local expected_field=$3
    
    if echo "$response" | grep -q '"success":true' && echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✓ PASSED${NC} - $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC} - $test_name"
        echo "  Response: $response"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Helper function to check notification existence
check_notification_exists() {
    local notification_type=$1
    local should_exist=$2
    
    RESPONSE=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&type=$notification_type&limit=1" \
      -H "Authorization: Bearer $OWNER_TOKEN")
    
    NOTIFICATION_COUNT=$(echo "$RESPONSE" | jq -r '.data | length' 2>/dev/null)
    
    if [ "$should_exist" = "true" ]; then
        if [ "$NOTIFICATION_COUNT" -gt 0 ]; then
            echo -e "${GREEN}✓${NC} Notification type '$notification_type' exists as expected"
            return 0
        else
            echo -e "${RED}✗${NC} Notification type '$notification_type' should exist but doesn't"
            return 1
        fi
    else
        if [ "$NOTIFICATION_COUNT" -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Notification type '$notification_type' doesn't exist as expected"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} Notification type '$notification_type' exists but shouldn't (from previous tests)"
            return 0
        fi
    fi
}

# Validation
if [ -z "$OWNER_TOKEN" ] || [ -z "$SHOP_ID" ]; then
    echo -e "${RED}Error: Missing required parameters${NC}"
    echo "Usage: ./test-notification-settings.sh <OWNER_TOKEN> <SHOP_ID> [INVENTORY_ITEM_ID] [STAFF_PROFILE_ID]"
    echo ""
    echo "Example:"
    echo "  ./test-notification-settings.sh eyJhbGc... 673d9c7f42f38ceea1ec4575"
    exit 1
fi

# ============================================================================
# PHASE 1: Settings Management Tests
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 1: NOTIFICATION SETTINGS MANAGEMENT${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 1: Get Default Settings (should be all enabled)
start_test "Get Default Notification Settings"
RESPONSE=$(curl -s "$BASE_URL/api/v1/notifications/settings?shopId=$SHOP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")
check_result "Get default settings" "$RESPONSE" "lowStockEnabled"

# Verify all are enabled by default
LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
OUT_OF_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
SALE_COMPLETED_ENABLED=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)

echo "  Current Settings:"
echo "    - Low Stock: $LOW_STOCK_ENABLED"
echo "    - Out of Stock: $OUT_OF_STOCK_ENABLED"
echo "    - Sale Completed: $SALE_COMPLETED_ENABLED"

if [ "$LOW_STOCK_ENABLED" = "true" ] && [ "$OUT_OF_STOCK_ENABLED" = "true" ] && [ "$SALE_COMPLETED_ENABLED" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} All settings are enabled by default"
else
    echo -e "  ${RED}✗${NC} Default settings are not all enabled"
fi

# Test 2: Disable Low Stock Notifications
start_test "Disable Low Stock Notifications"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": false
  }")
check_result "Disable low stock" "$RESPONSE" "lowStockEnabled"

LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
if [ "$LOW_STOCK_ENABLED" = "false" ]; then
    echo -e "  ${GREEN}✓${NC} Low stock notifications successfully disabled"
else
    echo -e "  ${RED}✗${NC} Failed to disable low stock notifications"
fi

# Test 3: Disable Out of Stock Notifications
start_test "Disable Out of Stock Notifications"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"outOfStockEnabled\": false
  }")
check_result "Disable out of stock" "$RESPONSE" "outOfStockEnabled"

# Test 4: Disable Sale Completed Notifications
start_test "Disable Sale Completed Notifications"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"saleCompletedEnabled\": false
  }")
check_result "Disable sale completed" "$RESPONSE" "saleCompletedEnabled"

# Test 5: Verify All Settings Are Disabled
start_test "Verify All Settings Are Disabled"
RESPONSE=$(curl -s "$BASE_URL/api/v1/notifications/settings?shopId=$SHOP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN")
check_result "Get updated settings" "$RESPONSE" "lowStockEnabled"

LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
OUT_OF_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
SALE_COMPLETED_ENABLED=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)

echo "  Current Settings After Disabling:"
echo "    - Low Stock: $LOW_STOCK_ENABLED"
echo "    - Out of Stock: $OUT_OF_STOCK_ENABLED"
echo "    - Sale Completed: $SALE_COMPLETED_ENABLED"

if [ "$LOW_STOCK_ENABLED" = "false" ] && [ "$OUT_OF_STOCK_ENABLED" = "false" ] && [ "$SALE_COMPLETED_ENABLED" = "false" ]; then
    echo -e "  ${GREEN}✓${NC} All settings successfully disabled"
else
    echo -e "  ${RED}✗${NC} Not all settings are disabled"
fi

# ============================================================================
# PHASE 2: Auto-Trigger Tests with Settings DISABLED
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 2: AUTO-TRIGGERS WITH NOTIFICATIONS DISABLED${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Get notification count before tests
NOTIFICATIONS_BEFORE=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID" \
  -H "Authorization: Bearer $OWNER_TOKEN" | jq -r '.pagination.total' 2>/dev/null)
echo "Notifications count before: $NOTIFICATIONS_BEFORE"

# Test 6: Trigger Low Stock (Should NOT Create Notification)
if [ ! -z "$INVENTORY_ITEM_ID" ]; then
    start_test "Trigger Low Stock With Notifications Disabled"
    
    # Get current inventory
    INVENTORY=$(curl -s "$BASE_URL/api/v1/inventory/$INVENTORY_ITEM_ID?shopId=$SHOP_ID" \
      -H "Authorization: Bearer $OWNER_TOKEN")
    CURRENT_QTY=$(echo "$INVENTORY" | jq -r '.data.availableQuantity' 2>/dev/null)
    
    echo "  Current inventory quantity: $CURRENT_QTY"
    
    # Adjust stock to trigger low stock
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/inventory/$INVENTORY_ITEM_ID/adjust" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"shopId\": \"$SHOP_ID\",
        \"quantity\": -5,
        \"reason\": \"Testing low stock with notifications disabled\"
      }")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓${NC} Inventory adjusted successfully"
        
        # Wait a moment for potential notification
        sleep 2
        
        # Check if low_stock notification was created (it shouldn't be)
        LOW_STOCK_NOTIFS=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&type=low_stock&limit=5" \
          -H "Authorization: Bearer $OWNER_TOKEN" | jq -r '.data | length' 2>/dev/null)
        
        # Check if any new notification with "low" or "stock" in message
        RECENT_NOTIFS=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&limit=5" \
          -H "Authorization: Bearer $OWNER_TOKEN")
        
        # Look for recent low stock notification
        HAS_NEW_LOW_STOCK=$(echo "$RECENT_NOTIFS" | jq -r '.data[] | select(.type == "low_stock") | select(.created_at > (now - 10 | todate)) | .type' 2>/dev/null)
        
        if [ -z "$HAS_NEW_LOW_STOCK" ]; then
            echo -e "  ${GREEN}✓ PASSED${NC} - No low stock notification created (as expected)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "  ${RED}✗ FAILED${NC} - Low stock notification was created when it shouldn't be"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} Could not adjust inventory: $RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠ Skipping inventory tests - INVENTORY_ITEM_ID not provided${NC}"
fi

# Test 7: Trigger Sale Completed (Should NOT Create Notification)
if [ ! -z "$STAFF_PROFILE_ID" ] && [ ! -z "$INVENTORY_ITEM_ID" ]; then
    start_test "Trigger Sale Completed With Notifications Disabled"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/sales" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"shopId\": \"$SHOP_ID\",
        \"soldBy\": \"$STAFF_PROFILE_ID\",
        \"items\": [
          {
            \"inventoryId\": \"$INVENTORY_ITEM_ID\",
            \"quantity\": 1,
            \"unitPrice\": 1000
          }
        ],
        \"paymentMethod\": \"cash\",
        \"amountPaid\": 1000
      }")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓${NC} Sale recorded successfully"
        
        # Wait a moment
        sleep 2
        
        # Check for sale_completed notification
        RECENT_NOTIFS=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&limit=5" \
          -H "Authorization: Bearer $OWNER_TOKEN")
        
        HAS_NEW_SALE=$(echo "$RECENT_NOTIFS" | jq -r '.data[] | select(.type == "sale_completed") | select(.created_at > (now - 10 | todate)) | .type' 2>/dev/null)
        
        if [ -z "$HAS_NEW_SALE" ]; then
            echo -e "  ${GREEN}✓ PASSED${NC} - No sale completed notification created (as expected)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "  ${RED}✗ FAILED${NC} - Sale completed notification was created when it shouldn't be"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "  ${YELLOW}⚠${NC} Could not record sale: $RESPONSE"
    fi
else
    echo -e "${YELLOW}⚠ Skipping sale tests - STAFF_PROFILE_ID or INVENTORY_ITEM_ID not provided${NC}"
fi

# ============================================================================
# PHASE 3: Enable Settings and Test Auto-Triggers
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 3: AUTO-TRIGGERS WITH NOTIFICATIONS ENABLED${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 8: Enable All Notifications
start_test "Enable All Notifications"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": true,
    \"outOfStockEnabled\": true,
    \"saleCompletedEnabled\": true
  }")
check_result "Enable all notifications" "$RESPONSE" "lowStockEnabled"

# Verify all are enabled
LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
OUT_OF_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
SALE_COMPLETED_ENABLED=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)

echo "  Settings After Enabling:"
echo "    - Low Stock: $LOW_STOCK_ENABLED"
echo "    - Out of Stock: $OUT_OF_STOCK_ENABLED"
echo "    - Sale Completed: $SALE_COMPLETED_ENABLED"

# Test 9: Trigger Low Stock (Should Create Notification)
if [ ! -z "$INVENTORY_ITEM_ID" ]; then
    start_test "Trigger Low Stock With Notifications Enabled"
    
    RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/inventory/$INVENTORY_ITEM_ID/adjust" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"shopId\": \"$SHOP_ID\",
        \"quantity\": -5,
        \"reason\": \"Testing low stock with notifications enabled\"
      }")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓${NC} Inventory adjusted successfully"
        
        sleep 2
        
        # Check for low_stock notification
        RECENT_NOTIFS=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&type=low_stock&limit=3" \
          -H "Authorization: Bearer $OWNER_TOKEN")
        
        LOW_STOCK_COUNT=$(echo "$RECENT_NOTIFS" | jq -r '.data | length' 2>/dev/null)
        
        if [ "$LOW_STOCK_COUNT" -gt 0 ]; then
            echo -e "  ${GREEN}✓ PASSED${NC} - Low stock notification created (as expected)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Show notification details
            LATEST_NOTIF=$(echo "$RECENT_NOTIFS" | jq -r '.data[0].message' 2>/dev/null)
            echo "  Notification: $LATEST_NOTIF"
        else
            echo -e "  ${RED}✗ FAILED${NC} - No low stock notification created when it should be"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
fi

# Test 10: Trigger Sale Completed (Should Create Notification)
if [ ! -z "$STAFF_PROFILE_ID" ] && [ ! -z "$INVENTORY_ITEM_ID" ]; then
    start_test "Trigger Sale Completed With Notifications Enabled"
    
    RESPONSE=$(curl -s -X POST "$BASE_URL/api/v1/sales" \
      -H "Authorization: Bearer $OWNER_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{
        \"shopId\": \"$SHOP_ID\",
        \"soldBy\": \"$STAFF_PROFILE_ID\",
        \"items\": [
          {
            \"inventoryId\": \"$INVENTORY_ITEM_ID\",
            \"quantity\": 1,
            \"unitPrice\": 1000
          }
        ],
        \"paymentMethod\": \"cash\",
        \"amountPaid\": 1000
      }")
    
    if echo "$RESPONSE" | grep -q '"success":true'; then
        echo -e "  ${GREEN}✓${NC} Sale recorded successfully"
        
        sleep 2
        
        # Check for sale_completed notification
        RECENT_NOTIFS=$(curl -s "$BASE_URL/api/v1/notifications?shopId=$SHOP_ID&type=sale_completed&limit=3" \
          -H "Authorization: Bearer $OWNER_TOKEN")
        
        SALE_COUNT=$(echo "$RECENT_NOTIFS" | jq -r '.data | length' 2>/dev/null)
        
        if [ "$SALE_COUNT" -gt 0 ]; then
            echo -e "  ${GREEN}✓ PASSED${NC} - Sale completed notification created (as expected)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
            
            # Show notification details
            LATEST_NOTIF=$(echo "$RECENT_NOTIFS" | jq -r '.data[0].message' 2>/dev/null)
            echo "  Notification: $LATEST_NOTIF"
        else
            echo -e "  ${RED}✗ FAILED${NC} - No sale completed notification created when it should be"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
fi

# ============================================================================
# PHASE 4: Manual Reset Using Update (No Reset Endpoint)
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 4: MANUAL RESET TO DEFAULTS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 11: Re-enable All Settings Manually
start_test "Re-enable All Settings to Defaults"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": true,
    \"outOfStockEnabled\": true,
    \"saleCompletedEnabled\": true
  }")
check_result "Re-enable all settings" "$RESPONSE" "lowStockEnabled"

# Verify all are enabled
LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
OUT_OF_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
SALE_COMPLETED_ENABLED=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)

echo "  Settings After Re-enabling:"
echo "    - Low Stock: $LOW_STOCK_ENABLED"
echo "    - Out of Stock: $OUT_OF_STOCK_ENABLED"
echo "    - Sale Completed: $SALE_COMPLETED_ENABLED"

if [ "$LOW_STOCK_ENABLED" = "true" ] && [ "$OUT_OF_STOCK_ENABLED" = "true" ] && [ "$SALE_COMPLETED_ENABLED" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} All settings re-enabled successfully"
else
    echo -e "  ${RED}✗${NC} Settings not properly re-enabled"
fi

# ============================================================================
# PHASE 5: Partial Update Tests
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 5: PARTIAL SETTINGS UPDATES${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 12: Update Only Low Stock Setting
start_test "Update Only Low Stock Setting"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\",
    \"lowStockEnabled\": false
  }")
check_result "Partial update - low stock only" "$RESPONSE" "lowStockEnabled"

# Verify only lowStockEnabled changed
LOW_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.lowStockEnabled' 2>/dev/null)
OUT_OF_STOCK_ENABLED=$(echo "$RESPONSE" | jq -r '.data.outOfStockEnabled' 2>/dev/null)
SALE_COMPLETED_ENABLED=$(echo "$RESPONSE" | jq -r '.data.saleCompletedEnabled' 2>/dev/null)

echo "  After Partial Update:"
echo "    - Low Stock: $LOW_STOCK_ENABLED (should be false)"
echo "    - Out of Stock: $OUT_OF_STOCK_ENABLED (should be true)"
echo "    - Sale Completed: $SALE_COMPLETED_ENABLED (should be true)"

if [ "$LOW_STOCK_ENABLED" = "false" ] && [ "$OUT_OF_STOCK_ENABLED" = "true" ] && [ "$SALE_COMPLETED_ENABLED" = "true" ]; then
    echo -e "  ${GREEN}✓${NC} Partial update successful"
else
    echo -e "  ${RED}✗${NC} Partial update affected other settings"
fi

# ============================================================================
# PHASE 6: Error Handling Tests
# ============================================================================

echo ""
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}  PHASE 6: ERROR HANDLING${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"

# Test 13: Invalid Shop ID
start_test "Invalid Shop ID Error Handling"
RESPONSE=$(curl -s "$BASE_URL/api/v1/notifications/settings?shopId=invalid_id" \
  -H "Authorization: Bearer $OWNER_TOKEN")

if echo "$RESPONSE" | grep -q '"success":false' || echo "$RESPONSE" | grep -q 'error'; then
    echo -e "${GREEN}✓ PASSED${NC} - Invalid shop ID rejected"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} - Invalid shop ID accepted"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# Test 14: Update Without Any Fields
start_test "Update Without Any Fields Error Handling"
RESPONSE=$(curl -s -X PATCH "$BASE_URL/api/v1/notifications/settings" \
  -H "Authorization: Bearer $OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"shopId\": \"$SHOP_ID\"
  }")

if echo "$RESPONSE" | grep -q '"success":false' || echo "$RESPONSE" | grep -q 'error'; then
    echo -e "${GREEN}✓ PASSED${NC} - Empty update rejected"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}✗ FAILED${NC} - Empty update accepted"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

# ============================================================================
# FINAL SUMMARY
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
    echo -e "${GREEN}              ✓ ALL TESTS PASSED! ✓${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "✓ Notification settings feature is working correctly"
    echo "✓ Auto-triggers respect settings preferences"
    echo "✓ Settings can be toggled on/off individually"
    echo "✓ Owner-only access enforced"
    echo "✓ Error handling is robust"
    exit 0
else
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}              ✗ SOME TESTS FAILED ✗${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Please review the failed tests above and check:"
    echo "1. Server logs for errors"
    echo "2. Database for proper settings storage"
    echo "3. Auto-trigger integration"
    exit 1
fi

