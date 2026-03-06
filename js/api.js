/* ================================================================
   api.js — NewsDataHub API wrapper
   ================================================================ */

const API = {
    _cache: new Map(),

    /**
     * Fetch news articles with optional filters.
     * @param {Object} params - Query parameters
     * @returns {Promise<{data: Array, next_cursor: string|null, total_results: number}>}
     */
    async fetchNews(params = {}) {
        const cacheKey = JSON.stringify(params);
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const url = new URL(`${CONFIG.API_BASE}/news`, window.location.origin);

        // Default language
        if (!params.language) {
            url.searchParams.set('language', CONFIG.DEFAULT_LANGUAGE);
        }

        // Map all params to query string
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, value);
            }
        });

        // Default per_page
        if (!url.searchParams.has('per_page')) {
            url.searchParams.set('per_page', CONFIG.DEFAULT_PER_PAGE);
        }

        const maxAttempts = 3;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const res = await fetch(url.toString(), {
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (!res.ok) {
                    const errorBody = await res.text();

                    if (res.status === 429 && attempt < maxAttempts) {
                        const retryAfter = Number(res.headers.get('Retry-After')) || attempt;
                        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
                        continue;
                    }

                    throw new Error(`API Error ${res.status}: ${errorBody}`);
                }

                const json = await res.json();

                // Transform results to ensure consistent 'id' field
                const transformedData = (json.data || []).map(article => ({
                    ...article,
                    id: article.article_id || Math.random().toString(36).substr(2, 9)
                }));

                const result = {
                    data: transformedData,
                    next_cursor: json.next_cursor || null,
                    total_results: json.total_results || 0,
                    per_page: json.per_page || CONFIG.DEFAULT_PER_PAGE
                };

                this._cache.set(cacheKey, result);
                return result;
            } catch (err) {
                if (attempt === maxAttempts) {
                    console.error('API fetch error:', err);
                    throw err;
                }
            }
        }
    },

    /**
     * Fetch latest / top headlines (no topic filter).
     */
    async fetchLatest(perPage = CONFIG.DEFAULT_PER_PAGE, cursor = null) {
        return this.fetchNews({
            per_page: perPage,
            cursor: cursor,
            sort_by: 'date'
        });
    },

    /**
     * Fetch articles by topic.
     */
    async fetchByTopic(topic, perPage = CONFIG.DEFAULT_PER_PAGE, cursor = null) {
        return this.fetchNews({
            topic: topic,
            per_page: perPage,
            cursor: cursor,
            sort_by: 'date'
        });
    },

    /**
     * Search articles by keyword.
     */
    async searchNews(query, perPage = CONFIG.DEFAULT_PER_PAGE, cursor = null) {
        return this.fetchNews({
            q: query,
            per_page: perPage,
            cursor: cursor,
            sort_by: 'relevance'
        });
    }
};
