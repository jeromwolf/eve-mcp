#!/usr/bin/env python3
import requests
from bs4 import BeautifulSoup
import json

def search_adams(query, max_results=10):
    """ADAMS 웹사이트에서 실제 검색"""
    
    # ADAMS 공개 검색 URL
    search_url = "https://www.nrc.gov/reading-rm/adams/web-based-adams.html"
    
    # 실제 검색 엔드포인트
    api_url = "https://adams.nrc.gov/wba/services/search/advanced/nrc"
    
    # 세션 생성 (쿠키 유지)
    session = requests.Session()
    session.headers.update({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://adams.nrc.gov/wba/'
    })
    
    # 먼저 메인 페이지 방문 (세션 초기화)
    try:
        main_page = session.get("https://adams.nrc.gov/wba/")
        print(f"Main page status: {main_page.status_code}")
    except Exception as e:
        print(f"Failed to access main page: {e}")
        return []
    
    # 검색 쿼리 구성
    search_data = {
        "savedQueryName": "",
        "mode": "sections",
        "q": "",
        "qn": False,
        "sections": {
            "filters": {
                "public-submission": False
            },
            "properties_search_all": [
                {
                    "name": "properties_search_all",
                    "searchOperator": "contains",
                    "type": "text",
                    "value": query
                }
            ]
        }
    }
    
    # 검색 실행
    try:
        response = session.post(
            api_url,
            json=search_data,
            timeout=30
        )
        print(f"Search status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            
            # 결과 파싱
            results = []
            if 'resultList' in data:
                for item in data['resultList'][:max_results]:
                    result = {
                        'documentNumber': item.get('AccessionNumber', ''),
                        'title': item.get('DocumentTitle', ''),
                        'date': item.get('DocumentDate', ''),
                        'type': item.get('DocumentType', ''),
                        'pdfUrl': f"https://adams.nrc.gov/wba/services/document/{item.get('AccessionNumber', '')}/content/downloadContent"
                    }
                    results.append(result)
                    print(f"Found: {result['documentNumber']} - {result['title']}")
            else:
                print("No results found in response")
                print(f"Response keys: {data.keys() if isinstance(data, dict) else 'Not a dict'}")
                
            return results
            
    except requests.exceptions.RequestException as e:
        print(f"Search failed: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON: {e}")
        print(f"Response text: {response.text[:500]}")
        return []

def download_pdf(doc_number, session=None):
    """ADAMS에서 PDF 다운로드"""
    if not session:
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        })
    
    # 여러 가능한 PDF URL 형식 시도
    pdf_urls = [
        f"https://adams.nrc.gov/wba/services/document/{doc_number}/content/downloadContent",
        f"https://adamswebsearch2.nrc.gov/IDMWS/ViewDocByAccession.asp?AccessionNumber={doc_number}",
        f"https://adams.nrc.gov/wba/services/document/{doc_number}/pdf"
    ]
    
    for url in pdf_urls:
        print(f"Trying: {url}")
        try:
            response = session.get(url, timeout=30, allow_redirects=True)
            if response.status_code == 200 and len(response.content) > 1000:
                # PDF 시그니처 확인
                if response.content[:4] == b'%PDF':
                    print(f"✓ Downloaded PDF from: {url}")
                    return response.content
                else:
                    print(f"  Not a PDF (first bytes: {response.content[:20]})")
            else:
                print(f"  Failed: {response.status_code}")
        except Exception as e:
            print(f"  Error: {e}")
    
    return None

if __name__ == "__main__":
    # 테스트 검색
    print("=" * 50)
    print("Testing ADAMS Search")
    print("=" * 50)
    
    results = search_adams("emergency plan", max_results=5)
    
    if results:
        print(f"\nFound {len(results)} documents")
        
        # 첫 번째 문서 다운로드 시도
        if results[0]['documentNumber']:
            print(f"\nTrying to download: {results[0]['documentNumber']}")
            pdf_content = download_pdf(results[0]['documentNumber'])
            
            if pdf_content:
                filename = f"{results[0]['documentNumber']}.pdf"
                with open(filename, 'wb') as f:
                    f.write(pdf_content)
                print(f"✓ Saved to {filename}")
            else:
                print("✗ Download failed")
    else:
        print("No results found")