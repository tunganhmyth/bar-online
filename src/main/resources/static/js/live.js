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
  const stageNameForm = document.getElementById('stage-name-form');
  const stageNameInput = document.getElementById('stage-name');
  const hostInput = document.getElementById('host-name');
  const characterSelect = document.getElementById('host-character');
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
    if (value === 'top') {
      const subject = club?.getSnapshot().cameraTop;
      return subject ? `Top ${subject.rank} · ${subject.nickname}` : 'Top quà tặng';
    }
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
    const { user, gift, preview, character } = event.detail;
    document.getElementById('gift-user').textContent = user.nickname || user.uniqueId;
    document.getElementById('gift-description').textContent = `${gift.count || 1} × ${gift.giftName || 'Quà tặng'} · Cảm ơn bạn đã tỏa sáng!`;
    document.getElementById('gift-caption').textContent = preview ? 'XEM THỬ · CAMERA QUÀ TẶNG' : 'TÂM ĐIỂM ĐÊM NAY';
    giftFeature.hidden = false;
    giftFeature.style.animation = 'none'; void giftFeature.offsetWidth; giftFeature.style.animation = '';
    const progress = giftFeature.querySelector('.gift-progress');
    progress.style.animation = 'none'; void progress.offsetWidth; progress.style.animation = '';
    document.getElementById('camera-status').textContent = 'CẬN CẢNH · NGƯỜI TẶNG QUÀ';
    const skill = document.getElementById('gift-skill');
    if (skill) skill.textContent = character ? `${character.name} · ${character.skill}` : '';
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

  const characters = club?.getCharacters() || [];
  function renderTopGifters(snapshot) {
    const list = document.getElementById('top-gifters-list');
    if (!list) return;
    list.replaceChildren();
    if (!snapshot.leaders.length) {
      const empty = document.createElement('p'); empty.className = 'top-empty'; empty.textContent = 'Chưa có quà trong phiên kết nối này.'; list.append(empty);
    }
    const colors = ['#ffd37a', '#8ce5ff', '#f9a3be'];
    for (const entry of snapshot.leaders) {
      const row = document.createElement('div'); row.className = 'top-gifter-row'; row.style.setProperty('--rank-color', colors[entry.rank - 1]);
      const rank = document.createElement('b'); rank.textContent = entry.rank;
      const text = document.createElement('div');
      const name = document.createElement('strong'); name.textContent = entry.nickname || entry.uniqueId;
      const details = document.createElement('small'); details.textContent = `${Number(entry.gifts).toLocaleString('vi')} quà · ${characters.find((character) => character.id === entry.characterId)?.name || ''}`;
      text.append(name, details);
      const score = document.createElement('span'); score.textContent = (club?.getTopRoles?.() || ['Cơ Trưởng', 'Cơ Phó', 'Tiếp viên'])[entry.rank - 1];
      row.append(rank, text, score); list.append(row);
    }
    const note = document.getElementById('top-gifters-note');
    if (note) note.textContent = `Xếp hạng quà${snapshot.channel ? ' @' + snapshot.channel : ''} · Đồng bộ OBS`;
  }
  for (const option of characterSelect?.options || []) {
    const character = characters.find((item) => item.id === option.value);
    if (character) option.textContent = `${character.name} · ${character.title}`;
  }
  const roster = document.getElementById('character-roster');
  for (const character of characters) {
    const card = document.createElement('div'); card.className = 'roster-character';
    card.style.setProperty('--character-color', character.accent);
    const name = document.createElement('strong'); name.textContent = `${character.name} · ${character.title}`;
    const dance = document.createElement('span'); dance.textContent = character.dance;
    const skill = document.createElement('small'); skill.textContent = `✧ ${character.skill}`;
    card.append(name, dance, skill); roster?.append(card);
  }

  const music = document.getElementById('music');
  const enableMusic = document.getElementById('enable-music');
  const musicSelect = document.getElementById('music-track');
  const musicStatus = document.getElementById('music-status');
  const musicTracks = [
    { id: 'forever-one-love', title: 'FOREVER ONE LOVE #2', artist: 'DARKD x DAVID SEA', file: 'FOREVER ONE LOVE #2 _ DARKD x DAVID SEA.m4a' },
    { id: 'hon-bat-cu-ai', title: 'HƠN BẤT CỨ AI 2026', artist: 'QUIZ', file: 'HON BAT CU AI 2026 - QUIZ-1601452629.mp3' },
    { id: 'ket-thuc-va-chia-tay', title: 'KẾT THÚC VÀ CHIA TAY 2026', artist: 'DZUONG x RICK', file: 'Kết Thúc Và Chia Tay 2026 - DZUONG X RICK.m4a' },
    { id: 'ngay-nay-nam-ay', title: 'NGÀY NÀY NĂM ẤY', artist: 'DUONGDINN', file: 'NGAY NAY NAM AY - DUONGDINN-1805857821.m4a' },
    { id: 'nonstop-vinahouse', title: 'NONSTOP VINAHOUSE 2025', artist: 'Vào phòng bay phải mở bài này', file: 'YTSave.to_YouTube_Media_7f-49jDbK10_NONSTOP-VINAHOUSE-2025-VÀO-PHÒNG-BAY-PHẢI-MỞ-BÀI-NÀY-NHẠC-SÀN-BAY-PHÒNG-BASS-CĂN_009_vbr.mp3' }
  ];
  let currentMusicId = null;
  for (const item of musicTracks) {
    const option = document.createElement('option'); option.value = item.id;
    option.textContent = `${item.title} · ${item.artist}`; musicSelect?.append(option);
  }
  music.volume = 0.4; music.autoplay = true; music.loop = true;
  function hideMusicPrompt() {
    enableMusic.hidden = true;
    document.removeEventListener('pointerdown', startMusic); document.removeEventListener('keydown', startMusic);
  }
  async function startMusic() {
    const requestedSource = music.src;
    try { await music.play(); hideMusicPrompt(); }
    catch (failure) {
      if (failure.name === 'NotAllowedError' && music.src === requestedSource) {
        enableMusic.hidden = false;
        document.addEventListener('pointerdown', startMusic); document.addEventListener('keydown', startMusic);
      }
    }
  }
  function selectMusic(id) {
    const selected = musicTracks.find((item) => item.id === id) || musicTracks[0];
    club?.setNowPlaying?.(selected);
    if (musicSelect) musicSelect.value = selected.id;
    if (currentMusicId === selected.id) return;
    currentMusicId = selected.id;
    hideMusicPrompt();
    // Encode the entire filename, including #, spaces and Vietnamese characters.
    music.src = '/music/' + encodeURIComponent(selected.file);
    music.setAttribute('aria-label', `${selected.title} · ${selected.artist}`);
    const track = document.querySelector('.track');
    if (track) {
      track.querySelector('strong').textContent = selected.title;
      track.querySelector('small').textContent = selected.artist;
      track.querySelector(':scope > div > span').textContent = `LIVE MIX · ${selected.file.split('.').pop().toUpperCase()}`;
    }
    void startMusic();
  }
  music.addEventListener('play', hideMusicPrompt);
  enableMusic.addEventListener('click', startMusic);
  music.addEventListener('error', () => {
    hideMusicPrompt();
    const message = 'Không tải được bài nhạc. Hãy chọn bài khác hoặc tải lại trang.';
    if (musicStatus) musicStatus.textContent = message;
    announce(message);
  });
  musicSelect?.addEventListener('change', () => {
    selectMusic(musicSelect.value);
    if (musicStatus) musicStatus.textContent = 'Đang lưu bài nhạc…';
    void saveSettings({ musicTrack: currentMusicId });
  });

  function applySettings(value) {
    if (!value || !Number.isFinite(value.revision) || value.revision < savedSettings.revision) return;
    savedSettings = value;
    selectMusic(value.musicTrack);
    if (musicSelect) musicSelect.disabled = !Object.hasOwn(value, 'musicTrack');
    if (musicStatus) musicStatus.textContent = Object.hasOwn(value, 'musicTrack')
      ? `${musicTracks.length} bài · Tự phát và lặp lại · Đồng bộ bài với OBS`
      : 'Khởi động lại server để bật chọn nhạc.';
    club?.setStageName(value.stageName || 'MYTHMAKER');
    if (stageNameInput && document.activeElement !== stageNameInput) stageNameInput.value = value.stageName || 'MYTHMAKER';
    club?.setHostName(value.hostName);
    club?.setHostCharacter(value.hostCharacter || 'sakura');
    if (characterSelect) characterSelect.value = value.hostCharacter || 'sakura';
    const character = characters.find((item) => item.id === (value.hostCharacter || 'sakura'));
    const description = document.getElementById('character-description');
    if (description && character) description.textContent = `${character.dance} · ${character.skill}`;
    club?.setCameraMode(value.cameraMode);
    club?.setLaserEnabled(value.laserEnabled === true);
    if (laserToggle) laserToggle.setAttribute('aria-pressed', String(value.laserEnabled === true));
    if (hostInput && document.activeElement !== hostInput) hostInput.value = value.hostName;
    if (cameraSelect) cameraSelect.value = value.cameraMode;
    [hostInput, characterSelect, cameraSelect, laserToggle, document.getElementById('save-host')].forEach((control) => { if (control) control.disabled = false; });
    if (Object.hasOwn(value, 'stageName')) [stageNameInput, document.getElementById('save-stage-name')].forEach((control) => { if (control) control.disabled = false; });
    if (stageNameForm) stageNameForm.querySelector('.host-hint').textContent = Object.hasOwn(value, 'stageName')
      ? 'Đổi chữ ở góc trên và bảng LED phía sau. Tối đa 32 ký tự.' : 'Khởi động lại server để bật đổi tên sàn.';
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
    } catch (failure) { selectMusic(); settingsError(failure.message); }
  }
  async function saveSettings(patch) {
    try {
      const response = await fetch('/api/stage/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Không lưu được cài đặt sân khấu.');
      applySettings(result);
    } catch (failure) {
      if (Object.hasOwn(patch, 'musicTrack')) {
        selectMusic(savedSettings.musicTrack);
        if (musicStatus) musicStatus.textContent = failure.message;
      }
      if (cameraSelect) cameraSelect.value = savedSettings.cameraMode;
      if (characterSelect) characterSelect.value = savedSettings.hostCharacter || 'sakura';
      settingsError(failure.message);
    }
  }
  hostForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveSettings({ hostName: hostInput.value.trim() });
  });
  stageNameForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void saveSettings({ stageName: stageNameInput.value.trim() });
  });
  cameraSelect?.addEventListener('change', () => { void saveSettings({ cameraMode: cameraSelect.value }); });
  characterSelect?.addEventListener('change', () => { void saveSettings({ hostCharacter: characterSelect.value }); });
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
    if (event.type === 'top-gifters') {
      if (club?.setTopGifters(data)) renderTopGifters(data);
      return;
    }
    if (event.type === 'state') { updateState(data); return; }
    if (!club) return;
    if (event.type === 'member') return;
    if (event.type === 'chat') {
      const command = String(data.comment || '').trim().toLocaleLowerCase('vi');
      const requested = characters.find((item) => [`!${item.id}`, `nhân vật ${item.id}`, `nhan vat ${item.id}`].includes(command));
      if (requested) {
        club.addParticipant(data); club.selectCharacter(data.uniqueId, requested.id);
        club.showMessage(data, `${requested.name} · ${requested.dance}`);
      } else if (['đổi đồ', 'doi do', 'đổi nhân vật', 'doi nhan vat', 'đổi chó', 'doi cho', 'đổi cún', 'doi cun', '换修勾'].includes(command)) {
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
    const snapshot = club?.getSnapshot();
    if (!snapshot) return;
    if (snapshot.focusedUser && snapshot.focusedUser !== snapshot.hostId) {
      const name = club.changeAvatar(snapshot.focusedUser); if (name) announce('Nhân vật ' + name);
    } else {
      const index = characters.findIndex((item) => item.id === snapshot.hostCharacter);
      void saveSettings({ hostCharacter: characters[(index + 1) % characters.length].id });
    }
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

})();
