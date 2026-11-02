(() => {
  'use strict';
  const form = document.getElementById('connect-form');
  const username = document.getElementById('username');
  const connectButton = document.getElementById('connect');
  const disconnectButton = document.getElementById('disconnect');
  const status = document.getElementById('status');
  const error = document.getElementById('error');
  const stage = document.getElementById('wutai');
  const loader = document.getElementById('scene-loader');
  const mode = document.getElementById('stage-mode');
  const giftFeature = document.getElementById('gift-feature');
  const hostForm = document.getElementById('host-form');
  const hostInput = document.getElementById('host-name');
  const cameraSelect = document.getElementById('camera-mode');
  const laserToggle = document.getElementById('laser-toggle');
  const settingsStatus = document.getElementById('stage-settings-status');
  let savedSettings = { hostName: 'Chủ sàn', cameraMode: 'overview', revision: -1 };
  let connectedUser = '';
  let isConnected = false;
  let activityTimer;
  let sourceAvailable = false;
  let club;

  function announce(text) {
    const activity = document.getElementById('activity');
    clearTimeout(activityTimer);
    activity.textContent = text;
    activityTimer = setTimeout(() => { activity.textContent = ''; }, 4000);
  }
  function showError(message) { error.textContent = message || ''; error.hidden = !message; }
  function cameraLabel(value) {
    return [...(cameraSelect?.options || [])].find((option) => option.value === value)?.textContent || value;
  }
  function renderCameraStatus() {
    const snapshot = club?.getSnapshot();
    if (!snapshot || snapshot.focusedUser) return;
    const selected = snapshot.selectedCameraMode;
    document.getElementById('camera-status').textContent = (selected === 'mixed'
      ? `HỖN HỢP · ${cameraLabel(snapshot.cameraShot)}` : cameraLabel(selected)).toLocaleUpperCase('vi');
    const help = document.getElementById('camera-help');
    if (help) help.textContent = ['mixed', 'orbit', 'closeup'].includes(selected) ? 'Camera tự động · Quà tặng luôn được ưu tiên' : 'Kéo để xoay góc máy';
  }
  stage.addEventListener('club:camera-mode', (event) => {
    const selected = event.detail.mode;
    if (cameraSelect) cameraSelect.value = selected;
    document.getElementById('camera-orbit')?.setAttribute('aria-pressed', String(selected === 'orbit'));
    document.getElementById('camera-mixed')?.setAttribute('aria-pressed', String(selected === 'mixed'));
    renderCameraStatus();
  });

  stage.addEventListener('club:ready', () => { loader.hidden = true; });
  stage.addEventListener('club:error', (event) => {
    loader.querySelector('strong').textContent = event.detail.message;
    loader.querySelector('small').textContent = 'Kiểm tra kết nối và bật tăng tốc phần cứng cho trình duyệt.';
    loader.querySelector('.loader-ring').hidden = true;
    console.error(event.detail.detail);
  });
  stage.addEventListener('club:participants', (event) => { document.getElementById('dancer-count').textContent = event.detail.count; });
  stage.addEventListener('club:gift', (event) => {
    const { user, gift, preview } = event.detail;
    document.getElementById('gift-user').textContent = user.nickname || user.uniqueId;
    document.getElementById('gift-description').textContent = `${gift.count || 1} × ${gift.giftName || 'Quà tặng'} · Cảm ơn bạn đã tỏa sáng!`;
    document.getElementById('gift-caption').textContent = preview ? 'XEM THỬ · CAMERA QUÀ TẶNG' : 'TÂM ĐIỂM ĐÊM NAY';
    giftFeature.hidden = false;
    giftFeature.style.animation = 'none'; void giftFeature.offsetWidth; giftFeature.style.animation = '';
    const progress = giftFeature.querySelector('.gift-progress');
    progress.style.animation = 'none'; void progress.offsetWidth; progress.style.animation = '';
    document.getElementById('camera-status').textContent = 'CẬN CẢNH · NGƯỜI TẶNG QUÀ';
  });
  stage.addEventListener('club:gift-end', () => {
    giftFeature.hidden = true;
    renderCameraStatus();
  });
  try {
    club = window.createClubScene(stage);
    window.clubScene = club;
  } catch (failure) {
    loader.querySelector('strong').textContent = 'Không khởi tạo được sân khấu 3D';
    loader.querySelector('small').textContent = 'Hãy bật tăng tốc phần cứng và tải lại trang.';
    loader.querySelector('.loader-ring').hidden = true;
    console.error(failure);
  }

  function applySettings(value) {
    if (!value || !Number.isFinite(value.revision) || value.revision < savedSettings.revision) return;
    savedSettings = value;
    club?.setHostName(value.hostName);
    club?.setCameraMode(value.cameraMode);
    club?.setLaserEnabled(value.laserEnabled === true);
    if (laserToggle) laserToggle.setAttribute('aria-pressed', String(value.laserEnabled === true));
    if (hostInput && document.activeElement !== hostInput) hostInput.value = value.hostName;
    if (cameraSelect) cameraSelect.value = value.cameraMode;
    [hostInput, cameraSelect, laserToggle, document.getElementById('save-host')].forEach((control) => { if (control) control.disabled = false; });
    if (settingsStatus) { settingsStatus.classList.remove('is-error'); settingsStatus.textContent = 'Đã lưu · Đồng bộ cùng nguồn OBS'; }
  }
  function settingsError(message) {
    if (settingsStatus) { settingsStatus.classList.add('is-error'); settingsStatus.textContent = message; }
    else announce(message);
  }
  async function loadSettings() {
    try {
      const response = await fetch('/api/stage/settings');
      if (!response.ok) throw new Error('Khởi động lại server để dùng cài đặt chủ sàn và camera mới.');
      applySettings(await response.json());
    } catch (failure) { settingsError(failure.message); }
  }
  async function saveSettings(patch) {
    try {
      const response = await fetch('/api/stage/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không lưu được cài đặt sân khấu.');
      applySettings(result);
    } catch (failure) {
      if (cameraSelect) cameraSelect.value = savedSettings.cameraMode;
      settingsError(failure.message);
    }
  }
  hostForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveSettings({ hostName: hostInput.value.trim() });
  });
  cameraSelect?.addEventListener('change', () => { void saveSettings({ cameraMode: cameraSelect.value }); });
  void loadSettings();

  function updateState(state) {
    const wasConnected = isConnected;
    isConnected = Boolean(state.connected);
    connectButton.disabled = Boolean(state.connecting);
    disconnectButton.disabled = !state.connected && !state.connecting;
    document.getElementById('preview').disabled = state.connected || state.connecting;
    status.classList.toggle('connected', isConnected);
    status.textContent = state.connecting ? `Đang kết nối ${state.username ? '@' + state.username : 'TikTok'}…`
      : isConnected ? `Đã kết nối @${state.username}` : 'Chưa kết nối TikTok';
    document.getElementById('viewers').textContent = `${Number(state.viewerCount) || 0} người xem`;
    showError(state.lastError);
    if (state.username && !username.value) username.value = '@' + state.username;
    if (wasConnected && !isConnected) {
      connectedUser = '';
      club?.setPreview(false);
    }
    if (isConnected && connectedUser !== state.username) {
      connectedUser = state.username;
      club?.setPreview(false);
    }
    mode.textContent = isConnected ? '● LIVE' : club?.getSnapshot().preview ? 'XEM THỬ' : 'CHỜ LIVE';
    mode.classList.toggle('is-live', isConnected);
  }
  async function request(action, body) {
    const response = await fetch('/api/live/' + action, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Không gửi được yêu cầu.');
    return result;
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!sourceAvailable) { showError('Đang chờ kết nối với server. Vui lòng thử lại sau.'); return; }
    showError(''); connectButton.disabled = true;
    try { await request('connect', { username: username.value.trim() }); }
    catch (failure) { showError(failure.message); connectButton.disabled = false; }
  });
  disconnectButton.addEventListener('click', async () => {
    try { await request('disconnect'); } catch (failure) { showError(failure.message); }
  });

  function handleEvent(event) {
    const data = event.data;
    if (event.type === 'stage-settings') { applySettings(data); return; }
    if (event.type === 'state') { updateState(data); return; }
    if (!club) return;
    if (event.type === 'member') return;
    if (event.type === 'chat') {
      const command = String(data.comment || '').trim().toLocaleLowerCase('vi');
      if (['đổi đồ', 'doi do', 'đổi nhân vật', 'doi nhan vat', 'đổi chó', 'doi cho', 'đổi cún', 'doi cun', '换修勾'].includes(command)) {
        club.addParticipant(data); const palette = club.changeAvatar(data.uniqueId);
        club.showMessage(data, `Phong cách ${palette || 'mới'}!`);
      } else club.showMessage(data, data.comment);
    } else if (event.type === 'gift') club.focusGift(data, data);
    else if (event.type === 'like') club.react(data, `♥ +${data.count}`);
    else if (event.type === 'follow') club.react(data, '★ Đã theo dõi');
    else if (event.type === 'share') club.react(data, '↗ Đã chia sẻ');
  }
  const events = new EventSource('/api/live/events');
  let openedBefore = false;
  events.onopen = () => {
    sourceAvailable = true;
    if (!openedBefore && username.value && new URLSearchParams(location.search).get('connect') === '1') form.requestSubmit();
    openedBefore = true;
  };
  events.onmessage = (message) => {
    try { handleEvent(JSON.parse(message.data)); } catch (failure) { console.error('Không đọc được sự kiện live:', failure); }
  };
  events.onerror = () => {
    sourceAvailable = false; status.textContent = 'Mất kết nối server, đang thử lại…';
    status.classList.remove('connected'); disconnectButton.disabled = true;
  };

  document.getElementById('preview').addEventListener('click', () => {
    if (isConnected) return;
    connectedUser = ''; club?.setPreview(true); mode.textContent = 'XEM THỬ';
  });
  document.getElementById('test-gift').addEventListener('click', () => {
    if (club && !club.testGift()) announce('Chưa có ai trên sàn. Người xem cần bình luận hoặc tặng quà.');
  });
  document.getElementById('change-avatar').addEventListener('click', () => {
    const palette = club?.changeAvatar(); if (palette) announce('Phong cách ' + palette);
  });
  document.getElementById('camera-reset').addEventListener('click', () => { club?.setCameraMode('overview', true); void saveSettings({ cameraMode: 'overview' }); });
  document.getElementById('camera-orbit').addEventListener('click', () => { void saveSettings({ cameraMode: club?.getSnapshot().selectedCameraMode === 'orbit' ? 'overview' : 'orbit' }); });
  document.getElementById('camera-mixed')?.addEventListener('click', () => { void saveSettings({ cameraMode: 'mixed' }); });
  document.getElementById('lights-toggle').addEventListener('click', (event) => event.currentTarget.setAttribute('aria-pressed', String(club?.toggleLights() || false)));
  laserToggle?.addEventListener('click', () => { void saveSettings({ laserEnabled: savedSettings.laserEnabled !== true }); });
  document.getElementById('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else stage.requestFullscreen?.().catch(() => announce('Không mở được chế độ toàn màn hình.'));
  });
  function setLayout(layout) {
    document.body.classList.toggle('is-wide', layout === 'wide');
    document.querySelectorAll('[data-layout]').forEach((button) => {
      const selected = button.dataset.layout === layout;
      button.classList.toggle('active', selected); button.setAttribute('aria-pressed', String(selected));
    });
  }
  document.querySelectorAll('[data-layout]').forEach((button) => button.addEventListener('click', () => setLayout(button.dataset.layout)));
  const query = new URLSearchParams(location.search);
  if (query.get('layout') === 'wide') setLayout('wide');
  if (query.get('obs') === '1') {
    document.body.classList.add('obs');
    const show = document.getElementById('show-controls'); show.hidden = false;
    show.addEventListener('click', () => { document.body.classList.remove('obs'); show.hidden = true; });
  }

  const music = document.getElementById('music');
  const enableMusic = document.getElementById('enable-music');
  music.src = '/music/YTSave.to_YouTube_Media_7f-49jDbK10_NONSTOP-VINAHOUSE-2025-VÀO-PHÒNG-BAY-PHẢI-MỞ-BÀI-NÀY-NHẠC-SÀN-BAY-PHÒNG-BASS-CĂN_009_vbr.mp3';
  music.volume = 0.4; music.autoplay = true; music.loop = true;
  function hideMusicPrompt() {
    enableMusic.hidden = true;
    document.removeEventListener('pointerdown', startMusic); document.removeEventListener('keydown', startMusic);
  }
  async function startMusic() {
    try { await music.play(); hideMusicPrompt(); }
    catch (failure) {
      if (failure.name === 'NotAllowedError') {
        enableMusic.hidden = false;
        document.addEventListener('pointerdown', startMusic); document.addEventListener('keydown', startMusic);
      }
    }
  }
  music.addEventListener('play', hideMusicPrompt);
  enableMusic.addEventListener('click', startMusic);
  music.addEventListener('error', () => { hideMusicPrompt(); announce('Không tải được nhạc nền. Hãy tải lại trang để thử lại.'); });
  void startMusic();
})();
