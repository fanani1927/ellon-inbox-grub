function executeXPath(xpath) {
  const result = document.evaluate(
    xpath,
    document,
    null,
    XPathResult.FIRST_ORDERED_NODE_TYPE,
    null,
  );
  return result.singleNodeValue;
}

function safeClick(element) {
  if (!element) return false;

  try {
    const rect = element.getBoundingClientRect();
    const mouseDownEvent = new MouseEvent("mousedown", {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    const mouseUpEvent = new MouseEvent("mouseup", {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });
    const clickEvent = new MouseEvent("click", {
      view: window,
      bubbles: true,
      cancelable: true,
      buttons: 1,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
    });

    element.dispatchEvent(mouseDownEvent);
    setTimeout(() => {
      element.dispatchEvent(mouseUpEvent);
      setTimeout(() => {
        element.dispatchEvent(clickEvent);
      }, 50);
    }, 50);

    return true;
  } catch (e) {
    return false;
  }
}

const dismissKeywords = [
  "Tutup",
  "Dismiss",
  "Nanti Saja",
  "Lewati",
  "Tidak, Terima Kasih",
  "Dismiss",
  "Close",
  "Not Now",
  "Maybe Later",
  "No Thanks",
  "Skip",
  "Schließen",
  "Später",
  "Überspringen",
  "Nein Danke",
  "Fermer",
  "Plus tard",
  "Passer",
  "Non merci",
  "Cerrar",
  "Ahora no",
  "Omitir",
  "No gracias",
  "Chiudi",
  "Più tardi",
  "Salta",
  "No grazie",
  "Fechar",
  "Agora não",
  "Ignorar",
  "Não obrigado",
  "Sluiten",
  "Niet nu",
  "Overslaan",
  "Nee bedankt",
  "Закрыть",
  "Не сейчас",
  "Пропустить",
  "Нет, спасибо",
  "閉じる",
  "後で",
  "スキップ",
  "いいえ、結構です",
  "닫기",
  "나중에",
  "건너뛰기",
  "아니요, 괜찮습니다",
  "إغلاق",
  "ليس الآن",
  "تخطي",
  "لا شكرا",
  "ปิด",
  "ไม่ใช่ตอนนี้",
  "ข้าม",
  "ไม่ขอบคุณ",
  "Đóng",
  "Không phải bây giờ",
  "Bỏ qua",
  "Không, cảm ơn",
  "Kapat",
  "Şimdi değil",
  "Atla",
  "Hayır, teşekkürler",
  "Zamknij",
  "Nie teraz",
  "Pomiń",
  "Nie, dziękuję",
  "Stäng",
  "Inte nu",
  "Hoppa över",
  "Nej tack",
  "Luk",
  "Ikke nu",
  "Spring over",
  "Nej tak",
  "Lukk",
  "Ikke nå",
  "Hopp over",
  "Nei takk",
  "Sulje",
  "Ei nyt",
  "Ohita",
  "Ei kiitos",
  "Zavřít",
  "Teď ne",
  "Přeskočit",
  "Ne, děkuji",
  "Κλείσιμο",
  "Όχι τώρα",
  "Παράλειψη",
  "Όχι, ευχαριστώ",
  "Bezár",
  "Most nem",
  "Kihagyás",
  "Nem, köszönöm",
  "Închide",
  "Nu acum",
  "Omite",
  "Nu, mulțumesc",
  "Zavrieť",
  "Teraz nie",
  "Preskočiť",
  "Nie, ďakujem",
  "Zatvori",
  "Ne sada",
  "Preskoči",
  "Ne, hvala",
  "Затвори",
  "Не сега",
  "Пропусни",
  "Не, благодаря",
  "Затвори",
  "Не сада",
  "Прескочи",
  "Не, хвала",
  "Закрити",
  "Не зараз",
  "Пропустити",
  "Ні, дякую",
  "סגור",
  "לא עכשיו",
  "דלג",
  "לא, תודה",
  "बंद करें",
  "अभी नहीं",
  "छोड़ें",
  "जी नहीं, धन्यवाद",
  "বন্ধ করুন",
  "এখন না",
  "এড়িয়ে যান",
  "না, धन्यवाद",
  "மூடுக",
  "இப்போது இல்லை",
  "தவிர்க்கவும்",
  "இல்லை, நன்றி",
  "మూసివేయండి",
  "ఇప్పుడు కాదు",
  "దాటవేయండి",
  "కాదు, ధన్యవాదలు",
  "बंद करा",
  "आता नाही",
  "टळकावा",
  "नाही, धन्यवाद",
  "બંધ કરો",
  "હવે નહીં",
  "છોડી દો",
  "ના, આભાર",
  "ಮುಚ್ಚಿ",
  "ಈಗ ಅಲ್ಲ",
  "ಬಿಟ್ಟು",
  "ಇಲ್ಲ, ಧನ್ಯವಾದಗಳು",
  "അടയ്ക്കുക",
  "ഇപ്പോൾ അല്ല",
  "ഒഴിവാക്കുക",
  "ഇല്ല, നന്ദി",
  "ਬੰਦ ਕਰੋ",
  "ਹੁਣੇ ਨਹੀਂ",
  "ਛੱਡੋ",
  "ਨਹੀਂ, ਧੰਨਵਾਦ",
  "بند کریں",
  "ابھی نہیں",
  "چھوڑ دیں",
  "نہیں، شکریہ",
];

const dismissXPaths = [];

dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(
    `//span[contains(@class, "xuxw1ft") and text()="${keyword}"]`,
  );
});
dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(`//div[@role="none"]//span[text()="${keyword}"]`);
});
dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(
    `//div[contains(@class, "html-div")]//span[text()="${keyword}"]`,
  );
});
dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(`//button[contains(@aria-label, "${keyword}")]`);
});
dismissXPaths.push(
  '//button[contains(@data-testid, "dismiss") or contains(@data-testid, "close") or contains(@data-testid, "exit_survey")]',
);
dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(
    `//button[contains(@class, "x1i10hfl") and contains(text(), "${keyword}")]`,
  );
});
dismissKeywords.forEach((keyword) => {
  dismissXPaths.push(
    `//span[contains(@class, "xuxw1ft") and contains(text(), "${keyword}")]`,
  );
});
dismissXPaths.push(
  '//button[contains(@aria-label, "Dismiss") or contains(@aria-label, "Close") or contains(@aria-label, "Tutup") or contains(@aria-label, "Not Now") or contains(@aria-label, "Maybe Later") or contains(@aria-label, "No Thanks") or contains(@aria-label, "Skip") or contains(@aria-label, "Lewati") or contains(@aria-label, "Nanti Saja")]',
);

function findAndClickDismiss() {
  for (const xpath of dismissXPaths) {
    try {
      const element = executeXPath(xpath);
      if (element) {
        if (safeClick(element)) {
          return true;
        }
      }
    } catch (e) {}
  }
  return false;
}

let dismissInterval = null;

function isCheckpointPage() {
  return window.location.href.includes("/checkpoint/");
}

function startDismissInterval() {
  if (dismissInterval) return;
  dismissInterval = setInterval(() => {
    if (!isCheckpointPage()) {
      stopDismissInterval();
      return;
    }
    findAndClickDismiss();
  }, 2000);
}

function stopDismissInterval() {
  if (dismissInterval) {
    clearInterval(dismissInterval);
    dismissInterval = null;
  }
}

if (isCheckpointPage()) {
  startDismissInterval();
}

let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    if (isCheckpointPage()) {
      startDismissInterval();
    } else {
      stopDismissInterval();
    }
  }
}).observe(document, { subtree: true, childList: true });
