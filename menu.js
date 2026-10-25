// メニューと料金（税込）。ここを書きかえると、両方のページの料金が変わります。
// max:"wall" は「壁掛けエアコンの台数まで」選べるもの
const SHOP = { name: "エアコンクリーニングイチロー", tel: "080-6677-5431" };
const MENU = {
  aircon: { name: "エアコン", groups: [
    { title: "エアコン本体", items: [
      { k: "wall",    name: "壁掛けエアコン",   price: 11500, unit: "台", desc: "通常タイプ。カバー・フィルター・本体内部の高圧洗浄" }
    ]},
    { title: "壁掛けに追加するもの", items: [
      { k: "auto",    name: "お掃除機能付き",   price: 5750, unit: "台", max: "wall", add: true, desc: "壁掛けとの合計で1台 17,250円になります" }
    ]}
  ]},
  house: { name: "その他", groups: [
    { title: "ご相談", items: [
      { k: "other",   name: "その他のクリーニング・ご相談", price: 0, check: true, desc: "料金はご相談のうえお知らせします" }
    ]}
  ]}
};
const yen = n => "¥" + Number(n).toLocaleString("ja-JP");
