#!/bin/bash

echo "🧪 EVE MCP 전체 기능 테스트"
echo "=========================="
echo

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 빌드
echo "🔨 빌드 중..."
npm run build > /dev/null 2>&1

# 1. 기본 연결 테스트
echo -e "\n${YELLOW}1. 서버 연결 테스트${NC}"
response=$(echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node build/index.js 2>/dev/null | head -1)
if echo "$response" | grep -q "search_papers"; then
    echo -e "${GREEN}✅ 서버 정상 작동${NC}"
else
    echo -e "${RED}❌ 서버 연결 실패${NC}"
    exit 1
fi

# 2. 검색 테스트
echo -e "\n${YELLOW}2. arXiv 논문 검색${NC}"
search_response=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"search_papers","arguments":{"query":"attention mechanism","max_results":2}},"id":2}' | node build/index.js 2>/dev/null | head -1)
if echo "$search_response" | grep -q "Found"; then
    echo -e "${GREEN}✅ 검색 성공${NC}"
    # 검색 결과 일부 표시
    echo "$search_response" | jq -r '.result.content[0].text' 2>/dev/null | head -3
else
    echo -e "${RED}❌ 검색 실패${NC}"
fi

# 3. PDF 목록 (빈 상태)
echo -e "\n${YELLOW}3. PDF 목록 확인 (빈 상태)${NC}"
list_response=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_downloaded_pdfs","arguments":{}},"id":3}' | node build/index.js 2>/dev/null | head -1)
if echo "$list_response" | grep -q "Cache Usage"; then
    echo -e "${GREEN}✅ 캐시 상태 표시${NC}"
    echo "$list_response" | jq -r '.result.content[0].text' 2>/dev/null | head -2
else
    echo -e "${RED}❌ 캐시 상태 미표시${NC}"
fi

# 4. 실제 PDF 다운로드 (선택적)
echo -e "\n${YELLOW}4. PDF 다운로드 테스트${NC}"
echo -e "${YELLOW}참고: 실제 다운로드는 네트워크 상황에 따라 10-30초 걸릴 수 있습니다${NC}"
read -p "실제 PDF 다운로드를 테스트하시겠습니까? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Transformer 논문(Attention is All You Need) 다운로드 중..."
    download_response=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"download_pdf","arguments":{"url":"https://arxiv.org/pdf/1706.03762.pdf"}},"id":4}' | timeout 30 node build/index.js 2>/dev/null | head -1)
    
    if echo "$download_response" | grep -q "successfully"; then
        echo -e "${GREEN}✅ PDF 다운로드 성공${NC}"
        echo "$download_response" | jq -r '.result.content[0].text' 2>/dev/null | grep -E "(Filename|Pages)" | head -2
        
        # 5. 질의응답 테스트
        echo -e "\n${YELLOW}5. PDF 질의응답 테스트${NC}"
        qa_response=$(echo '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"ask_about_pdf","arguments":{"question":"What is self-attention?"}},"id":5}' | node build/index.js 2>/dev/null | head -1)
        
        if echo "$qa_response" | grep -q "self-attention"; then
            echo -e "${GREEN}✅ 질의응답 성공${NC}"
            echo "$qa_response" | jq -r '.result.content[0].text' 2>/dev/null | head -5
        else
            echo -e "${RED}❌ 질의응답 실패${NC}"
        fi
    else
        echo -e "${RED}❌ PDF 다운로드 실패${NC}"
    fi
else
    echo "다운로드 테스트 건너뜀"
fi

echo -e "\n=========================="
echo -e "${GREEN}✅ 테스트 완료${NC}"