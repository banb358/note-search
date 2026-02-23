/**
 * NoteSearch - Main Application Logic
 */

let articles = [];

const noteIdInput = document.getElementById('note-id');
const fetchBtn = document.getElementById('fetch-btn');
const searchInput = document.getElementById('search-input');
const resultsList = document.getElementById('results-list');
const articleCountEl = document.getElementById('article-count');
const loader = document.getElementById('loader');
const resetBtn = document.getElementById('reset-btn');
const exportBtn = document.getElementById('export-btn');
const csvBtn = document.getElementById('csv-btn');
const snsServiceSelect = document.getElementById('sns-service');
const idLabel = document.getElementById('id-label');
const urlPrefix = document.getElementById('url-prefix');

// Proxy URL to avoid CORS issues
const PROXY_URL = 'https://corsproxy.io/?';

// SNS Configuration
const SNS_CONFIG = {
    note: {
        name: 'note',
        baseUrl: 'https://note.com/api/v2/creators/',
        urlPrefix: 'note.com/',
        idLabel: 'note ID',
        placeholder: 'iitomo3',
        fetcher: async (userId, page) => {
            const url = `https://note.com/api/v2/creators/${userId}/contents?kind=note&page=${page}`;
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.data?.contents || []).map(item => ({
                title: item.name,
                url: item.noteUrl || item.note_full_url || `https://note.com/${userId}/n/${item.key}`,
                date: item.publishAt || item.publish_at || item.status_publish_at,
                service: 'note'
            }));
        }
    },
    zenn: {
        name: 'Zenn',
        baseUrl: 'https://zenn.dev/api/articles',
        urlPrefix: 'zenn.dev/',
        idLabel: 'ユーザー名',
        placeholder: 'zenn_official',
        fetcher: async (userId, page) => {
            const url = `https://zenn.dev/api/articles?username=${userId}&order=latest&page=${page}`;
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json.articles || []).map(item => ({
                title: item.title,
                url: `https://zenn.dev${item.path}`,
                date: item.published_at,
                service: 'zenn'
            }));
        }
    },
    qiita: {
        name: 'Qiita',
        baseUrl: 'https://qiita.com/api/v2/items',
        urlPrefix: 'qiita.com/',
        idLabel: 'ユーザーID',
        placeholder: 'qiita_official',
        fetcher: async (userId, page) => {
            const url = `https://qiita.com/api/v2/items?query=user:${userId}&page=${page}&per_page=100`;
            const res = await fetch(`${PROXY_URL}${encodeURIComponent(url)}`);
            if (!res.ok) return [];
            const json = await res.json();
            return (json || []).map(item => ({
                title: item.title,
                url: item.url,
                date: item.created_at,
                service: 'qiita'
            }));
        }
    }
};

/**
 * Fetch articles across all pages for the selected SNS
 */
async function fetchArticles(userId) {
    const serviceKey = snsServiceSelect.value;
    const config = SNS_CONFIG[serviceKey];

    showLoader(`${config.name} の記事を取得中...`);
    articles = [];
    resultsList.innerHTML = '';

    try {
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            updateLoaderText(`${config.name} から取得中... (${articles.length}件完了)`);

            const newBatch = await config.fetcher(userId, page);

            if (newBatch && newBatch.length > 0) {
                const formattedBatch = newBatch.map(item => {
                    const dateObj = new Date(item.date);
                    return {
                        ...item,
                        formattedDate: (!isNaN(dateObj.getTime())) ? dateObj.toLocaleDateString('ja-JP') : '日付不明'
                    };
                });

                articles = [...articles, ...formattedBatch];
                page++;

                // Stop if batch size is small (mostly means last page)
                if (newBatch.length < 5) hasMore = false;
                if (page > 100) break; // Safety
            } else {
                hasMore = false;
            }
        }

        if (articles.length > 0) {
            displayArticles(articles);
            searchInput.disabled = false;
            exportBtn.classList.remove('hidden');
            csvBtn.classList.remove('hidden');
            updateStats(articles.length);
        } else {
            showEmptyState('記事が見わませんでした。IDが正しいか確認してください。');
            exportBtn.classList.add('hidden');
            csvBtn.classList.add('hidden');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        showEmptyState(error.message);
    } finally {
        hideLoader();
    }
}



/**
 * Display articles in the list
 */
function displayArticles(items) {
    if (items.length === 0) {
        showEmptyState('検索条件に一致する記事はありません。');
        return;
    }

    resultsList.innerHTML = items.map(item => `
        <div class="article-item-wrapper">
            <a href="${item.url}" target="_blank" class="article-item">
                <div class="article-info">
                    <span class="badge badge-${item.service}">${item.service}</span>
                    <h3>${escapeHtml(item.title)}</h3>
                    <p class="article-date">${item.formattedDate}</p>
                </div>
            </a>
            <button class="copy-btn" onclick="copyToClipboard('${escapeHtml(item.title).replace(/'/g, "\\'")}')" title="タイトルをコピー">
                📋
            </button>
        </div>
    `).join('');
}


/**
 * Filter articles based on search input
 */
function filterArticles() {
    const query = searchInput.value.toLowerCase();
    const filtered = articles.filter(article =>
        article.title.toLowerCase().includes(query)
    );
    displayArticles(filtered);
    updateStats(filtered.length);
}

/**
 * Update the article count display
 */
function updateStats(count) {
    articleCountEl.textContent = `${count} 件の記事が見つかりました`;
}

/**
 * Helpers
 */
function showLoader(text = 'ロード中...') {
    loader.querySelector('.loader-text').textContent = text;
    loader.classList.remove('hidden');
}

function updateLoaderText(text) {
    loader.querySelector('.loader-text').textContent = text;
}

function hideLoader() { loader.classList.add('hidden'); }

function showEmptyState(message) {
    resultsList.innerHTML = `
        <div class="empty-state">
            <p>${message}</p>
        </div>
    `;
    updateStats(0);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

window.copyToClipboard = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('タイトルをコピーしました: ' + text);
    }).catch(err => {
        console.error('Copy failed', err);
    });
};

// Event Listeners
/**
 * Update UI based on selected service
 */
function updateServiceUI() {
    const service = SNS_CONFIG[snsServiceSelect.value];
    idLabel.textContent = service.idLabel;
    urlPrefix.textContent = service.urlPrefix;
    noteIdInput.placeholder = service.placeholder;
    // Clear current articles and search when switching service to avoid confusion
    resetBtn.click();
}

snsServiceSelect.addEventListener('change', updateServiceUI);

fetchBtn.addEventListener('click', () => {
    const id = noteIdInput.value.trim();
    if (id) fetchArticles(id);
});

searchInput.addEventListener('input', filterArticles);

// Reset function
resetBtn.addEventListener('click', () => {
    articles = [];
    resultsList.innerHTML = '';
    searchInput.value = '';
    searchInput.disabled = true;
    exportBtn.classList.add('hidden');
    csvBtn.classList.add('hidden');
    showEmptyState('IDを入力して「取得」ボタンを押してください');
    articleCountEl.textContent = '記事が見つかりません';
    noteIdInput.focus();
});

// Export to Spreadsheet function
exportBtn.addEventListener('click', () => {
    if (articles.length === 0) return;

    // Format as Tab-Separated Values (TSV) - best for Google Sheets/Excel paste
    const header = "サービス\tタイトル\t日付\tURL\n";
    const body = articles.map(a => `${a.service}\t${a.title}\t${a.formattedDate}\t${a.url}`).join('\n');
    const tsv = header + body;

    navigator.clipboard.writeText(tsv).then(() => {
        const confirmOpen = confirm(`${articles.length}件のデータをコピーしました。このままGoogleスプレッドシートを開いて貼り付けますか？`);
        if (confirmOpen) {
            window.open('https://sheets.new', '_blank');
        }
    }).catch(err => {
        console.error('Export failed', err);
        alert('コピーに失敗しました。');
    });
});

// CSV Download function
csvBtn.addEventListener('click', () => {
    if (articles.length === 0) return;

    // Use CSV format (Comma Separated)
    const header = "サービス,タイトル,日付,URL\n";
    // Helper to escape CSV values (quotes and commas)
    const escapeCsv = (str) => {
        if (!str) return '""';
        const escaped = str.toString().replace(/"/g, '""');
        return `"${escaped}"`;
    };

    const body = articles.map(a =>
        `${escapeCsv(a.service)},${escapeCsv(a.title)},${escapeCsv(a.formattedDate)},${escapeCsv(a.url)}`
    ).join('\n');

    // Add UTF-8 BOM for Excel compatibility
    const csvContent = "\uFEFF" + header + body;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `article_list_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Add keydown listener for Enter
noteIdInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchBtn.click();
});

// Initial fetch if value exists
if (noteIdInput.value) {
    // Small delay to ensure CSS is loaded
    setTimeout(() => fetchBtn.click(), 500);
}
