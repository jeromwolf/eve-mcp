#!/bin/bash

echo "🧪 EVE MCP 자동 테스트 시작"
echo "=========================="
echo

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 테스트 카운터
PASSED=0
FAILED=0

# 테스트 함수
test_mcp() {
    local test_name=$1
    local request=$2
    local expected_pattern=$3
    
    echo -n "🔍 테스트: $test_name ... "
    
    # MCP 서버에 요청 보내기
    if command -v timeout &> /dev/null; then
        response=$(echo "$request" | timeout 10 node build/index.js 2>&1)
    elif command -v gtimeout &> /dev/null; then
        response=$(echo "$request" | gtimeout 10 node build/index.js 2>&1)
    else
        # timeout 없이 실행 (위험: 무한 대기 가능)
        response=$(echo "$request" | node build/index.js 2>&1)
    fi
    
    # 응답 확인
    if echo "$response" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ 성공${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}❌ 실패${NC}"
        echo "   예상: $expected_pattern"
        echo "   실제: $(echo "$response" | head -1)"
        ((FAILED++))
        return 1
    fi
}

# 빌드 확인
echo "1️⃣ 빌드 상태 확인"
if [ ! -f "build/index.js" ]; then
    echo -e "${YELLOW}빌드가 필요합니다. npm run build 실행 중...${NC}"
    npm run build
fi
echo

# 기본 서버 테스트
echo "2️⃣ MCP 서버 기본 테스트"
test_mcp "서버 시작" \
    '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
    '"search_papers"'

test_mcp "도구 목록" \
    '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
    '"download_pdf"'
echo

# 검색 테스트
echo "3️⃣ 논문 검색 테스트"
test_mcp "arXiv 검색" \
    '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_papers","arguments":{"query":"machine learning","max_results":2}},"id":2}' \
    'Found.*papers'

test_mcp "PubMed 검색" \
    '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_papers","arguments":{"query":"COVID","site":"pubmed","max_results":2}},"id":3}' \
    'pubmed'
echo

# PDF 다운로드 테스트 (실제 다운로드는 시간이 걸림)
echo "4️⃣ PDF 다운로드 테스트"
echo -e "${YELLOW}참고: 실제 PDF 다운로드는 네트워크 상황에 따라 시간이 걸릴 수 있습니다${NC}"
test_mcp "PDF URL 형식 확인" \
    '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"download_pdf","arguments":{"url":"invalid-url"}},"id":4}' \
    'error'
echo

# 결과 요약
echo "=============================="
echo "📊 테스트 결과 요약"
echo "=============================="
echo -e "성공: ${GREEN}$PASSED${NC}"
echo -e "실패: ${RED}$FAILED${NC}"
echo -e "총계: $((PASSED + FAILED))"
echo

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 모든 테스트를 통과했습니다!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  일부 테스트가 실패했습니다${NC}"
    exit 1
fi