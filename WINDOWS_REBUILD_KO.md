# Windows 사용자를 위한 재빌드 가이드

## 🚨 중요 발견

**문제**: `build` 폴더는 Git에 포함되지 않습니다!
- `git clone`으로 받아지는 것: 소스 코드 (.ts 파일)
- `build` 폴더: 직접 빌드해야 생성됨
- 기존 `build` 폴더가 있다면: **옛날 코드입니다!**

## ✅ 해결 방법

### 방법 1: 배치 파일 사용 (추천)

1. **파일 다운로드**:
   ```
   https://github.com/jeromwolf/eve-mcp/raw/main/force-rebuild-windows.bat
   ```

2. **실행**:
   - `force-rebuild-windows.bat` 파일을 더블클릭
   - 또는 관리자 권한 CMD에서:
   ```cmd
   cd C:\Users\erica\Desktop\jeromspace\eve-mcp
   force-rebuild-windows.bat
   ```

3. **확인**:
   - "✅ 버전 확인 성공!" 메시지 확인
   - Claude Desktop 재시작
   - "small modular reactor 검색해줘" 테스트

### 방법 2: 수동 빌드

```cmd
:: 1. 관리자 권한 CMD 실행

:: 2. 프로젝트 폴더로 이동
cd C:\Users\erica\Desktop\jeromspace\eve-mcp

:: 3. 프로세스 종료
taskkill /f /im Claude.exe
taskkill /f /im node.exe
taskkill /f /im chrome.exe
timeout /t 3

:: 4. build 폴더 완전 삭제
rmdir /s /q build

:: 5. 의존성 설치 (선택)
npm install

:: 6. 빌드
npm run build

:: 7. 버전 확인
findstr "CODE VERSION" build\adams-real-improved.js
```

**기대 결과**:
```
logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
```

## 🔍 버전 확인 방법

### 빌드 파일 확인
```cmd
findstr "CODE VERSION" build\adams-real-improved.js
```

**올바른 출력**:
```javascript
logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
```

**잘못된 경우**:
- 아무것도 안 나옴 → 옛날 빌드
- 다른 버전 → 재빌드 필요

### 로그 파일 확인

빌드 후 Claude Desktop을 재시작하고 검색을 실행한 다음:

```cmd
type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
```

**기대 결과**:
```json
{"message":"🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)"}
```

## 📊 성공 시나리오

1. **재빌드 실행**:
   ```cmd
   force-rebuild-windows.bat
   ```

2. **빌드 확인**:
   ```
   ✅ 버전 확인 성공!
   logger.info('🔄 CODE VERSION: 2025-11-06-v2 (Windows detached frame fix)');
   ```

3. **Claude Desktop 재시작**

4. **검색 테스트**:
   ```
   "small modular reactor 검색해줘"
   ```

5. **로그 확인**:
   ```cmd
   type logs\mcp\mcp-server-*.log | findstr "CODE VERSION"
   ```

   **기대 로그**:
   ```json
   {"message":"🔄 CODE VERSION: 2025-11-06-v2"}
   {"message":"✅ Page navigation completed"}
   {"message":"✅ Evaluation successful, found 25 documents"}
   ```

6. **결과 확인**:
   ```
   📊 Found 25 documents
   1. ML22117A023 - ...
   2. ML25136A329 - ...
   ```

## ❌ 문제 해결

### "build 폴더 삭제 실패"
```cmd
:: 프로세스 다시 종료
taskkill /f /im node.exe
taskkill /f /im Claude.exe
timeout /t 5

:: 폴더명 변경 후 삭제
ren build build_old
rmdir /s /q build_old
```

### "npm install 실패"
```cmd
:: node_modules 삭제 후 재설치
rmdir /s /q node_modules
npm cache clean --force
npm install
```

### "npm run build 실패"
```cmd
:: TypeScript 버전 확인
npx tsc --version

:: 재설치
npm install --save-dev typescript
npm run build
```

### "버전 마커를 찾을 수 없습니다"
```cmd
:: 소스 파일 확인 (있어야 함)
findstr "CODE VERSION" src\adams-real-improved.ts

:: 빌드 파일 확인 (없으면 재빌드 필요)
findstr "CODE VERSION" build\adams-real-improved.js

:: 다시 빌드
rmdir /s /q build
npm run build
```

## 📋 체크리스트

- [ ] `force-rebuild-windows.bat` 실행
- [ ] "✅ 버전 확인 성공!" 메시지 확인
- [ ] `build\adams-real-improved.js`에서 "2025-11-06-v2" 확인
- [ ] Claude Desktop 재시작
- [ ] 검색 테스트 실행
- [ ] 로그에서 "CODE VERSION: 2025-11-06-v2" 확인
- [ ] 검색 결과 25개 이상 나오는지 확인

## 🎯 핵심 포인트

1. **git clone만으로는 부족**:
   - 소스 코드만 받아짐
   - build 폴더는 직접 생성해야 함

2. **기존 build 폴더는 삭제**:
   - 옛날 JavaScript 파일이 남아있음
   - 완전히 삭제 후 재빌드

3. **버전 확인은 필수**:
   - 빌드 파일에서 "CODE VERSION" 검색
   - 로그 파일에서 "CODE VERSION" 확인
   - 둘 다 "2025-11-06-v2" 나와야 함

4. **Claude Desktop 재시작**:
   - 새 빌드 파일 로드하려면 필수
   - 완전 종료 후 재시작

---

**문제가 계속되면**:
- 로그 파일을 GitHub Issue에 올려주세요
- `logs\mcp\mcp-server-*.log` 전체 내용
- 빌드 과정 스크린샷
