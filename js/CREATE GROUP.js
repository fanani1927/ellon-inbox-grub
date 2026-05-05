async function ellonCreateGroup(mode, uidMain, targetLink, cfg, lg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const maxGroups = parseInt(mode) || 10;
  let uidpushmessenger = [];
  let requestCount = 0;
  const baseNames = [
    "Private ladies site",
    "Chat Girl",
    "Live Cams Girl",
    "My Live Cams Room",
    "Passion Room",
    "Naughty Girls Room",
    "Room Full of Love",
    "Room Full of Passion",
  ];
  const emojis = ["❤️💋👙", "💦🔥", "😘🌹", "🍑🔞", "✨💖", "💋🔥"];

  function getRandomName() {
    const name = baseNames[Math.floor(Math.random() * baseNames.length)];
    const emoji = emojis[Math.floor(Math.random() * emojis.length)];
    const randomNum = Math.floor(Math.random() * 900) + 100;
    return `${name} ${randomNum} ${emoji}`;
  }

  function getUniversalConfig() {
    let actor_id = document.cookie.match(/c_user=(\d+)/)?.[1] || "";
    let fb_dtsg = document.querySelector('[name="fb_dtsg"]')?.value || "";
    let jazoest = document.querySelector('[name="jazoest"]')?.value || "";
    let rev = "1019431042",
      spin_r = "1019431042",
      spin_t = Math.floor(Date.now() / 1000).toString(),
      pc = "PHASED:DEFAULT",
      dpr = window.devicePixelRatio || 1;

    try {
      if (typeof window.require !== "undefined") {
        try {
          const sd = require("SiteData");
          if (sd) {
            rev = sd.revision || rev;
            spin_r = sd.__spin_r || sd.spin_r || spin_r;
            spin_t = sd.__spin_t || sd.spin_t || spin_t;
            pc = sd.server_revision || pc;
            dpr = sd.pr || dpr;
          }
        } catch (e) {}
        if (!actor_id)
          try {
            actor_id =
              require("CurrentUserInitialData")?.USER_ID ||
              require("CurrentUserInitialData")?.id;
          } catch (e) {}
        if (!fb_dtsg)
          try {
            fb_dtsg =
              require("DTSGInitialData")?.token ||
              require("DTSGInitData")?.token;
          } catch (e) {}
      }
    } catch (e) {}

    const html = document.documentElement.innerHTML;
    if (!fb_dtsg) {
      const m =
        html.match(/"DTSGInitialData",\[\],\{"token":"([^"]+)"\}/) ||
        html.match(/"token":"(NA[A-Za-z0-9_\-]+:[A-Za-z0-9_\-]+)"/);
      if (m) fb_dtsg = m[1];
    }
    if (!jazoest) {
      const m = html.match(/"jazoest":"(\d+)"/) || html.match(/jazoest=(\d+)/);
      if (m) jazoest = m[1];
    }
    if (!actor_id) {
      const m =
        html.match(/"actorID":"(\d+)"/) || html.match(/"USER_ID":"(\d+)"/);
      if (m) actor_id = m[1];
    }

    let dynValue = "";
    const dynP = [
      /"__dyn":"([^"]+)"/,
      /\\"__dyn\\":\\"([^"\\]+)\\"/,
      /name="__dyn"\s*value="([^"]+)"/,
    ];
    for (let p of dynP) {
      const m = html.match(p);
      if (m && m[1]) {
        dynValue = m[1];
        break;
      }
    }
    return {
      fb_dtsg,
      jazoest,
      actor_id,
      rev,
      spin_r,
      spin_t,
      spin_b: "trunk",
      pc,
      dpr,
      dynValue,
    };
  }

  async function scrapeGroups(config) {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append("fb_dtsg", config.fb_dtsg);
      formData.append(
        "q",
        `viewer(){message_threads{nodes{thread_key{thread_fbid,other_user_id},messages_count,thread_type,updated_time_precise}}}`,
      );
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/graphql/", true);
      xhr.withCredentials = true;
      xhr.onload = function () {
        if (xhr.status === 200) {
          try {
            const json = JSON.parse(xhr.responseText.replace("for (;;);", ""));
            const nodes =
              json?.viewer?.message_threads?.nodes ||
              json?.data?.viewer?.message_threads?.nodes ||
              [];
            nodes.forEach((n) => {
              if (n.thread_type === "GROUP" && n.thread_key?.thread_fbid)
                uidpushmessenger.push(n.thread_key.thread_fbid);
            });
            uidpushmessenger = [...new Set(uidpushmessenger)];
            resolve();
          } catch (e) {
            resolve();
          }
        } else resolve();
      };
      xhr.onerror = () => resolve();
      xhr.send(formData);
    });
  }

  async function fetchFriendsFallback(requiredCount, config) {
    lg("⚠️ Tidak ada file UID, mengekstrak data teman sebagai pengganti...");
    const params = new URLSearchParams({
      dpr: config.dpr,
      __a: "1",
      __af: "iw",
      __be: "-1",
      __pc: config.pc,
      __user: config.actor_id,
      __dyn: config.dynValue,
      __req: Math.floor(Math.random() * 10) + 1,
      __rev: config.rev,
      fb_dtsg: config.fb_dtsg,
      jazoest: config.jazoest,
      __spin_r: config.spin_r,
      __spin_b: config.spin_b,
      __spin_t: config.spin_t,
      viewer: config.actor_id,
      token: Math.random().toString(),
      "filter[0]": "user",
      "options[0]": "friends_only",
    });
    try {
      const r = await fetch(
        `/ajax/typeahead/first_degree.php?${params.toString()}`,
        {
          method: "POST",
          headers: {
            accept: "*/*",
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );
      const data = JSON.parse((await r.text()).replace("for (;;);", ""));
      const entries = data.payload ? data.payload.entries : [];
      let resultUids = [];
      if (entries.length > 0) {
        const uq = [...new Set(entries.map((item) => item.uid))];
        while (resultUids.length < requiredCount) {
          for (let i = 0; i < uq.length; i++) {
            if (resultUids.length < requiredCount) resultUids.push(uq[i]);
            else break;
          }
        }
        return resultUids;
      }
    } catch (e) {
      lg("Fetch Friends Error: " + e.message);
    }
    lg("Teman kosong, akan menduplikasi ID akun sendiri.");
    return Array(requiredCount).fill(config.actor_id);
  }

  async function createGroupGraphql(participants, config) {
    requestCount++;
    const pList = [{ fbid: config.actor_id }];
    participants.forEach((uid) => pList.push({ fbid: String(uid).trim() }));
    const variables = {
      input: {
        client_mutation_id: String(
          Math.round(Date.now() / 1000) + requestCount,
        ),
        actor_id: config.actor_id,
        participants: pList,
        thread_settings: {
          name: getRandomName(),
          joinable_mode: "PRIVATE",
          thread_image_fbid: null,
        },
        entry_point: "chat_sidebar_new_group",
      },
    };
    const body = new URLSearchParams({
      dpr: config.dpr,
      __a: "1",
      __af: "iw",
      __be: "-1",
      __pc: config.pc,
      __user: config.actor_id,
      __req: requestCount.toString(36),
      __rev: config.rev,
      fb_dtsg: config.fb_dtsg,
      jazoest: config.jazoest,
      __spin_r: config.spin_r,
      __spin_b: config.spin_b,
      __spin_t: config.spin_t,
      doc_id: "577041672419534",
      fb_api_req_friendly_name: "MessengerGroupCreateMutation",
      av: config.actor_id,
      fb_api_caller_class: "RelayModern",
      variables: JSON.stringify(variables),
    });
    try {
      const res = await fetch("/api/graphql/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body,
      });
      return JSON.parse((await res.text()).replace("for (;;);", ""));
    } catch (e) {
      return { error: e.message };
    }
  }

  const config = getUniversalConfig();
  if (!config.fb_dtsg) {
    lg("Gagal ekstrak kredensial akun. Pastikan login berhasil.");
    return;
  }

  lg(`Mengecek jumlah grup saat ini...`);
  await scrapeGroups(config);
  let currentGrpCount = uidpushmessenger.length;

  if (currentGrpCount >= maxGroups) {
    lg(
      `Grup di akun ini sudah ${currentGrpCount} atau lebih. (Limit: ${maxGroups}). Melewati pembuatan grup.`,
    );
    return;
  }

  let requiredCount = maxGroups - currentGrpCount;
  lg(
    `Grup saat ini: ${currentGrpCount}. Butuh membuat ${requiredCount} grup lagi.`,
  );

  const isiGrup = parseInt(cfg.memReq) || 1;
  const uidNeeded = requiredCount * isiGrup;

  if (!uidMain || uidMain.length === 0) {
    uidMain = await fetchFriendsFallback(uidNeeded, config);
  }

  const delayAwal = (parseFloat(cfg.dlAwal) || 0) * 1000;
  const delayLanjut = (parseFloat(cfg.dlLanjut) || 0) * 1000;
  const grupSampaiKe = parseInt(cfg.grpKe) || 1;

  let currentIdx = 0,
    groupIndex = 0;

  while (currentIdx < uidMain.length && groupIndex < requiredCount) {
    let delayToUse = groupIndex < grupSampaiKe ? delayAwal : delayLanjut;
    if (delayToUse > 0) {
      lg(`Menunggu delay buat grup ${delayToUse / 1000} detik...`);
      await sleep(delayToUse);
    }
    const chunk = uidMain.slice(currentIdx, currentIdx + isiGrup);
    const result = await createGroupGraphql(chunk, config);

    if (result.data && result.data.messenger_group_thread_create) {
      lg(`[${groupIndex + 1}/${requiredCount}] Grup berhasil dibuat!`);
    } else if (result.error === 1357032) {
      lg(
        `[${groupIndex + 1}/${requiredCount}] Gagal: Error FB 1357032 (Limit/Terblokir). Proses dihentikan.`,
      );
      break;
    } else {
      lg(
        `[${groupIndex + 1}/${requiredCount}] Gagal dibuat: ${
          result.errorDescription || "Unknown Error"
        }`,
      );
    }

    currentIdx += isiGrup;
    groupIndex++;
  }

  lg("Tugas pembuatan grup selesai!");
}
