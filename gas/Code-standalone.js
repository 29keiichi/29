/**
 * エアコンクリーニングイチロー 予約受付
 * ホームページの予約フォームから届いた内容を、スプレッドシートの
 * 「予約一覧」と「顧客台帳」に書き込み、お客さまとお店にメールを送ります。
 */
const SHOP = { name: "エアコンクリーニングイチロー", tel: "080-6677-5431" };

const BOOKING_SHEET = "予約一覧";
const CUSTOMER_SHEET = "顧客台帳";

const BOOKING_HEAD = [
  "受付日時", "予約番号", "顧客番号", "お名前", "電話番号", "メールアドレス",
  "市町村", "郵便番号", "ご住所", "住居タイプ", "駐車場",
  "第1希望日", "第1希望時間", "第2希望日", "第2希望時間", "第3希望日", "第3希望時間",
  "エアコンの内容", "水回り・おそうじの内容", "エアコン小計", "水回り小計", "合計金額",
  "壁掛け台数", "天井埋込台数", "メーカー・型式・製造年", "ご要望・備考",
  "状態", "作業確定日時", "お店のメモ", "写真（エアコン全体）", "写真（リモコン）"
];
const CUSTOMER_HEAD = [
  "顧客番号", "お名前", "電話番号", "メールアドレス", "市町村", "郵便番号", "ご住所",
  "住居タイプ", "駐車場", "初回予約日", "最終予約日", "予約回数", "累計金額", "最終予約番号", "お店のメモ"
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById("1riqCOmaPJYhp4CJzDyqL04iGNQVquX9DVzJdmmnfTxU");
    if (ss.getSpreadsheetTimeZone() !== "Asia/Tokyo") ss.setSpreadsheetTimeZone("Asia/Tokyo");
    const bs = sheet_(ss, BOOKING_SHEET, BOOKING_HEAD);
    const cs = sheet_(ss, CUSTOMER_SHEET, CUSTOMER_HEAD);
    const now = new Date();
    const id = bookingId_(bs, now);
    const total = Number(d.total) || 0;
    const customerId = upsertCustomer_(cs, d, now, id, total);

    bs.appendRow([
      now, id, customerId, d.name, "'" + (d.phone || ""), d.email,
      d.city, "'" + (d.zip || ""), d.address, d.housing, d.parking,
      d.date1, d.time1, d.date2, d.time2, d.date3, d.time3,
      d.aircon_items || "", d.house_items || "",
      Number(d.aircon_total) || 0, Number(d.house_total) || 0, total,
      Number(d.wall_units) || 0, Number(d.ceiling_units) || 0, d.model || "", d.note || "",
      "未確認", "", "", "", ""
    ]);

    // 写真が届いていたらドライブに保存し、台帳にリンクを書く（失敗しても予約は受け付ける）
    const photos = savePhotos_(d, id);
    if (photos.unit || photos.remote) {
      bs.getRange(bs.getLastRow(), BOOKING_HEAD.length - 1, 1, 2).setValues([[photos.unit, photos.remote]]);
    }

    mailCustomer_(d, id);
    mailShop_(d, id, customerId, ss.getUrl(), photos);
    return json_({ ok: true, id: id, customer: customerId });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (e && e.parameter && e.parameter.mode === "slots") return json_(slots_());
  return json_({ ok: true, message: SHOP.name + " 予約受付は動いています" });
}

/** 1日の時間枠（予約フォームの時間帯と対応） */
const SLOT_DEFS = [
  { start: 9, end: 12 }, { start: 12, end: 15 }, { start: 15, end: 18 }, { start: 18, end: 21 }
];

/**
 * 空き枠を返す（今日の3日後〜60日後）。
 * 店長のGoogleカレンダーで、時間の入った予定が重なる枠は closed（true）にする。
 * 2時間以上の予定が同じ日に2つ以上ある日は「1日2件まで」のルールで丸ごと閉じる。
 * 外に出すのは「閉まっているかどうか」だけで、予定の名前や内容は出さない。
 */
function slots_() {
  const DAY = 86400000, HOUR = 3600000;
  const jst0 = Math.floor((Date.now() + 9 * HOUR) / DAY) * DAY - 9 * HOUR; // 今日0時（日本時間）
  const cal = CalendarApp.getDefaultCalendar();
  const events = cal.getEvents(new Date(jst0 + 3 * DAY), new Date(jst0 + 61 * DAY))
    .filter(ev => !ev.isAllDayEvent());
  const days = {};
  for (let i = 3; i <= 60; i++) {
    const d0 = jst0 + i * DAY;
    const dayEvs = events.filter(ev => ev.getStartTime().getTime() < d0 + DAY && ev.getEndTime().getTime() > d0);
    const longCount = dayEvs.filter(ev => {
      const s = ev.getStartTime().getTime(), en = ev.getEndTime().getTime();
      return en - s >= 2 * HOUR && s < d0 + 21 * HOUR && en > d0 + 9 * HOUR;
    }).length;
    days[Utilities.formatDate(new Date(d0), "Asia/Tokyo", "yyyy-MM-dd")] = SLOT_DEFS.map(sl => {
      if (longCount >= 2) return true;
      const ss = d0 + sl.start * HOUR, se = d0 + sl.end * HOUR;
      return dayEvs.some(ev => ev.getStartTime().getTime() < se && ev.getEndTime().getTime() > ss);
    });
  }
  return { ok: true, days: days };
}

/** 予約番号：R + 年月日 + その日の何件目（例 R261023-1） */
function bookingId_(bs, now) {
  const day = Utilities.formatDate(now, "Asia/Tokyo", "yyMMdd");
  const prefix = "R" + day + "-";
  const last = bs.getLastRow();
  let n = 0;
  if (last > 1) {
    bs.getRange(2, 2, last - 1, 1).getValues().forEach(r => {
      const v = String(r[0]);
      if (v.indexOf(prefix) === 0) n = Math.max(n, Number(v.slice(prefix.length)) || 0);
    });
  }
  return prefix + (n + 1);
}

/** 電話番号が同じなら同じお客さま。いなければ新しい顧客番号（C0001〜）をつける */
function upsertCustomer_(cs, d, now, bookingId, total) {
  const phone = normPhone_(d.phone);
  const last = cs.getLastRow();
  const rows = last > 1 ? cs.getRange(2, 1, last - 1, CUSTOMER_HEAD.length).getValues() : [];
  for (let i = 0; i < rows.length; i++) {
    if (normPhone_(rows[i][2]) === phone && phone) {
      const r = rows[i];
      const rowNo = i + 2;
      cs.getRange(rowNo, 2, 1, 8).setValues([[d.name, "'" + d.phone, d.email, d.city, "'" + (d.zip || ""), d.address, d.housing, d.parking]]);
      cs.getRange(rowNo, 11, 1, 4).setValues([[now, (Number(r[11]) || 0) + 1, (Number(r[12]) || 0) + total, bookingId]]);
      return r[0];
    }
  }
  let max = 0;
  rows.forEach(r => { max = Math.max(max, Number(String(r[0]).replace(/\D/g, "")) || 0); });
  const cid = "C" + ("000" + (max + 1)).slice(-4);
  cs.appendRow([cid, d.name, "'" + d.phone, d.email, d.city, "'" + (d.zip || ""), d.address, d.housing, d.parking, now, now, 1, total, bookingId, ""]);
  return cid;
}

function normPhone_(p) {
  return String(p || "").replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/\D/g, "");
}

function summary_(d, id) {
  const yen = n => Number(n || 0).toLocaleString("ja-JP") + "円";
  return [
    "予約番号：" + id,
    "お名前：" + d.name + " 様",
    "電話番号：" + d.phone,
    "ご住所：" + (d.zip ? "〒" + d.zip + " " : "") + d.city + " " + d.address,
    "住居タイプ：" + d.housing + "／駐車場：" + d.parking,
    "",
    "【ご希望日】",
    "第1希望：" + d.date1 + " " + d.time1,
    "第2希望：" + d.date2 + " " + d.time2,
    "第3希望：" + d.date3 + " " + d.time3,
    "",
    "【内容】",
    d.aircon_items ? "エアコン：" + d.aircon_items + "（小計 " + yen(d.aircon_total) + "）" : "",
    d.house_items ? "水回り・おそうじ：" + d.house_items + "（小計 " + yen(d.house_total) + "）" : "",
    "合計（税込）：" + yen(d.total),
    d.model ? "メーカー・型式・製造年：" + d.model : "",
    d.note ? "ご要望・備考：" + d.note : ""
  ].filter(s => s !== "").join("\n");
}

function mailCustomer_(d, id) {
  if (!d.email) return;
  const body = d.name + " 様\n\n" + SHOP.name + "です。ご予約ありがとうございます。\n"
    + "次の内容で受け付けました。作業日は、こちらからご連絡して決めさせていただきます。\n\n"
    + summary_(d, id) + "\n\n"
    + "※金額は目安です。台数・機種・汚れの具合で変わる場合は、作業の前に必ずご説明します。\n"
    + "※このメールに心当たりがない場合は、お手数ですがお知らせください。\n\n"
    + SHOP.name + "\n☎ " + SHOP.tel + "（作業中は出られないことがあります）";
  MailApp.sendEmail({ to: d.email, subject: "【" + SHOP.name + "】ご予約を受け付けました（" + id + "）", body: body, name: SHOP.name });
}

function mailShop_(d, id, customerId, url, photos) {
  const me = Session.getEffectiveUser().getEmail();
  if (!me) return;
  let body = "ホームページから新しい予約が入りました。\n\n顧客番号：" + customerId + "\n" + summary_(d, id)
    + "\nメール：" + d.email + "\n\n顧客台帳：" + url;
  if (photos && (photos.unit || photos.remote)) {
    body += "\n\n【お客さまの写真】"
      + (photos.unit ? "\nエアコン全体：" + photos.unit : "")
      + (photos.remote ? "\nリモコン：" + photos.remote : "");
  }
  MailApp.sendEmail({ to: me, subject: "【新しい予約】" + d.name + " 様（" + id + "）", body: body, name: SHOP.name + " 予約受付" });
}

/** 写真が届いていたら Google ドライブに保存してリンクを返す */
function savePhotos_(d, id) {
  const out = { unit: "", remote: "" };
  try {
    let folder = null;
    [["photo_unit", "全体", "unit"], ["photo_remote", "リモコン", "remote"]].forEach(([key, label, slot]) => {
      if (!d[key]) return;
      if (!folder) folder = photoFolder_();
      const blob = Utilities.newBlob(Utilities.base64Decode(d[key]), "image/jpeg", id + "_" + label + ".jpg");
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      out[slot] = file.getUrl();
    });
  } catch (err) {
    // 写真の保存に失敗しても予約そのものは止めない
  }
  return out;
}

function photoFolder_() {
  const it = DriveApp.getFoldersByName("イチロー予約写真");
  return it.hasNext() ? it.next() : DriveApp.createFolder("イチロー予約写真");
}

function sheet_(ss, name, head) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(head);
    sh.getRange(1, 1, 1, head.length).setFontWeight("bold").setBackground("#123a6b").setFontColor("#ffffff");
    sh.setFrozenRows(1);
  } else {
    // あとから増えた見出しは、既存の表にも足す
    const cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    head.forEach((h, i) => {
      if (!cur[i]) sh.getRange(1, i + 1).setValue(h).setFontWeight("bold").setBackground("#123a6b").setFontColor("#ffffff");
    });
  }
  return sh;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** 最初に1回だけ動かす：シートの準備と、メール・表計算を使う許可 */
function setup() {
  const ss = SpreadsheetApp.openById("1riqCOmaPJYhp4CJzDyqL04iGNQVquX9DVzJdmmnfTxU");
  sheet_(ss, BOOKING_SHEET, BOOKING_HEAD);
  sheet_(ss, CUSTOMER_SHEET, CUSTOMER_HEAD);
  const first = ss.getSheetByName("シート1") || ss.getSheetByName("Sheet1");
  if (first && ss.getSheets().length > 2) ss.deleteSheet(first);
  photoFolder_();
  CalendarApp.getDefaultCalendar();
  MailApp.getRemainingDailyQuota();
  Logger.log("準備できました");
}
