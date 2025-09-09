import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 검색 키워드를 안전한 폴더명으로 변환
 * @param keyword 원본 검색 키워드
 * @returns 파일시스템에 안전한 폴더명
 */
export function sanitizeKeywordForFolder(keyword: string): string {
  // 공백을 언더스코어로, 특수문자 제거
  let folderName = keyword
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')                    // 공백을 언더스코어로
    .replace(/[^a-z0-9_\-]/g, '')           // 영문, 숫자, _, - 만 허용
    .replace(/_{2,}/g, '_')                  // 연속된 언더스코어 제거
    .replace(/^_|_$/g, '');                  // 시작/끝 언더스코어 제거
  
  // 폴더명이 비어있거나 너무 짧으면 기본값
  if (!folderName || folderName.length < 3) {
    folderName = 'general';
  }
  
  // 최대 길이 제한 (50자)
  if (folderName.length > 50) {
    folderName = folderName.substring(0, 50);
  }
  
  // 날짜 추가 (중복 방지)
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `${folderName}_${date}`;
}

/**
 * 키워드 기반 다운로드 경로 생성
 * @param keyword 검색 키워드
 * @param documentNumber 문서 번호
 * @param baseDir 기본 다운로드 디렉토리
 * @returns 전체 파일 경로
 */
export async function createKeywordDownloadPath(
  keyword: string,
  documentNumber: string,
  baseDir: string = ''
): Promise<string> {
  // baseDir이 비어있으면 기본 경로 사용
  if (!baseDir) {
    baseDir = path.join(__dirname, '..', 'downloaded_pdfs');
  }
  
  // 키워드 폴더명 생성
  const keywordFolder = sanitizeKeywordForFolder(keyword);
  
  // 전체 디렉토리 경로
  const dirPath = path.join(baseDir, keywordFolder);
  
  // 디렉토리 생성 (존재하지 않으면)
  await fs.mkdir(dirPath, { recursive: true });
  
  // 전체 파일 경로
  const filePath = path.join(dirPath, `${documentNumber}.pdf`);
  
  return filePath;
}

/**
 * 다운로드 폴더 구조 정보 가져오기
 * @param baseDir 기본 다운로드 디렉토리
 * @returns 폴더 구조 정보
 */
export async function getDownloadFolderStructure(
  baseDir: string = ''
): Promise<{ [folder: string]: { files: string[], count: number, totalSize: number } }> {
  // baseDir이 비어있으면 기본 경로 사용
  if (!baseDir) {
    baseDir = path.join(__dirname, '..', 'downloaded_pdfs');
  }
  const structure: { [folder: string]: { files: string[], count: number, totalSize: number } } = {};
  
  try {
    // 기본 디렉토리 읽기
    const folders = await fs.readdir(baseDir, { withFileTypes: true });
    
    for (const folder of folders) {
      if (folder.isDirectory()) {
        const folderPath = path.join(baseDir, folder.name);
        const files = await fs.readdir(folderPath);
        
        let totalSize = 0;
        const pdfFiles: string[] = [];
        
        for (const file of files) {
          if (file.endsWith('.pdf')) {
            const filePath = path.join(folderPath, file);
            const stats = await fs.stat(filePath);
            totalSize += stats.size;
            pdfFiles.push(file);
          }
        }
        
        structure[folder.name] = {
          files: pdfFiles,
          count: pdfFiles.length,
          totalSize: Math.round(totalSize / 1024) // KB 단위
        };
      }
    }
  } catch (error) {
    // console.error('Error reading folder structure:', error);
  }
  
  return structure;
}

/**
 * 키워드별 다운로드 통계
 * @param baseDir 기본 다운로드 디렉토리
 * @returns 통계 정보
 */
export async function getKeywordStatistics(
  baseDir: string = ''
): Promise<{
  totalKeywords: number,
  totalDocuments: number,
  totalSizeKB: number,
  keywords: Array<{ name: string, documents: number, sizeKB: number }>
}> {
  const structure = await getDownloadFolderStructure(baseDir);
  
  const keywords = Object.entries(structure).map(([name, data]) => ({
    name,
    documents: data.count,
    sizeKB: data.totalSize
  }));
  
  const totalDocuments = keywords.reduce((sum, k) => sum + k.documents, 0);
  const totalSizeKB = keywords.reduce((sum, k) => sum + k.sizeKB, 0);
  
  return {
    totalKeywords: keywords.length,
    totalDocuments,
    totalSizeKB,
    keywords: keywords.sort((a, b) => b.documents - a.documents)
  };
}