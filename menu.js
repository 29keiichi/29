// メニューと料金（税込）。ここを書きかえると、両方のページの料金が変わります。
// max:"wall" は「壁掛けエアコンの台数まで」選べるもの
const SHOP = { name: "エアコンクリーニングイチロー", tel: "080-6677-5431" };
const MENU = {
  aircon: { name: "エアコン", groups: [
    { title: "エアコン本体", items: [
      { k: "wall",    name: "壁掛けエアコン",   price: 10000, unit: "台", desc: "通常タイプ。カバー・フィルター・本体内部の高圧洗浄" },
      { k: "auto",    name: "お掃除機能付き",   price: 5000, unit: "台", max: "wall", add: true, desc: "壁掛けとの合計で1台 15,000円になります" }
    ]},
    { title: "壁掛けに追加するもの", items: [
      { k: "outdoor", name: "室外機クリーニング", price: 4000, unit: "台", max: "wall", add: true },
      { k: "deodor",  name: "消臭除菌施工",     price: 3000, unit: "台", max: "wall", add: true },
      { k: "drain",   name: "ドレンホース詰まり除去", price: 2000, unit: "台", max: "wall", add: true }
    ]},
    { title: "お得なセット", items: [
      { k: "matome",  name: "おまとめセット",   price: 5000, unit: "台", max: "wall", add: true, desc: "室外機＋消臭除菌施工（別々だと7,000円）" },
      { k: "set3",    name: "3点セット",       price: 7000, unit: "台", max: "wall", add: true, desc: "室外機＋消臭除菌施工＋ドレンホース詰まり除去（別々だと9,000円）" }
    ]}
  ]},
  house: { name: "その他", groups: [
    { title: "ご相談", items: [
      { k: "other",   name: "その他のクリーニング・ご相談", price: 0, check: true, desc: "料金はご相談のうえお知らせします" }
    ]}
  ]}
};
const yen = n => "¥" + Number(n).toLocaleString("ja-JP");
