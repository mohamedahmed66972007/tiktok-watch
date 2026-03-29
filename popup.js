const API_URL = 'https://ijfytqcbmbbeabpgbozz.supabase.co/functions/v1/tiktok-stats';
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlqZnl0cWNibWJiZWFicGdib3p6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NjAwNzQsImV4cCI6MjA5MDMzNjA3NH0.sdXPd88RXDbtvLrmfH0FjmH9H9o4mE6ZoWHP_k89IWQ';

let currentUsername = null;
let updateInterval = null;
let favorites = [];
let pinnedAccount = null;

async function fetchTikTokData(username) {
  try {
    const response = await fetch(`${API_URL}?username=${encodeURIComponent(username)}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('فشل في جلب البيانات');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching TikTok data:', error);
    throw error;
  }
}

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

function displayProfile(data) {
  const profileSection = document.getElementById('profileSection');
  profileSection.classList.remove('hidden');

  document.getElementById('profileImage').src = data.avatar;
  document.getElementById('profileName').textContent = data.nickname;
  document.getElementById('profileUsername').textContent = '@' + data.username;
  document.getElementById('profileBio').textContent = data.bio || 'لا يوجد وصف';

  document.getElementById('followersCount').textContent = formatNumber(data.followerCount);
  document.getElementById('followingCount').textContent = formatNumber(data.followingCount);
  document.getElementById('likesCount').textContent = formatNumber(data.heartCount);

  const now = new Date();
  const timeString = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('lastUpdate').textContent = timeString;

  updatePinButton();
  updateFavoriteButton();
}

function showStatus(message, isError = false) {
  const status = document.getElementById('searchStatus');
  status.textContent = message;
  status.style.color = isError ? '#ff6b6b' : 'white';
}

async function loadAccount(username) {
  if (!username) return;

  showStatus('جاري التحميل...');
  currentUsername = username;

  try {
    const data = await fetchTikTokData(username);
    displayProfile(data);
    showStatus('');

    if (updateInterval) {
      clearInterval(updateInterval);
    }

    updateInterval = setInterval(async () => {
      try {
        const updatedData = await fetchTikTokData(username);
        displayProfile(updatedData);
      } catch (error) {
        console.error('Update failed:', error);
      }
    }, 10000);
  } catch (error) {
    showStatus('فشل في تحميل البيانات', true);
    document.getElementById('profileSection').classList.add('hidden');
  }
}

async function togglePin() {
  if (!currentUsername) return;

  if (pinnedAccount === currentUsername) {
    pinnedAccount = null;
    showStatus('تم إلغاء التثبيت');
  } else {
    pinnedAccount = currentUsername;
    showStatus('تم التثبيت ✓');
  }

  await chrome.storage.local.set({ pinnedAccount });
  updatePinButton();

  setTimeout(() => showStatus(''), 2000);
}

async function toggleFavorite() {
  if (!currentUsername) return;

  const data = await fetchTikTokData(currentUsername);
  const index = favorites.findIndex(fav => fav.username === currentUsername);

  if (index > -1) {
    favorites.splice(index, 1);
    showStatus('تم الإزالة من المفضلة');
  } else {
    favorites.push({
      username: data.username,
      nickname: data.nickname,
      avatar: data.avatar
    });
    showStatus('تم إضافة للمفضلة ✓');
  }

  await chrome.storage.local.set({ favorites });
  updateFavoriteButton();
  renderFavorites();

  setTimeout(() => showStatus(''), 2000);
}

function updatePinButton() {
  const pinBtn = document.getElementById('pinBtn');
  if (currentUsername === pinnedAccount) {
    pinBtn.classList.add('active');
  } else {
    pinBtn.classList.remove('active');
  }
}

function updateFavoriteButton() {
  const favoriteBtn = document.getElementById('favoriteBtn');
  const isFavorite = favorites.some(fav => fav.username === currentUsername);
  favoriteBtn.textContent = isFavorite ? '❤️' : '🤍';
}

function renderFavorites() {
  const favoritesList = document.getElementById('favoritesList');

  if (favorites.length === 0) {
    favoritesList.innerHTML = '<div class="empty-favorites">لا توجد حسابات محفوظة</div>';
    return;
  }

  favoritesList.innerHTML = favorites.map(fav => `
    <div class="favorite-item ${fav.username === pinnedAccount ? 'pinned' : ''}" data-username="${fav.username}">
      <img src="${fav.avatar}" alt="${fav.nickname}">
      <div class="favorite-item-info">
        <div class="favorite-item-name">${fav.nickname}</div>
        <div class="favorite-item-username">@${fav.username}</div>
      </div>
      <button class="favorite-item-remove" data-username="${fav.username}">🗑️</button>
    </div>
  `).join('');

  favoritesList.querySelectorAll('.favorite-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.classList.contains('favorite-item-remove')) {
        const username = item.dataset.username;
        document.getElementById('usernameInput').value = username;
        loadAccount(username);
      }
    });
  });

  favoritesList.querySelectorAll('.favorite-item-remove').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const username = btn.dataset.username;
      favorites = favorites.filter(fav => fav.username !== username);
      await chrome.storage.local.set({ favorites });
      renderFavorites();
      if (currentUsername === username) {
        updateFavoriteButton();
      }
    });
  });
}

async function init() {
  const stored = await chrome.storage.local.get(['pinnedAccount', 'favorites']);
  pinnedAccount = stored.pinnedAccount || null;
  favorites = stored.favorites || [];

  renderFavorites();

  if (pinnedAccount) {
    document.getElementById('usernameInput').value = pinnedAccount;
    loadAccount(pinnedAccount);
  }

  const input = document.getElementById('usernameInput');
  let debounceTimer;

  input.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    const username = e.target.value.trim();

    if (username.length > 2) {
      debounceTimer = setTimeout(() => {
        loadAccount(username);
      }, 800);
    }
  });

  document.getElementById('pinBtn').addEventListener('click', togglePin);
  document.getElementById('favoriteBtn').addEventListener('click', toggleFavorite);
}

window.addEventListener('beforeunload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

document.addEventListener('DOMContentLoaded', init);
