async function ellonAddMember(mode, uidMain, targetLink, cfg, lg) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let uidpushmessenger = JSON.parse(
    sessionStorage.getItem("ellon_uidpushmessenger") || "[]",
  );
  let skipAdd = false;
  let skipInbox = false;
  if (mode === "Tambah member & Inbox") {
    if (uidMain.length === 0 && targetLink) skipAdd = true;
    else if (uidMain.length > 0 && !targetLink) skipInbox = true;
  } else if (mode === "Tambah member") {
    skipInbox = true;
  }
  function getFBData() {
    let f = "",
      u = "",
      j = "",
      l = "",
      r = "";
    try {
      if (typeof window.require !== "undefined") {
        try {
          f = window.require("DTSGInitialData").token;
        } catch (e) {}
        try {
          u = window.require("CurrentUserInitialData").USER_ID;
        } catch (e) {}
        try {
          l = window.require("SiteData").lsd;
        } catch (e) {}
        try {
          r = window.require("SiteData").server_revision;
        } catch (e) {}
      }
      if (!f) f = document.querySelector('input[name="fb_dtsg"]')?.value || "";
      if (!l) l = document.querySelector('input[name="lsd"]')?.value || "";
      if (!u) u = document.cookie.match(/c_user=(\d+)/)?.[1] || "";
      let html = document.documentElement.innerHTML;
      if (!f) {
        let m = html.match(/"token":"(.*?)"/);
        if (m) f = m[1];
      }
      if (!l) {
        let m = html.match(/"LSD",\[\],\{"token":"(.*?)"/);
        if (m) l = m[1];
      }
      if (!r) {
        let m = html.match(/"server_revision":(\d+)/);
        if (m) r = m[1];
      }
      if (f) {
        let c = 0;
        for (let i = 0; i < f.length; i++) c += f.charCodeAt(i);
        j = "2" + c;
      }
    } catch (e) {
      lg("Parse Info Err: " + e.message);
    }
    return { fb_dtsg: f, user_id: u, jazoest: j, lsd: l, rev: r };
  }
  async function scrapeGroups() {
    const d = getFBData();
    if (!d.fb_dtsg) {
      lg("fb_dtsg tidak ditemukan, batal scrape.");
      return;
    }
    lg("Mengambil daftar grup (Scraping)...");
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append("fb_dtsg", d.fb_dtsg);
      formData.append(
        "q",
        `viewer(){message_threads{nodes{thread_key{thread_fbid,other_user_id},messages_count,thread_type,updated_time_precise}}}`,
      );
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "https://www.facebook.com/api/graphql/", true);
      xhr.withCredentials = true;
      xhr.onload = function () {
        if (xhr.status === 200) {
          try {
            const json = JSON.parse(xhr.responseText.replace("for (;;);", ""));
            const nodes =
              json?.viewer?.message_threads?.nodes ||
              json?.data?.viewer?.message_threads?.nodes ||
              [];
            if (nodes.length === 0) {
              lg(
                json.errors
                  ? "FB Error: " + json.errors[0].message
                  : "Data kosong.",
              );
              return resolve();
            }
            nodes.forEach((n) => {
              if (n.thread_type === "GROUP" && n.thread_key?.thread_fbid)
                uidpushmessenger.push(n.thread_key.thread_fbid);
            });
            uidpushmessenger = [...new Set(uidpushmessenger)];
            lg("Berhasil menemukan " + uidpushmessenger.length + " grup.");
            resolve();
          } catch (e) {
            resolve();
          }
        } else resolve();
      };
      xhr.onerror = function () {
        resolve();
      };
      xhr.send(formData);
    });
  }
  async function addMembers() {
    if (uidpushmessenger.length === 0 || uidMain.length === 0) return true;
    const d = getFBData();
    const count_members = parseInt(cfg.memReq) || 1;
    const delay_inbox_awal = (parseFloat(cfg.dlAwal) || 1) * 1000;
    const delay_selanjutnya = (parseFloat(cfg.dlLanjut) || 1) * 1000;
    const grup_sampai_ke = parseInt(cfg.grpKe) || 1;
    const total_uid_input = uidMain.length;
    const total_groups = uidpushmessenger.length;
    const max_groups_from_uid = Math.floor(total_uid_input / count_members);
    const groups_to_process = Math.min(total_groups, max_groups_from_uid);
    if (groups_to_process === 0) {
      lg("UID terlalu sedikit untuk Member/Req yang ditentukan.");
      return true;
    }
    let startKirim = window.ellonResumeIndex || 0;
    let rl = startKirim * count_members;
    let threadLoop = parseInt(
      sessionStorage.getItem("ellon_thread_idx") || "0",
    );
    if (startKirim === 0) {
      lg(
        "Memproses Add Member pada " +
          groups_to_process +
          " Grub menggunakan " +
          total_uid_input +
          " UID...",
      );
    }
    for (let kirim = startKirim; kirim < groups_to_process; kirim++) {
      let currentDelay =
        kirim < grup_sampai_ke ? delay_inbox_awal : delay_selanjutnya;
      if (currentDelay > 0) {
        lg(`Menunggu delay add member ${currentDelay / 1000}s...`);
        await sleep(currentDelay);
      }
      let uidLoop = 0;
      let members = [];
      const endLoop = Math.min(rl + count_members, total_uid_input);
      for (let loop = rl; loop < endLoop; loop++) {
        members.push(
          "log_message_data[added_participants][" +
            uidLoop +
            "]=fbid:" +
            uidMain[loop],
        );
        uidLoop++;
      }
      rl += count_members;
      let chunkStr = members.join("&");
      let trd = uidpushmessenger[threadLoop % uidpushmessenger.length];
      let data_pm = {
        action_type: "ma-type:log-message",
        ephemeral_ttl_mode: 0,
        has_attachment: false,
        message_id: Math.floor(Math.random() * 1e15),
        offline_threading_id: Math.floor(Math.random() * 1e15),
        log_message_type: "log:subscribe",
        source: "source:chat:web",
        thread_fbid: trd,
        timestamp: Date.now(),
      };
      try {
        if (typeof window.require !== "undefined")
          Object.assign(data_pm, window.require("getAsyncParams")("POST"));
      } catch (e) {}
      if (!data_pm.__user) data_pm.__user = d.user_id;
      if (!data_pm.__a) data_pm.__a = 1;
      if (!data_pm.fb_dtsg) data_pm.fb_dtsg = d.fb_dtsg;
      if (!data_pm.jazoest) data_pm.jazoest = d.jazoest;
      if (!data_pm.__rev && d.rev) data_pm.__rev = d.rev;
      let urlBody = new URLSearchParams(data_pm).toString();
      let finalBody = decodeURIComponent(chunkStr + "&" + urlBody);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const myheaders = new Headers();
        myheaders.append("content-type", "application/x-www-form-urlencoded");
        const r = await fetch("/messaging/send/", {
          method: "POST",
          headers: myheaders,
          body: finalBody,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const rawTxt = await r.text();
        if (!rawTxt || rawTxt.trim() === "")
          lg("Gagal Add Grup " + trd + " : Respons Kosong");
        else if (rawTxt.startsWith("for (;;);")) {
          const js = JSON.parse(rawTxt.replace("for (;;);", ""));
          if (js.error)
            lg(
              "Gagal Add Grup " +
                trd +
                " : " +
                (js.errorDescription || "Error"),
            );
          else lg(`[${kirim + 1}/${groups_to_process}] Sukses Add Grup ${trd}`);
        } else lg("Gagal Add Grup " + trd + " : Format FB Berubah");
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === "AbortError") {
          if (!document.cookie.includes("c_user=")) {
            lg("Akun terlogout. Menghentikan proses.");
            sessionStorage.clear();
            window.ellonTaskDone = true;
            return false;
          } else {
            lg(
              "Stuck 1 menit di Add Member. Merefresh halaman untuk melanjutkan...",
            );
            window.ellonResumeIndex = kirim + 1;
            sessionStorage.setItem(
              "ellon_thread_idx",
              (threadLoop + 1).toString(),
            );
            sessionStorage.setItem("ellon_stage", "ADD");
            window.ellonTaskRefresh = true;
            return false;
          }
        } else lg("Fetch Err: " + e.message);
      }
      threadLoop++;
    }
    sessionStorage.setItem("ellon_stage", "INBOX");
    return true;
  }
  async function scrapeUrl(url) {
    const d = getFBData();
    const b = new URLSearchParams();
    b.append("__user", d.user_id);
    b.append("__a", "1");
    b.append("__req", "u");
    if (d.rev) b.append("__rev", d.rev);
    b.append("fb_dtsg", d.fb_dtsg);
    b.append("jazoest", d.jazoest);
    if (d.lsd) b.append("lsd", d.lsd);
    b.append("image_height", "960");
    b.append("image_width", "960");
    b.append("uri", url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const r = await fetch("/message_share_attachment/fromURI/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: b.toString(),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const txt = await r.text();
      const j = JSON.parse(txt.replace("for (;;);", ""));
      return j.payload?.share_data?.share_params || null;
    } catch (e) {
      clearTimeout(timeout);
      return null;
    }
  }
  async function sendInbox(url) {
    if (uidpushmessenger.length === 0) return true;
    const oldLength = uidpushmessenger.length;
    uidpushmessenger = [...new Set(uidpushmessenger)];
    if (oldLength !== uidpushmessenger.length) {
      lg(
        `Membersihkan ID grup duplikat. Target Inbox menjadi ${uidpushmessenger.length} grup unik.`,
      );
    }
    const d = getFBData();
    let startInbox = window.ellonResumeIndex || 0;
    let meta = null;
    if (startInbox === 0) {
      lg("Mengekstrak Metadata Link Inbox dari FB...");
      meta = await scrapeUrl(url);
      if (meta)
        lg(
          `Sukses Ekstrak Link! Judul: ${meta.title || "Ada"}, ID: ${meta.url_scrape_id}`,
        );
      else lg("Gagal mendapat preview. Akan mengirim link sebagai teks biasa.");
      lg("Mulai Inbox ke " + uidpushmessenger.length + " grup...");
    }
    const delayInbox = (parseFloat(cfg.dlInbox) || 0.5) * 1000;
    for (let i = startInbox; i < uidpushmessenger.length; i++) {
      let trd = uidpushmessenger[i];
      let msgId = Math.floor(Math.random() * 1e16).toString();
      let b = new URLSearchParams();
      b.append("__user", d.user_id);
      b.append("__a", "1");
      b.append("__req", "1s");
      if (d.rev) b.append("__rev", d.rev);
      b.append("fb_dtsg", d.fb_dtsg);
      b.append("jazoest", d.jazoest);
      if (d.lsd) b.append("lsd", d.lsd);
      b.append("client", "mercury");
      b.append("action_type", "ma-type:user-generated-message");
      b.append("author", "fbid:" + d.user_id);
      b.append("timestamp", Date.now());
      b.append("source", "source:chat:web");
      b.append("body", meta ? "" : url);
      b.append("status", "0");
      b.append("offline_threading_id", msgId);
      b.append("message_id", msgId);
      b.append("thread_fbid", trd);
      if (meta) {
        b.append("has_attachment", "true");
        b.append("shareable_attachment[share_type]", "100");
        [
          "title",
          "summary",
          "url",
          "global_share_id",
          "url_scrape_id",
          "hmac",
        ].forEach((k) => {
          if (meta[k])
            b.append(`shareable_attachment[share_params][${k}]`, meta[k]);
        });
        if (meta.images && meta.images.length > 0) {
          b.append(
            "shareable_attachment[share_params][images][0]",
            meta.images[0],
          );
        }
      } else b.append("has_attachment", "false");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const r = await fetch("/messaging/send/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: b.toString(),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const txt = await r.text();
        if (txt.startsWith("for (;;);")) {
          const js = JSON.parse(txt.replace("for (;;);", ""));
          if (js.error)
            lg(
              "Gagal Inbox Grup " +
                trd +
                " : " +
                (js.errorDescription || "Error"),
            );
          else
            lg(
              `[${i + 1}/${uidpushmessenger.length}] Sukses Inbox Grup ${trd}`,
            );
        } else lg("Gagal Inbox Grup " + trd + " : Format FB Berubah");
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === "AbortError") {
          if (!document.cookie.includes("c_user=")) {
            lg("Akun terlogout. Menghentikan proses.");
            sessionStorage.clear();
            window.ellonTaskDone = true;
            return false;
          } else {
            lg("Stuck 1 menit di Inbox. Merefresh halaman...");
            window.ellonResumeIndex = i + 1;
            sessionStorage.setItem("ellon_stage", "INBOX");
            window.ellonTaskRefresh = true;
            return false;
          }
        } else lg("Fetch Error: " + e.message);
      }
      if (i < uidpushmessenger.length - 1 && delayInbox > 0)
        await sleep(delayInbox);
    }
    return true;
  }
  let stage = sessionStorage.getItem("ellon_stage") || "START";
  if (stage === "START") {
    await scrapeGroups();
    if (cfg.dupCheck) {
      let original = [...uidpushmessenger];
      let duplicated = [];
      const count = parseInt(cfg.dupCount) || 10;
      for (let i = 0; i < count; i++) duplicated = duplicated.concat(original);
      uidpushmessenger = duplicated;
    }
    sessionStorage.setItem(
      "ellon_uidpushmessenger",
      JSON.stringify(uidpushmessenger),
    );
    sessionStorage.setItem("ellon_stage", "ADD");
    stage = "ADD";
  }
  if (stage === "ADD") {
    if (!skipAdd) {
      let res = await addMembers();
      if (!res) return;
    } else sessionStorage.setItem("ellon_stage", "INBOX");
    stage = sessionStorage.getItem("ellon_stage");
  }
  if (stage === "INBOX") {
    if (!skipInbox && targetLink) {
      let res = await sendInbox(targetLink);
      if (!res) return;
    }
  }
  sessionStorage.clear();
  window.ellonTaskDone = true;
}
