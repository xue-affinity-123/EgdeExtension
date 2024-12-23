document.addEventListener('DOMContentLoaded', () => {
  // 初始化加载动画
  const loading = document.getElementById('loading');
  
  // 初始化事件监听
  document.getElementById('sortAsc').addEventListener('click', () => sortBookmarks('asc'));
  document.getElementById('sortDesc').addEventListener('click', () => sortBookmarks('desc'));
  document.getElementById('exportHtml').addEventListener('click', exportHtml);
  document.getElementById('copyUrls').addEventListener('click', copyUrls);
  document.getElementById('locateCurrentPage').addEventListener('click', locateCurrentPage);
  
  // 添加搜索功能
  const searchBox = document.getElementById('searchBox');
  let debounceTimeout;
  searchBox.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    debounceTimeout = setTimeout(() => {
      const searchTerm = searchBox.value.toLowerCase();
      filterBookmarks(searchTerm);
    }, 300);
  });

  // 初始加载书签
  loadBookmarks();
});

function showLoading() {
  const loading = document.getElementById('loading');
  loading.classList.add('active');
}

function hideLoading() {
  const loading = document.getElementById('loading');
  loading.classList.remove('active');
}

async function loadBookmarks(order = 'desc') {
  showLoading();
  try {
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      const bookmarks = flattenBookmarks(bookmarkTreeNodes);
      bookmarks.sort((a, b) => order === 'asc' ? a.dateAdded - b.dateAdded : b.dateAdded - a.dateAdded);
      displayBookmarks(bookmarks);
      hideLoading();
    });
  } catch (error) {
    console.error('加载书签时出错:', error);
    hideLoading();
  }
}

function displayBookmarks(bookmarks) {
  const bookmarkList = document.getElementById('bookmarkList');
  bookmarkList.innerHTML = '';
  
  bookmarks.forEach(bookmark => {
    const card = document.createElement('div');
    card.className = 'bookmark-card';
    card.dataset.url = bookmark.url;
    card.dataset.title = bookmark.title.toLowerCase();
    
    const date = new Date(bookmark.dateAdded);
    const formattedDate = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
    
    card.innerHTML = `
      <div class="bookmark-title">${bookmark.title}</div>
      <div class="bookmark-url">${bookmark.url}</div>
      <div class="bookmark-date">添加时间: ${formattedDate}</div>
    `;
    
    card.addEventListener('click', (e) => {
      // 如果是选中文本，不进行跳转
      if (window.getSelection().toString()) {
        return;
      }
      chrome.tabs.create({ url: bookmark.url });
    });
    
    bookmarkList.appendChild(card);
  });
}

function filterBookmarks(searchTerm) {
  const cards = document.querySelectorAll('.bookmark-card');
  cards.forEach(card => {
    const title = card.dataset.title;
    const url = card.dataset.url.toLowerCase();
    const isMatch = title.includes(searchTerm) || url.includes(searchTerm);
    card.style.display = isMatch ? 'block' : 'none';
  });
}

async function locateCurrentPage() {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab) return;

  const bookmarkCards = document.querySelectorAll('.bookmark-card');
  let found = false;
  
  // 清除所有高亮
  bookmarkCards.forEach(card => card.classList.remove('highlight'));
  
  // 查找匹配的书签
  for (const card of bookmarkCards) {
    if (card.dataset.url === activeTab.url) {
      card.classList.add('highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      found = true;
      break;
    }
  }

  if (!found) {
    alert('当前页面未在收藏夹中找到！');
  }
}

function sortBookmarks(order) {
  loadBookmarks(order);
}

function exportHtml() {
  showLoading();
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const bookmarks = flattenBookmarks(bookmarkTreeNodes);
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>我的书签</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
          .bookmark { margin-bottom: 10px; }
          .bookmark a { color: #4299e1; text-decoration: none; }
          .bookmark a:hover { text-decoration: underline; }
          .date { color: #718096; font-size: 0.8em; }
        </style>
      </head>
      <body>
        <h1>我的书签</h1>
    `;
    
    bookmarks.forEach(bookmark => {
      const date = new Date(bookmark.dateAdded).toLocaleString('zh-CN');
      html += `
        <div class="bookmark">
          <a href="${bookmark.url}">${bookmark.title}</a>
          <span class="date">(${date})</span>
        </div>
      `;
    });
    
    html += '</body></html>';
    
    const blob = new Blob([html], {type: 'text/html'});
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: 'bookmarks.html'
    });
    hideLoading();
  });
}

function copyUrls() {
  showLoading();
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const bookmarks = flattenBookmarks(bookmarkTreeNodes);
    const urls = bookmarks.map(bookmark => bookmark.url).filter(url => url).join('\n');
    navigator.clipboard.writeText(urls).then(() => {
      alert('所有URL已复制到剪贴板');
      hideLoading();
    }).catch(error => {
      console.error('复制失败:', error);
      alert('复制URL时出错');
      hideLoading();
    });
  });
}

function flattenBookmarks(bookmarkTreeNodes) {
  let bookmarks = [];
  for (let node of bookmarkTreeNodes) {
    if (node.children) {
      bookmarks = bookmarks.concat(flattenBookmarks(node.children));
    } else if (node.url) {
      bookmarks.push(node);
    }
  }
  return bookmarks;
}