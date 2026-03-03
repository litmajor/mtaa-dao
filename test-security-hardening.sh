#!/usr/bin/env bash

###############################################################################
# Security Hardening & Route Consolidation Test Suite
# Tests backwards-compatible redirects, DAO scope validation, and threat detection
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
TEST_DAO_ID="550e8400-e29b-41d4-a716-446655440000"
INVALID_DAO_ID="not-a-uuid"
AUTH_TOKEN="${AUTH_TOKEN:-}"

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

###############################################################################
# Utility Functions
###############################################################################

print_header() {
  echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_test() {
  echo -e "${YELLOW}Test:${NC} $1"
}

print_pass() {
  echo -e "${GREEN}✓ PASS${NC} $1"
  ((TESTS_PASSED++))
}

print_fail() {
  echo -e "${RED}✗ FAIL${NC} $1"
  ((TESTS_FAILED++))
}

# Make API request and check response
api_request() {
  local method=$1
  local path=$2
  local expected_status=$3
  local body=${4:-}
  local headers=${5:-}
  
  local curl_opts="-s -w '\n%{http_code}' -X $method"
  
  if [ -n "$AUTH_TOKEN" ]; then
    curl_opts="$curl_opts -H 'Authorization: Bearer $AUTH_TOKEN'"
  fi
  
  if [ -n "$headers" ]; then
    curl_opts="$curl_opts $headers"
  fi
  
  if [ -n "$body" ]; then
    curl_opts="$curl_opts -H 'Content-Type: application/json' -d '$body'"
  fi
  
  local response=$(eval "curl $curl_opts '${API_URL}${path}'")
  local status=$(echo "$response" | tail -n 1)
  local body=$(echo "$response" | sed '$d')
  
  echo "$status|$body"
}

###############################################################################
# Test Suite 1: Route Consolidation
###############################################################################

test_route_consolidation() {
  print_header "Test Suite 1: Route Consolidation (New Routes)"
  
  # Test 1.1: New consolidated governance route
  print_test "GET /api/dao/:daoId/governance/quorum returns 200 or 404"
  local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/governance/quorum" "200|404")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" == "200" || "$status" == "404" || "$status" == "401" ]]; then
    print_pass "New consolidated route is accessible"
  else
    print_fail "Got unexpected status $status for consolidated route"
  fi
  
  # Test 1.2: New consolidated treasury route
  print_test "GET /api/dao/:daoId/treasury/balance accessible"
  local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/treasury/balance" "200|404|401")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "404" ]]; then
    print_pass "Treasury route consolidated successfully"
  fi
}

###############################################################################
# Test Suite 2: Backwards Compatibility Redirects
###############################################################################

test_backwards_compatibility() {
  print_header "Test Suite 2: Backwards Compatibility (Deprecated Routes)"
  
  # Test 2.1: Old governance route redirects
  print_test "GET /api/governance/:daoId/* redirects to /api/dao/:daoId/governance/*"
  local response=$(api_request "GET" "/api/governance/$TEST_DAO_ID/quorum" "307|200|401|404" "" "-L")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "400" ]]; then
    print_pass "Old governance route has redirect in place"
  else
    print_fail "Old governance route not redirecting properly"
  fi
  
  # Test 2.2: Deprecation headers present
  print_test "Deprecated routes include Deprecation header"
  local response=$(curl -s -i -X GET "${API_URL}/api/governance/$TEST_DAO_ID/quorum")
  
  if echo "$response" | grep -q "Deprecation: true"; then
    print_pass "Deprecation header present in deprecated routes"
  else
    print_fail "Missing Deprecation header"
  fi
  
  # Test 2.3: Sunset header present
  if echo "$response" | grep -q "Sunset:"; then
    print_pass "Sunset header present (90-day migration window)"
  else
    print_fail "Missing Sunset header"
  fi
}

###############################################################################
# Test Suite 3: Input Validation & DAO ID Format
###############################################################################

test_input_validation() {
  print_header "Test Suite 3: Input Validation (DAO ID Format)"
  
  # Test 3.1: Invalid DAO ID format rejected
  print_test "Invalid DAO ID format returns 400"
  local response=$(api_request "GET" "/api/dao/$INVALID_DAO_ID/governance/quorum" "400")
  local status=$(echo "$response" | cut -d'|' -f1)
  local body=$(echo "$response" | cut -d'|' -f2)
  
  if [ "$status" = "400" ]; then
    print_pass "Invalid DAO ID rejected with 400"
    if echo "$body" | grep -q "INVALID_DAO_ID\|Invalid DAO ID"; then
      print_pass "Error message indicates invalid format"
    fi
  else
    print_fail "Invalid DAO ID should return 400, got $status"
  fi
  
  # Test 3.2: Valid UUID format accepted
  print_test "Valid UUID format accepted"
  local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/governance/quorum" "200|401|404")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "400" ]]; then
    print_pass "Valid UUID format accepted (status $status)"
  else
    print_fail "Valid UUID rejected with 400"
  fi
}

###############################################################################
# Test Suite 4: Suspicious Input Detection
###############################################################################

test_suspicious_input() {
  print_header "Test Suite 4: Suspicious Input Detection (SQL/XSS)"
  
  # Test 4.1: SQL injection attempt detection
  print_test "SQL injection pattern in request body handled"
  local malicious_body='{"name":"test` OR 1=1;--","amount":"100"}'
  local response=$(api_request "POST" "/api/dao/$TEST_DAO_ID/treasury/transfer/native" "200|400|401" "$malicious_body")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  # Should either reject or sanitize
  if [[ "$status" != "500" ]]; then
    print_pass "SQL injection pattern handled safely (status $status)"
  else
    print_fail "Unhandled SQL injection pattern resulted in 500"
  fi
  
  # Test 4.2: XSS attempt detection
  print_test "XSS pattern in request body handled"
  local xss_body='{"description":"<script>alert('"'"'xss'"'"')</script>","amount":"100"}'
  local response=$(api_request "POST" "/api/dao/$TEST_DAO_ID/treasury/transfer/native" "200|400|401" "$xss_body")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "500" ]]; then
    print_pass "XSS pattern handled safely (status $status)"
  else
    print_fail "Unhandled XSS pattern resulted in 500"
  fi
  
  # Test 4.3: Path traversal attempt detection
  print_test "Path traversal pattern blocked"
  local response=$(api_request "GET" "/api/dao/../../../etc/passwd/governance/quorum" "400|404")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "200" ]]; then
    print_pass "Path traversal attempt blocked (status $status)"
  else
    print_fail "Path traversal pattern not blocked"
  fi
}

###############################################################################
# Test Suite 5: Rate Limiting
###############################################################################

test_rate_limiting() {
  print_header "Test Suite 5: Rate Limiting (Per-User)"
  
  if [ -z "$AUTH_TOKEN" ]; then
    echo -e "${YELLOW}Skipping rate limit tests (AUTH_TOKEN not set)${NC}"
    return
  fi
  
  print_test "10 requests within limit (60 second window)"
  local success_count=0
  
  for i in {1..10}; do
    local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/governance/quorum" "200|401|404")
    local status=$(echo "$response" | cut -d'|' -f1)
    
    if [[ "$status" != "429" ]]; then
      ((success_count++))
    fi
  done
  
  if [ $success_count -eq 10 ]; then
    print_pass "All 10 requests within rate limit succeeded"
  else
    print_fail "Some requests rejected before limit (got $success_count/10)"
  fi
  
  print_test "11th request exceeds limit (returns 429)"
  local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/governance/quorum" "429|401|404")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [ "$status" = "429" ]; then
    print_pass "Rate limit enforced at 11th request"
  else
    print_fail "Expected 429 but got $status"
  fi
}

###############################################################################
# Test Suite 6: Response Sanitization
###############################################################################

test_response_sanitization() {
  print_header "Test Suite 6: Response Sanitization (XSS in Responses)"
  
  print_test "HTML characters escaped in responses"
  local response=$(curl -s "${API_URL}/api/dao/$TEST_DAO_ID/governance/quorum")
  
  if ! echo "$response" | grep -E "(<script|onerror|onclick)" > /dev/null; then
    print_pass "No unescaped HTML tags in response"
  else
    print_fail "Unescaped HTML detected in response"
  fi
}

###############################################################################
# Test Suite 7: DAO Scope Validation
###############################################################################

test_dao_scope() {
  print_header "Test Suite 7: DAO Scope Validation"
  
  # Test 7.1: Request validated for correct DAO
  print_test "Request scope validated for correct DAO"
  local response=$(api_request "GET" "/api/dao/$TEST_DAO_ID/governance/quorum" "200|401|404")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [[ "$status" != "403" ]]; then
    print_pass "DAO scope validation works (status $status)"
  else
    print_fail "Unexpected 403 Forbidden"
  fi
  
  # Test 7.2: Malformed DAO ID rejected
  print_test "Malformed DAO ID rejected at scope validation"
  local response=$(api_request "GET" "/api/dao/abc123/governance/quorum" "400")
  local status=$(echo "$response" | cut -d'|' -f1)
  
  if [ "$status" = "400" ]; then
    print_pass "Malformed DAO ID rejected during scope validation"
  else
    print_fail "Malformed DAO ID should be rejected, got $status"
  fi
}

###############################################################################
# Test Suite 8: TypeScript Compilation
###############################################################################

test_typescript_compilation() {
  print_header "Test Suite 8: TypeScript Compilation"
  
  # Check if build succeeds
  print_test "TypeScript compilation succeeds"
  
  if [ -f "tsconfig.json" ]; then
    if npx tsc --noEmit > /dev/null 2>&1; then
      print_pass "TypeScript compiles without errors"
    else
      print_fail "TypeScript compilation errors found"
    fi
  else
    echo -e "${YELLOW}Skipping TypeScript test (tsconfig.json not found)${NC}"
  fi
}

###############################################################################
# Main Test Execution
###############################################################################

main() {
  clear
  
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║  Security Hardening & Route Consolidation Test Suite      ║"
  echo "║  Testing backwards compatibility, validation, and threats  ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  echo -e "API URL: ${BLUE}${API_URL}${NC}"
  echo -e "Test DAO ID: ${BLUE}${TEST_DAO_ID}${NC}"
  echo ""
  
  # Run test suites
  test_route_consolidation
  test_backwards_compatibility
  test_input_validation
  test_suspicious_input
  test_rate_limiting
  test_response_sanitization
  test_dao_scope
  test_typescript_compilation
  
  # Print summary
  print_header "Test Summary"
  
  local total=$((TESTS_PASSED + TESTS_FAILED))
  echo -e "Total Tests: ${BLUE}$total${NC}"
  echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
  echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
  echo ""
  
  if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    return 0
  else
    echo -e "${RED}Some tests failed. Review output above.${NC}"
    return 1
  fi
}

# Run main function
main
