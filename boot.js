/* Загрузчик органайзера «Контур Движение».
   Интерфейс и формы живут в Google Apps Script, а эта страница их подгружает —
   поэтому нет плашки «Это приложение создано пользователем Google Apps Script». */
(function () {
  var EXEC = 'https://script.google.com/macros/s/AKfycbwwGeyWbvxY2gv8Kw0jnOW8fAlNfT1GfO6Rduo54nRc-QWOs1lDHvQxDQdW_y7XelM/exec';
  var HOME = location.origin + location.pathname.replace(/[^\/]*$/, '');

  /* Замена google.script.run и google.script.url: вызовы идут на сервер через fetch. */
  function shim(EXEC, HOME) {
    window.LG65_HOME = HOME;
    function api(fn, args) {
      return fetch(EXEC + '?api=1', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fn, args: args })
      }).then(function (r) {
        if (!r.ok) throw new Error('Сервер недоступен (' + r.status + ')');
        return r.json();
      }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.e) || 'Ошибка сервера');
        return j.r;
      }, function (e) {
        throw e instanceof Error && /Сервер|Ошибка/.test(e.message) ? e : new Error('Нет связи с сервером. Проверьте интернет.');
      });
    }
    function runner(s, f, u) {
      return new Proxy({}, {
        get: function (_, n) {
          if (n === 'withSuccessHandler') return function (h) { return runner(h, f, u); };
          if (n === 'withFailureHandler') return function (h) { return runner(s, h, u); };
          if (n === 'withUserObject') return function (o) { return runner(s, f, o); };
          if (typeof n !== 'string' || n === 'then') return undefined;
          return function () {
            var a = [].slice.call(arguments);
            api(n, a).then(function (r) { if (s) s(r, u); }, function (e) { if (f) f(e, u); else console.error(e); });
          };
        }
      });
    }
    function params() {
      var q = {}, qs = {};
      location.search.slice(1).split('&').forEach(function (p) {
        if (!p) return;
        var i = p.indexOf('='), k = decodeURIComponent(i < 0 ? p : p.slice(0, i)),
            v = i < 0 ? '' : decodeURIComponent(p.slice(i + 1).replace(/\+/g, ' '));
        q[k] = v; (qs[k] = qs[k] || []).push(v);
      });
      return { parameter: q, parameters: qs };
    }
    window.google = window.google || {};
    window.google.script = {
      run: runner(null, null, undefined),
      url: { getLocation: function (cb) { var p = params(); cb({ hash: location.hash.replace(/^#/, ''), parameter: p.parameter, parameters: p.parameters }); } },
      host: { close: function () {}, setHeight: function () {}, setWidth: function () {}, editor: { focus: function () {} } }
    };
  }

  function fail(msg) {
    var el = document.getElementById('lg65');
    if (!el) return;
    el.innerHTML = '';
    var p = document.createElement('p'); p.textContent = msg;
    var b = document.createElement('button'); b.textContent = 'Повторить'; b.onclick = function () { location.reload(); };
    el.appendChild(p); el.appendChild(b);
  }

  window.LG65_boot = function (kind) {
    shim(EXEC, HOME);
    var url;
    if (kind === 'form') {
      var q = {};
      location.search.slice(1).split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) q[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); });
      url = EXEC + '?api=form&page=' + encodeURIComponent(q.page || '') + '&t=' + encodeURIComponent(q.t || '') + '&home=' + encodeURIComponent(HOME);
    } else {
      url = EXEC + '?api=ui';
    }
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Сервер ответил ' + r.status);
      return r.text();
    }).then(function (html) {
      var inj = '<script>(' + shim.toString() + ')(' + JSON.stringify(EXEC) + ',' + JSON.stringify(HOME) + ');<\/script>';
      if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + inj; });
      else if (/^\s*<!doctype[^>]*>/i.test(html)) html = html.replace(/^\s*<!doctype[^>]*>/i, function (m) { return m + inj; });
      else html = inj + html;
      document.open();
      document.write(html);
      document.close();
    }).catch(function (e) {
      fail('Не удалось загрузить органайзер: ' + (e && e.message || e));
    });
  };
})();
