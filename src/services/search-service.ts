import { ImprovedADAMSScraper } from '../adams-real-improved.js';
import mcpLogger from '../mcp-logger.js';
import { configManager } from '../server/config.js';
import { cacheManager } from './cache-manager.js';

interface SearchResult {
  title: string;
  documentNumber?: string;
  accessionNumber: string;
  date?: string;
  docketNumber?: string;
  url?: string;
  relevanceScore?: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalFound: number;
  searchQuery: string;
  searchTime: number;
  cached: boolean;
}

interface SearchStats {
  totalSearches: number;
  cacheHitRate: number;
  averageResults: number;
  averageSearchTime: number;
  mostPopularKeywords: string[];
}

export class SearchService {
  private scraper: ImprovedADAMSScraper | null = null;
  private readonly config;
  private searchStats: {
    totalSearches: number;
    totalCacheHits: number;
    totalResults: number;
    totalSearchTime: number;
    keywordCounts: Map<string, number>;
  };

  // High-success keywords for intelligent search
  private readonly HIGH_SUCCESS_KEYWORDS = [
    'license renewal application',
    'safety evaluation report', 
    'inspection report',
    'environmental assessment',
    'technical specification',
    'reactor safety analysis',
    'nuclear facility license',
    'regulatory guide',
    'security plan',
    'quality assurance program'
  ];

  constructor() {
    this.config = configManager.getConfig();
    this.searchStats = {
      totalSearches: 0,
      totalCacheHits: 0,
      totalResults: 0,
      totalSearchTime: 0,
      keywordCounts: new Map()
    };
  }

  /**
   * Initialize the scraper (lazy initialization)
   */
  private async initializeScraper(): Promise<void> {
    if (!this.scraper) {
      mcpLogger.info('Initializing ADAMS scraper');
      this.scraper = new ImprovedADAMSScraper();
      await this.scraper.initialize();
    }
  }

  /**
   * Search ADAMS database with caching
   */
  async search(query: string, limit: number = 20): Promise<SearchResponse> {
    const startTime = Date.now();
    const normalizedQuery = query.toLowerCase().trim();
    const cacheKey = `search_${normalizedQuery}_${limit}`;

    mcpLogger.info('Starting ADAMS search', {
      query: normalizedQuery,
      limit,
      cacheKey
    });

    // Check cache first
    const cachedResult = cacheManager.get(cacheKey);
    if (cachedResult) {
      this.searchStats.totalSearches++;
      this.searchStats.totalCacheHits++;
      this.updateKeywordStats(normalizedQuery);

      mcpLogger.info('Search result from cache', {
        query: normalizedQuery,
        resultCount: cachedResult.results.length
      });

      return {
        ...cachedResult,
        cached: true,
        searchTime: Date.now() - startTime
      };
    }

    // Perform actual search
    try {
      await this.initializeScraper();
      
      if (!this.scraper) {
        throw new Error('Failed to initialize scraper');
      }

      mcpLogger.debug('Performing real ADAMS search', {
        query: normalizedQuery,
        limit
      });

      const searchResults = await this.scraper.searchReal(query, limit);
      
      if (!searchResults || searchResults.length === 0) {
        mcpLogger.warn('No results found, trying alternative keywords', {
          originalQuery: query
        });

        // Try with high-success keywords if original query fails
        const alternativeResult = await this.tryAlternativeSearches(limit);
        if (alternativeResult.results.length > 0) {
          return alternativeResult;
        }
      }

      // Process and enhance results
      const processedResults = this.processSearchResults(searchResults);
      const searchTime = Date.now() - startTime;

      const response: SearchResponse = {
        results: processedResults,
        totalFound: processedResults.length,
        searchQuery: query,
        searchTime,
        cached: false
      };

      // Cache the result
      cacheManager.set(cacheKey, response);

      // Update statistics
      this.searchStats.totalSearches++;
      this.searchStats.totalResults += processedResults.length;
      this.searchStats.totalSearchTime += searchTime;
      this.updateKeywordStats(normalizedQuery);

      mcpLogger.info('Search completed successfully', {
        query,
        resultCount: processedResults.length,
        searchTime,
        cached: false
      });

      return response;

    } catch (error: any) {
      mcpLogger.error('Search failed', {
        query,
        error: error.message,
        stack: error.stack
      });

      // Return fallback results if available
      const fallbackResults = await this.getFallbackResults(limit);
      
      return {
        results: fallbackResults,
        totalFound: fallbackResults.length,
        searchQuery: query,
        searchTime: Date.now() - startTime,
        cached: false
      };
    }
  }

  /**
   * Try alternative high-success searches
   */
  private async tryAlternativeSearches(limit: number): Promise<SearchResponse> {
    mcpLogger.info('Trying alternative high-success keywords');
    
    for (const keyword of this.HIGH_SUCCESS_KEYWORDS.slice(0, 3)) {
      try {
        mcpLogger.debug('Trying alternative keyword', { keyword });
        
        if (!this.scraper) {
          await this.initializeScraper();
        }
        
        const results = await this.scraper!.searchReal(keyword, Math.min(limit, 10));
        
        if (results && results.length > 0) {
          const processedResults = this.processSearchResults(results);
          
          mcpLogger.info('Alternative search successful', {
            keyword,
            resultCount: processedResults.length
          });

          return {
            results: processedResults,
            totalFound: processedResults.length,
            searchQuery: keyword,
            searchTime: 0,
            cached: false
          };
        }
      } catch (error: any) {
        mcpLogger.debug('Alternative keyword failed', {
          keyword,
          error: error.message
        });
        continue;
      }
    }

    return {
      results: [],
      totalFound: 0,
      searchQuery: 'fallback',
      searchTime: 0,
      cached: false
    };
  }

  /**
   * Process and enhance search results
   */
  private processSearchResults(rawResults: any[]): SearchResult[] {
    if (!rawResults || !Array.isArray(rawResults)) {
      return [];
    }

    return rawResults
      .filter(result => result && (result.accessionNumber || result.documentNumber))
      .map((result, index) => ({
        title: this.cleanTitle(result.title || 'Unknown Document'),
        documentNumber: result.documentNumber,
        accessionNumber: result.accessionNumber || result.documentNumber,
        date: result.date,
        docketNumber: result.docketNumber,
        url: result.url,
        relevanceScore: this.calculateRelevanceScore(result, index)
      }))
      .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
  }

  /**
   * Calculate relevance score for sorting
   */
  private calculateRelevanceScore(result: any, index: number): number {
    let score = 100 - index; // Base score from search position

    // Boost recent documents
    if (result.date) {
      const year = parseInt(result.date.substring(0, 4));
      if (year >= 2020) score += 20;
      else if (year >= 2015) score += 10;
    }

    // Boost ML documents (more likely to be downloadable)
    if (result.accessionNumber?.startsWith('ML')) {
      score += 15;
    }

    // Boost documents with good titles
    if (result.title && result.title.length > 20) {
      score += 5;
    }

    return score;
  }

  /**
   * Clean and normalize document titles
   */
  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-\.]/g, '')
      .trim()
      .substring(0, 200); // Limit title length
  }

  /**
   * Get fallback results from cache or default set
   */
  private async getFallbackResults(limit: number): Promise<SearchResult[]> {
    // Try to get any recent cached results
    const cacheKeys = cacheManager.keys()
      .filter(key => key.startsWith('search_'))
      .slice(0, 3);

    for (const key of cacheKeys) {
      const cached = cacheManager.get(key);
      if (cached && cached.results && cached.results.length > 0) {
        mcpLogger.info('Using fallback results from cache', {
          cacheKey: key,
          resultCount: cached.results.length
        });
        return cached.results.slice(0, limit);
      }
    }

    // Return empty if no fallback available
    return [];
  }

  /**
   * Update keyword usage statistics
   */
  private updateKeywordStats(query: string): void {
    const currentCount = this.searchStats.keywordCounts.get(query) || 0;
    this.searchStats.keywordCounts.set(query, currentCount + 1);
  }

  /**
   * Get search statistics
   */
  getStats(): SearchStats {
    const totalSearches = this.searchStats.totalSearches;
    const cacheHitRate = totalSearches > 0 
      ? this.searchStats.totalCacheHits / totalSearches 
      : 0;
    
    const averageResults = totalSearches > 0
      ? this.searchStats.totalResults / totalSearches
      : 0;

    const averageSearchTime = totalSearches > 0
      ? this.searchStats.totalSearchTime / totalSearches
      : 0;

    // Get top 5 most popular keywords
    const sortedKeywords = Array.from(this.searchStats.keywordCounts.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([keyword]) => keyword);

    return {
      totalSearches,
      cacheHitRate: Math.round(cacheHitRate * 100) / 100,
      averageResults: Math.round(averageResults * 100) / 100,
      averageSearchTime: Math.round(averageSearchTime),
      mostPopularKeywords: sortedKeywords
    };
  }

  /**
   * Get a suggested keyword based on success patterns
   */
  getSuggestedKeyword(category: string = 'general'): string {
    const categoryKeywords: { [key: string]: string[] } = {
      safety: ['reactor safety analysis', 'safety evaluation report', 'technical specification'],
      environmental: ['environmental assessment', 'environmental impact', 'environmental report'],
      licensing: ['license renewal application', 'nuclear facility license', 'operating license'],
      inspection: ['inspection report', 'inspection finding', 'enforcement action'],
      security: ['security plan', 'physical protection', 'cyber security'],
      general: this.HIGH_SUCCESS_KEYWORDS
    };

    const keywords = categoryKeywords[category] || categoryKeywords.general;
    const randomIndex = Math.floor(Math.random() * keywords.length);
    return keywords[randomIndex];
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    const searchKeys = cacheManager.keys().filter(key => key.startsWith('search_'));
    let cleared = 0;

    for (const key of searchKeys) {
      if (cacheManager.delete(key)) {
        cleared++;
      }
    }

    mcpLogger.info('Search cache cleared', { clearedEntries: cleared });
  }

  /**
   * Close and cleanup resources
   */
  async close(): Promise<void> {
    if (this.scraper) {
      await this.scraper.close();
      this.scraper = null;
      mcpLogger.info('Search service closed');
    }
  }
}

// Singleton instance
export const searchService = new SearchService();