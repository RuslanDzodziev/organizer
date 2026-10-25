/* Загрузчик органайзера «Контур Движение».
   Интерфейс и формы живут в Google Apps Script, эта страница их подгружает — без плашки Google.
   Вызовы сервера идут через невидимый «мост» (iframe Apps Script + google.script.run),
   запасной путь — прямой запрос к /exec. */
(function () {
  var EXEC = 'https://script.google.com/macros/s/AKfycbwwGeyWbvxY2gv8Kw0jnOW8fAlNfT1GfO6Rduo54nRc-QWOs1lDHvQxDQdW_y7XelM/exec';
  var HOME = location.origin + location.pathname.replace(/[^\/]*$/, '');

  function shim(EXEC, HOME, injected) {
    window.LG65_HOME = HOME;
    if (!window.LG65_progress) window.LG65_progress = 60;

    /* ---------- запасной путь: fetch к /exec ---------- */
    function viaFetch(fn, args) {
      var ctl = window.AbortController ? new AbortController() : null;
      var tm = ctl ? setTimeout(function () { ctl.abort(); }, 45000) : null;
      return fetch(EXEC + '?api=1', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ fn: fn, args: args }),
        signal: ctl ? ctl.signal : undefined
      }).then(function (r) {
        if (tm) clearTimeout(tm);
        if (!r.ok) throw new Error('Сервер недоступен (' + r.status + ')');
        return r.json();
      }, function (e) {
        if (tm) clearTimeout(tm);
        if (e && e.name === 'AbortError') throw new Error('Сервер долго не отвечает. Попробуйте ещё раз.');
        throw new Error('Нет связи с сервером. Проверьте интернет.');
      }).then(function (j) {
        if (!j || !j.ok) throw new Error((j && j.e) || 'Ошибка сервера');
        return j.r;
      });
    }

    /* ---------- основной путь: мост ---------- */
    var B = { win: null, ready: false, failed: false, seq: 0, wait: {}, queue: [] };
    window.LG65_bridge = B;
    function okOrigin(o) { return o === 'https://script.google.com' || /^https:\/\/[a-z0-9-]+-script\.googleusercontent\.com$/.test(o); }
    window.addEventListener('message', function (e) {
      var d = e.data;
      if (!d || d.lg65 !== 1 || !okOrigin(e.origin)) return;
      if (d.id === 0) {
        if (!B.ready) {
          B.ready = true; B.win = e.source;
          var q = B.queue; B.queue = [];
          q.forEach(function (x) { send(x); });
        }
        return;
      }
      var w = B.wait[d.id]; if (!w) return;
      delete B.wait[d.id]; clearTimeout(w.tm);
      if (d.ok) w.res(d.r); else w.rej(new Error(d.r || 'Ошибка сервера'));
    });
    function send(x) {
      try { B.win.postMessage({ lg65: 2, id: x.id, fn: x.fn, args: x.args }, '*'); }
      catch (err) { delete B.wait[x.id]; clearTimeout(x.tm); viaFetch(x.fn, x.args).then(x.res, x.rej); }
    }
    function makeFrame() {
      var f = document.createElement('iframe');
      f.src = EXEC + '?bridge=1';
      f.title = 'lg65-bridge';
      f.setAttribute('aria-hidden', 'true');
      f.style.cssText = 'position:absolute;width:1px;height:1px;left:-9999px;top:-9999px;border:0;opacity:0;pointer-events:none';
      (document.body || document.documentElement).appendChild(f);
      setTimeout(function () {
        if (B.ready) return;
        B.failed = true;  // мост не поднялся — всё через fetch
        var q = B.queue; B.queue = [];
        q.forEach(function (x) { delete B.wait[x.id]; clearTimeout(x.tm); viaFetch(x.fn, x.args).then(x.res, x.rej); });
      }, 15000);
    }
    makeFrame();
    function api(fn, args) {
      if (B.failed) return viaFetch(fn, args);
      return new Promise(function (res, rej) {
        var id = ++B.seq;
        var x = { id: id, fn: fn, args: args, res: res, rej: rej };
        x.tm = setTimeout(function () { if (B.wait[id]) { delete B.wait[id]; rej(new Error('Сервер долго не отвечает. Попробуйте ещё раз.')); } }, 60000);
        B.wait[id] = x;
        if (B.ready) send(x); else B.queue.push(x);
      });
    }
    window.LG65_api = api;

    /* ---------- замена google.script.* ---------- */
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

    /* свежая версия интерфейса — в фоне, для следующего открытия */
    if (injected && !/form\.html$/.test(location.pathname)) {
      setTimeout(function () {
        api('LG65_ui', []).then(function (t) {
          try { if (t && t.length > 1000 && t !== localStorage.getItem('lg65_ui_cache')) localStorage.setItem('lg65_ui_cache', t); } catch (_) {}
        }).catch(function () {});
      }, 8000);
    }
  }

  /* ---------- экран загрузки ---------- */
  var prog = 0, timer = null, dots = 0;
  function setProg(p) {
    prog = p;
    var f = document.getElementById('lg65Fill'), t = document.getElementById('lg65Pct');
    if (f) f.style.width = p.toFixed(1) + '%';
    if (t) t.textContent = Math.floor(p) + '%';
  }
  function animate(label) {
    timer = setInterval(function () {
      setProg(prog + (55 - prog) * 0.05);
      dots = (dots + 1) % 4;
      var el = document.getElementById('lg65Text');
      if (el) el.textContent = label + '...'.slice(0, dots);
    }, 120);
  }
  function fail(msg) {
    clearInterval(timer);
    var el = document.getElementById('lg65');
    if (!el) return;
    el.innerHTML = '';
    var p = document.createElement('p'); p.textContent = msg;
    var b = document.createElement('button'); b.textContent = 'Повторить'; b.onclick = function () { location.reload(); };
    el.appendChild(p); el.appendChild(b);
  }
  function write(html) {
    clearInterval(timer); setProg(60);
    window.LG65_progress = 60;
    var inj = '<script>(' + shim.toString() + ')(' + JSON.stringify(EXEC) + ',' + JSON.stringify(HOME) + ',true);<\/script>';
    if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, function (m) { return m + inj; });
    else if (/^\s*<!doctype[^>]*>/i.test(html)) html = html.replace(/^\s*<!doctype[^>]*>/i, function (m) { return m + inj; });
    else html = inj + html;
    document.open();
    document.write(html);
    document.close();
  }

  window.LG65_boot = function (kind) {
    if (kind === 'form') {
      shim(EXEC, HOME, false);
      animate('Открываем форму');
      var q = {};
      location.search.slice(1).split('&').forEach(function (p) { var i = p.indexOf('='); if (i > 0) q[decodeURIComponent(p.slice(0, i))] = decodeURIComponent(p.slice(i + 1)); });
      window.LG65_api('LG65_form', [q.page || '', q.t || '', HOME]).then(write).catch(function (e) {
        fail('Не удалось открыть форму: ' + (e && e.message || e));
      });
      return;
    }
    var cached = null;
    try { cached = localStorage.getItem('lg65_ui_cache'); } catch (_) {}
    if (cached && cached.length > 1000) {   // мгновенный старт из сохранённой копии
      // write только после разбора страницы-загрузчика, иначе document.open() не сработает
      var go = function () { setTimeout(function () { write(cached); }, 0); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
      return;
    }
    shim(EXEC, HOME, false);
    animate('Загружаем органайзер');
    window.LG65_api('LG65_ui', []).then(function (t) {
      try { localStorage.setItem('lg65_ui_cache', t); } catch (_) {}
      write(t);
    }).catch(function (e) {
      fail('Не удалось загрузить органайзер: ' + (e && e.message || e));
    });
  };
})();
