(() => {
  "use strict";
  const form = document.getElementById("connect-form");
  const username = document.getElementById("username");
  const connectButton = document.getElementById("connect");
  const disconnectButton = document.getElementById("disconnect");
  const status = document.getElementById("status");
  const error = document.getElementById("error");
  const dogs = new Map();
  let connectedUser = "";
  let activityTimer;
  let sourceAvailable = false;

  function showError(message) {
    error.textContent = message || "";
    error.hidden = !message;
  }

  function updateState(state) {
    connectButton.disabled = Boolean(state.connecting);
    disconnectButton.disabled = !state.connected && !state.connecting;
    status.classList.toggle("connected", Boolean(state.connected));
    status.textContent = state.connecting
      ? `Đang kết nối ${state.username ? "@" + state.username : "TikTok"}…`
      : state.connected
        ? `Đã kết nối @${state.username}`
        : "Chưa kết nối TikTok";
    document.getElementById("viewers").textContent =
      `${Number(state.viewerCount) || 0} người xem`;
    showError(state.lastError);
    if (state.username && !username.value)
      username.value = "@" + state.username;
    if (state.connected && connectedUser !== state.username) {
      connectedUser = state.username;
      dogs.forEach((dog) => {
        clearTimeout(dog.timer);
        dog.element.remove();
      });
      dogs.clear();
      createDog({
        uniqueId: "host:" + state.username,
        nickname: "@" + state.username,
      });
    }
  }

  async function request(action, body) {
    const response = await fetch("/api/live/" + action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.error || "Không gửi được yêu cầu.");
    return result;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!sourceAvailable) {
      showError("Đang chờ kết nối với server. Vui lòng thử lại sau.");
      return;
    }
    showError("");
    connectButton.disabled = true;
    try {
      await request("connect", { username: username.value.trim() });
    } catch (failure) {
      showError(failure.message);
      connectButton.disabled = false;
    }
  });
  disconnectButton.addEventListener("click", async () => {
    try {
      await request("disconnect");
    } catch (failure) {
      showError(failure.message);
    }
  });

  function createDog(user) {
    const key = String(user.uniqueId || user.nickname || "viewer");
    if (dogs.has(key)) return dogs.get(key);
    if (dogs.size >= 120) {
      const oldestKey = dogs.keys().next().value;
      const oldest = dogs.get(oldestKey);
      clearTimeout(oldest.timer);
      oldest.element.remove();
      dogs.delete(oldestKey);
    }
    const element = document.createElement("div");
    element.className = "dog";
    element.dataset.user = key;
    element.style.left = 7 + Math.random() * 86 + "%";
    element.style.top = 43 + Math.random() * 35 + "%";
    const message = document.createElement("p");
    message.className = "dog-message";
    message.hidden = true;
    const name = document.createElement("p");
    name.className = "dog-name";
    name.textContent = String(user.nickname || key).slice(0, 60);
    const image = document.createElement("img");
    image.src = "/img/gif/dog" + (1 + Math.floor(Math.random() * 4)) + ".gif";
    image.alt = "";
    element.append(message, name, image);
    document.getElementById("dogs").appendChild(element);
    const dog = { element, message, image, timer: null };
    dogs.set(key, dog);
    return dog;
  }

  function speak(user, text) {
    const dog = createDog(user);
    clearTimeout(dog.timer);
    dog.message.textContent = String(text).slice(0, 500);
    dog.message.hidden = false;
    dog.timer = setTimeout(() => {
      dog.message.hidden = true;
    }, 4500);
    return dog;
  }

  function announce(text) {
    const activity = document.getElementById("activity");
    clearTimeout(activityTimer);
    activity.textContent = text;
    activityTimer = setTimeout(() => {
      activity.textContent = "";
    }, 4000);
  }

  function handleEvent(event) {
    const data = event.data;
    if (event.type === "state") {
      updateState(data);
      return;
    }
    if (event.type === "member") {
      createDog(data);
      return;
    }
    if (event.type === "chat") {
      const dog = createDog(data);
      const command = data.comment.trim().toLocaleLowerCase("vi");
      if (
        ["đổi chó", "doi cho", "đổi cún", "doi cun", "换修勾"].includes(command)
      ) {
        const current = Number(
          dog.image.src.match(/dog([1-4])\.gif/)?.[1] || 1,
        );
        dog.image.src =
          "/img/gif/dog" +
          (((current + Math.floor(Math.random() * 3)) % 4) + 1) +
          ".gif";
        speak(data, "Đã đổi nhân vật!");
      } else speak(data, data.comment);
      return;
    }
    const dog = createDog(data);
    dog.element.classList.remove("reacting");
    void dog.element.offsetWidth;
    dog.element.classList.add("reacting");
    if (event.type === "gift") {
      speak(data, `🎁 ${data.count} × ${data.giftName}`);
      announce(`${data.nickname} tặng ${data.count} × ${data.giftName}`);
    } else if (event.type === "like") speak(data, `♥ +${data.count}`);
    else if (event.type === "follow") speak(data, "★ Đã theo dõi");
    else if (event.type === "share") speak(data, "↗ Đã chia sẻ");
  }

  const events = new EventSource("/api/live/events");
  let openedBefore = false;
  events.onopen = () => {
    sourceAvailable = true;
    fetch("/api/live/state")
      .then((response) => response.json())
      .then(updateState)
      .catch(() => {});
    if (
      !openedBefore &&
      username.value &&
      new URLSearchParams(location.search).get("connect") === "1"
    ) {
      form.requestSubmit();
    }
    openedBefore = true;
  };
  events.onmessage = (message) => {
    try {
      handleEvent(JSON.parse(message.data));
    } catch (failure) {
      console.error("Không đọc được sự kiện live:", failure);
    }
  };
  events.onerror = () => {
    sourceAvailable = false;
    status.textContent = "Mất kết nối server, đang thử lại…";
    status.classList.remove("connected");
    disconnectButton.disabled = true;
  };

  const music = document.getElementById("music");
  const enableMusic = document.getElementById("enable-music");
  music.src =
    "/music/YTSave.to_YouTube_Media_7f-49jDbK10_NONSTOP-VINAHOUSE-2025-VÀO-PHÒNG-BAY-PHẢI-MỞ-BÀI-NÀY-NHẠC-SÀN-BAY-PHÒNG-BASS-CĂN_009_vbr.mp3";
  music.volume = 0.4;
  music.autoplay = true;
  music.loop = true;
  function hideMusicPrompt() {
    enableMusic.hidden = true;
    document.removeEventListener("pointerdown", startMusic);
    document.removeEventListener("keydown", startMusic);
  }
  async function startMusic() {
    try {
      await music.play();
      hideMusicPrompt();
    } catch (failure) {
      if (failure.name === "NotAllowedError") {
        enableMusic.hidden = false;
        document.addEventListener("pointerdown", startMusic);
        document.addEventListener("keydown", startMusic);
      }
    }
  }
  music.addEventListener("play", hideMusicPrompt);
  enableMusic.addEventListener("click", startMusic);
  music.addEventListener("error", () => {
    hideMusicPrompt();
    announce("Không tải được nhạc nền. Hãy tải lại trang để thử lại.");
  });
  void startMusic();
  createDog({ uniqueId: "disco", nickname: "MythMaker" });
  const obs = new URLSearchParams(location.search).get("obs") === "1";
  if (obs) {
    document.body.classList.add("obs");
    const show = document.getElementById("show-controls");
    show.hidden = false;
    show.addEventListener("click", () => {
      document.body.classList.remove("obs");
      show.hidden = true;
    });
  }
})();
