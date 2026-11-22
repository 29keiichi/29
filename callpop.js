// 電話リンクを押したら、発信の前に案内ポップアップを出す（2026-11-23）
(function () {
  var pop = document.createElement("div");
  pop.className = "callpop";
  pop.innerHTML = '<div class="callpop-card">' +
    '<p class="callpop-num">080-6677-5431</p>' +
    '<p class="callpop-msg">お電話の際は<br>「ホームページを見て電話しました」<br>とお伝えください</p>' +
    '<a class="btn callpop-go" href="tel:08066775431">発信する</a>' +
    '<button type="button" class="btn line callpop-cancel">キャンセル</button>' +
    '</div>';
  document.body.appendChild(pop);
  function show() { pop.classList.add("open"); }
  function hide() { pop.classList.remove("open"); }
  pop.addEventListener("click", function (e) { if (e.target === pop) hide(); });
  pop.querySelector(".callpop-cancel").addEventListener("click", hide);
  pop.querySelector(".callpop-go").addEventListener("click", hide);
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="tel:"]') : null;
    if (!a) return;
    if (a.classList.contains("callpop-go")) return;
    e.preventDefault();
    show();
  });
})();
