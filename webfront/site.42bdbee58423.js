/* MailLama website behaviour. Everything here is progressive: the pages are
   complete without it. It draws the hero scene, runs the small models of the
   app and honours reduced motion. It loads no data and sends nothing. */
(() => {
  'use strict';

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => motion.matches;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const iconHtml = (name, cls = 'icon') => `<span class="${cls}" style="--icon:url(/maillama/assets/icons/${name}.svg)" aria-hidden="true"></span>`;
  const plural = (n, one, other) => (n === 1 ? one : other).replace('{n}', String(n));

  /* ---------- Reveal on scroll ---------- */

  function reveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-in'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((item) => observer.observe(item));
  }

  /* ---------- Hero: mail routes behind the stage ---------- */

  function routes() {
    const canvas = $('[data-routes]');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const paths = Array.from({ length: 7 }, (_, index) => {
      const y = 0.12 + index * 0.13 + random() * 0.05;
      return {
        y,
        loop: random() > 0.55,
        amplitude: 0.05 + random() * 0.08,
        phase: random() * Math.PI * 2,
        speed: 0.012 + random() * 0.018,
        plane: index % 3 === 1,
        offset: random(),
      };
    });
    let width = 0;
    let height = 0;
    let running = false;
    let start = 0;

    function point(path, t) {
      // A wave across the stage with an optional loop, like an air-mail route.
      let x = -0.05 + t * 1.1;
      let y = path.y + Math.sin(t * Math.PI * 2 + path.phase) * path.amplitude;
      if (path.loop) {
        const centre = 0.55;
        const spread = Math.exp(-Math.pow((t - centre) * 9, 2));
        const angle = (t - centre) * 36;
        x += Math.sin(angle) * 0.035 * spread;
        y -= (1 - Math.cos(angle)) * 0.04 * spread;
      }
      return [x * width, y * height];
    }

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      context.lineWidth = 1.2;
      context.lineCap = 'round';
      paths.forEach((path, index) => {
        context.strokeStyle = 'rgba(255, 248, 235, 0.13)';
        context.setLineDash([3, 7]);
        context.lineDashOffset = -time * 0.012 * (index % 2 ? 1 : -1);
        context.beginPath();
        for (let step = 0; step <= 160; step += 1) {
          const [x, y] = point(path, step / 160);
          if (step === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.stroke();
        if (!path.plane) return;
        // A small paper plane travels along every third route.
        const t = (path.offset + time * path.speed * 0.001) % 1;
        const [x, y] = point(path, t);
        const [nx, ny] = point(path, Math.min(t + 0.004, 1));
        const angle = Math.atan2(ny - y, nx - x);
        context.save();
        context.translate(x, y);
        context.rotate(angle);
        context.setLineDash([]);
        context.fillStyle = 'rgba(255, 248, 235, 0.32)';
        context.beginPath();
        context.moveTo(8, 0);
        context.lineTo(-6, -5);
        context.lineTo(-3, 0);
        context.lineTo(-6, 5);
        context.closePath();
        context.fill();
        context.restore();
      });
    }

    function frame(now) {
      if (!running) return;
      draw(now - start);
      window.requestAnimationFrame(frame);
    }

    function setRunning(value) {
      const next = value && !reduced() && !document.hidden;
      if (next === running) return;
      running = next;
      if (running) {
        start = performance.now() - 20000;
        window.requestAnimationFrame(frame);
      } else {
        draw(20000);
      }
    }

    resize();
    draw(20000);
    let visible = true;
    window.addEventListener('resize', () => { resize(); draw(20000); });
    document.addEventListener('visibilitychange', () => setRunning(visible));
    motion.addEventListener?.('change', () => setRunning(visible));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; setRunning(visible); }).observe(canvas);
    } else {
      setRunning(true);
    }
  }

  /* ---------- Hero: the Lama and the letters ---------- */

  function heroScene() {
    const scene = $('[data-hero-scene]');
    if (!scene) return;
    const lama = $('[data-hero-lama]', scene);
    const letter = $('[data-letter]', scene);
    const flight = $('[data-flight]', scene);
    const envelope = $('[data-envelope]', scene);
    const badge = $('[data-badge]', scene);
    const badgeCount = $('[data-badge-count]', scene);
    let count = 0;
    let timer = 0;
    let flying = false;
    let visible = true;

    const restart = (element, cls) => {
      element.classList.remove(cls);
      void element.getBoundingClientRect();
      element.classList.add(cls);
    };

    function deliver(dive) {
      count = Math.min(count + 1, 99);
      badgeCount.textContent = String(count);
      badge.classList.add('is-on');
      restart(badge, 'is-pop');
      restart(envelope, 'is-gulp');
      if (!dive) {
        restart(lama, 'is-hop');
        return;
      }
      // Into the envelope after the letter, and back up with a nod.
      lama.classList.remove('is-up');
      window.setTimeout(() => {
        lama.classList.add('is-up', 'is-hello');
        window.setTimeout(() => lama.classList.remove('is-hello'), 1300);
      }, 700);
    }

    /* Letters arrive in different ways, and the Lama meets each one: it
       watches a letter into the envelope, heads one in from the air, dives
       in after one, turns to follow one that overshoots, and butts a
       tracker back out, uncounted. */
    const NS = 'http://www.w3.org/2000/svg';
    const svg = scene.querySelector('svg');
    const route = (d) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      svg.insertBefore(path, svg.firstChild);
      return path;
    };
    // To the Lama's brow at the top of a jump, and high over its head.
    const toBrow = route('M54 118C78 114 90 82 110 82C128 82 130 104 118 106C104 108 102 86 126 78C146 71 160 54 181 48');
    const overHead = route('M54 118C78 114 90 82 110 82C128 82 130 104 118 106C104 108 102 86 126 78C162 66 200 26 262 30');
    const VARIANTS = ['gulp', 'header', 'catch', 'gulp', 'overshoot', 'header', 'tracker', 'gulp', 'catch'];
    let order = [];
    const nextVariant = () => {
      if (!order.length) order = VARIANTS.slice().sort(() => Math.random() - 0.5);
      return order.shift();
    };
    let antics = null;

    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    const place = (x, y, turn = 0) => letter.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${turn.toFixed(1)})`);
    const frames = (duration, step) => new Promise((resolve) => {
      const begin = performance.now();
      const tick = (now) => {
        const t = Math.min((now - begin) / duration, 1);
        step(t);
        if (t < 1) window.requestAnimationFrame(tick); else resolve();
      };
      window.requestAnimationFrame(tick);
    });
    const along = (path, duration, watch) => {
      const length = path.getTotalLength();
      return frames(duration, (t) => {
        const at = path.getPointAtLength(ease(t) * length);
        place(at.x, at.y);
        if (watch) watch(t);
      });
    };
    // A ballistic hop from a to b over a control point c.
    const arc = (a, c, b, duration, spin = 0) => frames(duration, (t) => {
      const u = 1 - t;
      place(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], spin * t);
    });
    const meet = (antic) => (antics && antics.busy() !== 'tap' ? antics.react(antic, 'letter') : Promise.resolve());

    async function fly(forced) {
      if (flying || reduced() || document.hidden || !visible) return;
      flying = true;
      const variant = forced || (antics ? nextVariant() : 'gulp');
      const FLIGHT = 1900;
      letter.classList.toggle('is-tracker', variant === 'tracker');
      letter.style.opacity = '1';
      let watching = false;
      const watch = (t) => {
        if (watching || t < 0.62) return;
        watching = true;
        if (variant === 'header') {
          // Times its jump to meet the letter at the top.
          meet(async (a) => {
            a.pose('standing');
            await a.jump({ lead: Math.max(0, FLIGHT * (1 - t) - 330), air: 660, height: 0.2, crouch: 160 });
          });
        } else if (variant === 'overshoot') {
          meet(async (a) => {
            a.pose('standing');
            await a.wait(FLIGHT * (1 - t) - 200);
            a.face('right');
            await a.wait(1100);
            a.face(null);
            a.pose('hello');
            await a.wait(1100);
          });
        } else if (variant === 'tracker') {
          meet(async (a) => {
            a.pose('shadesUp');
            await a.wait(FLIGHT * (1 - t) - 260);
            a.pose('standing');
            await a.move('dip', 1.6);
            a.bits('spark', 5, [0.1, 0.6], { angle: Math.PI, spread: 1.1, reach: 34, size: 7, duration: 700 });
            a.pose('hello');
            await a.move('cool');
          });
        } else {
          meet(async (a) => {
            a.pose('hello');
            await a.wait(FLIGHT * (1 - t) + (variant === 'catch' ? 1500 : 300));
          });
        }
      };
      if (variant === 'header') {
        await along(toBrow, FLIGHT, watch);
        // Off the brow, up and over, and into the envelope.
        await arc([181, 48], [168, 4], [198, 92], 760, 260);
      } else if (variant === 'overshoot') {
        await along(overHead, FLIGHT + 300, watch);
        await arc([262, 30], [262, -10], [200, 92], 900, -200);
      } else {
        await along(flight, FLIGHT, watch);
      }
      if (variant === 'tracker') {
        // Butted back out the way it came, spinning, and not counted.
        await arc([188, 90], [150, -6], [60, 40], 900, -540);
        letter.style.opacity = '0';
        letter.classList.remove('is-tracker');
        flying = false;
        return;
      }
      letter.style.opacity = '0';
      flying = false;
      deliver(variant === 'catch');
    }

    function schedule() {
      window.clearInterval(timer);
      if (reduced()) return;
      timer = window.setInterval(fly, 3800);
    }

    if (reduced()) {
      lama.classList.add('is-up');
      count = 3;
      badgeCount.textContent = '3';
      badge.classList.add('is-on');
    } else {
      // Peek out of the envelope with a nod, then settle proud.
      lama.classList.add('is-hello');
      window.setTimeout(() => lama.classList.add('is-up'), 300);
      window.setTimeout(() => lama.classList.remove('is-hello'), 1900);
      window.setTimeout(fly, 2300);
      schedule();
    }

    const stage = scene.closest('.stage');
    let nod = 0;
    stage.addEventListener('pointerenter', () => {
      if (reduced()) return;
      window.clearTimeout(nod);
      lama.classList.add('is-hello');
      nod = window.setTimeout(() => lama.classList.remove('is-hello'), 1200);
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(scene);
    }
    motion.addEventListener?.('change', schedule);

    /* Between letters the Lama gets up to things of its own (lama-antics.js,
       from the brand repository). Tapping it plays a gag; MailLama adds one
       that sends a letter straight away and one that ducks into the
       envelope and pops back out with a nod. */
    if (window.LamaAntics) {
      antics = LamaAntics.attach(lama, {
        base: '/maillama/assets/lama/',
        colors: ['#9B83FF', '#6D4AFF', '#FFF8EB'],
        taps: {
          deliver: async (antic) => {
            // fly() skips while a letter is already on its way.
            fly();
            schedule();
            await antic.move('bigHop');
            antic.bits('spark', 4, antic.HEAD, { reach: 26, size: 7, duration: 700 });
          },
          duck: async (antic) => {
            lama.classList.remove('is-up');
            await antic.wait(700);
            // Always come back up, even when a newer gag took over meanwhile.
            lama.classList.add('is-up');
            antic.pose('hello');
            await antic.wait(1200);
          },
        },
      });
    }
  }

  /* ---------- The window model ---------- */

  function windowModel() {
    const sketch = $('[data-sketch]');
    if (!sketch) return;
    const model = JSON.parse($('[data-mail-model]', sketch).textContent);
    const strings = model.strings;
    const win = $('.window', sketch);
    const list = $('[data-rows]', sketch);
    const empty = $('[data-empty]', sketch);
    const reader = $('[data-reader]', sketch);
    const toast = $('[data-toast]', sketch);
    const mails = model.mail.map((mail) => ({ ...mail }));
    let archived = [];
    let selected = mails[0].id;
    let filter = 'all';
    let toastTimer = 0;
    let lastArchived = null;

    // Theme of the model follows the page until someone picks one.
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const setTheme = (theme) => {
      win.dataset.theme = theme;
      $$('[data-theme-choice]', win).forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.themeChoice === theme)));
    };
    setTheme(dark.matches ? 'dark' : 'light');
    $$('[data-theme-choice]', win).forEach((button) => button.addEventListener('click', () => setTheme(button.dataset.themeChoice)));

    const visibleMails = () => mails.filter((mail) => filter === 'all' || mail.unread || mail.id === selected);

    function rowHtml(mail) {
      const classes = ['row', mail.unread ? 'is-unread' : '', mail.id === selected ? 'is-selected' : ''].filter(Boolean).join(' ');
      const icons = (mail.attach ? iconHtml('paperclip', 'icon mini') : '') + (mail.star ? iconHtml('star', 'icon mini star') : '');
      return `<li><button type="button" class="${classes}" data-mail="${mail.id}" aria-pressed="${mail.id === selected}">`
        + `<span class="avatar" style="--tone:var(--series-${mail.tone})">${escapeHtml(mail.initials)}</span>`
        + `<span class="row-main"><span class="row-top"><span class="sender">${escapeHtml(mail.sender)}</span><span class="time">${escapeHtml(mail.time)}</span></span>`
        + `<span class="subject">${escapeHtml(mail.subject)}</span><span class="snippet">${escapeHtml(mail.snippet)}</span></span>`
        + `<span class="row-icons">${icons}</span></button></li>`;
    }

    function counts() {
      const unread = mails.filter((mail) => mail.unread).length;
      const badge = $('[data-unread-count]', win);
      if (badge) {
        badge.textContent = String(unread);
        badge.hidden = unread === 0;
      }
      $('[data-unread-label]', win).textContent = strings.unread_count.replace('{n}', String(unread));
    }

    function renderList() {
      const shown = visibleMails();
      list.innerHTML = shown.map(rowHtml).join('');
      list.hidden = shown.length === 0;
      empty.hidden = shown.length !== 0;
      if (!shown.length) {
        const inboxEmpty = mails.length === 0;
        $('[data-empty-title]', empty).textContent = inboxEmpty ? strings.empty_title : strings.empty_filter;
        $('[data-empty-body]', empty).textContent = inboxEmpty ? strings.empty_body : '';
        $('[data-restore]', empty).hidden = !inboxEmpty;
      }
      counts();
    }

    function renderReader() {
      const mail = mails.find((item) => item.id === selected);
      reader.hidden = !mail;
      if (!mail) return;
      $('[data-r-subject]', reader).textContent = mail.subject;
      $('[data-r-sender]', reader).textContent = mail.sender;
      $('[data-r-when]', reader).textContent = `${strings.to_me} · ${mail.time}`;
      const avatar = $('[data-r-avatar]', reader);
      avatar.textContent = mail.initials;
      avatar.style.setProperty('--tone', `var(--series-${mail.tone})`);
      $('[data-r-chips]', reader).innerHTML = mail.label
        ? `<span class="label-chip" style="--tone:var(--series-${model.labelTones[mail.label]})">${escapeHtml(model.labels[mail.label])}</span>`
        : '';
      const trackers = $('[data-r-trackers]', reader);
      trackers.hidden = !mail.trackers;
      $('span:last-child', trackers).textContent = plural(mail.trackers, strings.trackers_one, strings.trackers_other);
      $('[data-r-body]', reader).innerHTML = mail.body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join('');
      const attach = $('[data-r-attach]', reader);
      attach.hidden = !mail.file;
      attach.innerHTML = mail.file ? `${iconHtml('paperclip')}<span>${escapeHtml(mail.file)}</span>` : '';
      const star = $('[data-act="star"]', reader);
      star.setAttribute('aria-pressed', String(mail.star));
      star.setAttribute('aria-label', mail.star ? strings.unstar : strings.star);
      star.title = mail.star ? strings.unstar : strings.star;
      if (!reduced()) {
        reader.classList.remove('is-swapping');
        void reader.offsetWidth;
        reader.classList.add('is-swapping');
      }
    }

    function select(id, focus) {
      selected = id;
      const mail = mails.find((item) => item.id === id);
      if (mail) mail.unread = false;
      renderList();
      renderReader();
      if (focus) $(`[data-mail="${id}"]`, list)?.focus();
    }

    function showToast(text) {
      $('[data-toast-text]', toast).textContent = text;
      toast.hidden = false;
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => { toast.hidden = true; }, 5000);
    }

    function archive() {
      const index = mails.findIndex((item) => item.id === selected);
      if (index < 0) return;
      const row = $(`[data-mail="${selected}"]`, list);
      const finish = () => {
        const [mail] = mails.splice(index, 1);
        archived.push({ mail, index });
        lastArchived = mail.id;
        const next = mails[Math.min(index, mails.length - 1)];
        selected = next ? next.id : null;
        if (next) next.unread = false;
        renderList();
        renderReader();
        showToast(strings.archived);
      };
      if (row && !reduced()) {
        row.classList.add('is-leaving');
        window.setTimeout(finish, 200);
      } else {
        finish();
      }
    }

    function restore(entries) {
      entries.sort((a, b) => a.index - b.index).forEach(({ mail, index }) => mails.splice(Math.min(index, mails.length), 0, mail));
      selected = entries[entries.length - 1].mail.id;
      renderList();
      renderReader();
    }

    list.addEventListener('click', (event) => {
      const row = event.target.closest('[data-mail]');
      if (row) select(row.dataset.mail, false);
    });
    list.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const shown = visibleMails();
      const index = shown.findIndex((mail) => mail.id === selected);
      const next = shown[Math.max(0, Math.min(shown.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))];
      if (next) {
        event.preventDefault();
        select(next.id, true);
      }
    });
    $$('[data-filter]', win).forEach((button) => button.addEventListener('click', () => {
      filter = button.dataset.filter;
      $$('[data-filter]', win).forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      renderList();
    }));
    reader.addEventListener('click', (event) => {
      const action = event.target.closest('[data-act]')?.dataset.act;
      const mail = mails.find((item) => item.id === selected);
      if (!action || !mail) return;
      if (action === 'star') {
        mail.star = !mail.star;
        renderList();
        renderReader();
      } else if (action === 'archive') {
        archive();
      } else {
        $('[data-composer]')?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      }
    });
    $('[data-undo]', toast).addEventListener('click', () => {
      const entry = archived.find((item) => item.mail.id === lastArchived);
      if (entry) {
        archived = archived.filter((item) => item !== entry);
        restore([entry]);
      }
      toast.hidden = true;
    });
    $('[data-restore]', empty).addEventListener('click', () => {
      const entries = archived;
      archived = [];
      if (entries.length) restore(entries);
      toast.hidden = true;
    });
  }

  /* ---------- Privacy model ---------- */

  function privacyModel() {
    $$('[data-privacy]').forEach((demo) => {
      const shield = $('[data-shield]', demo);
      const pop = $('[data-shield-pop]', demo);
      const toggle = (open) => {
        pop.hidden = !open;
        shield.setAttribute('aria-expanded', String(open));
      };
      shield.addEventListener('click', () => toggle(pop.hidden));
      document.addEventListener('click', (event) => {
        if (!pop.hidden && !demo.contains(event.target)) toggle(false);
      });
      demo.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !pop.hidden) {
          toggle(false);
          shield.focus();
        }
      });
      const images = $('[data-images]', demo);
      const picture = $('[data-picture]', demo);
      images.addEventListener('click', () => {
        const shown = !picture.classList.contains('is-shown');
        picture.classList.toggle('is-shown', shown);
        images.setAttribute('aria-pressed', String(shown));
        images.textContent = shown ? images.dataset.hide : images.dataset.show;
      });
    });
  }

  /* ---------- Search model ---------- */

  function searchModel() {
    $$('[data-search]').forEach((demo) => {
      const strings = JSON.parse(demo.dataset.strings);
      const input = $('[data-query]', demo);
      const attachOnly = $('[data-attach-filter]', demo);
      const count = $('[data-count]', demo);
      const emptyState = $('[data-results-empty]', demo);
      const fold = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const items = $$('[data-result]', demo).map((item) => ({
        item,
        attach: item.dataset.attach === '1',
        fields: $$('.sender, .subject, .snippet', item).map((field) => ({ field, text: field.textContent })),
      }));

      function highlight(text, query) {
        if (!query) return escapeHtml(text);
        const folded = fold(text);
        let html = '';
        let from = 0;
        let at = folded.indexOf(query);
        while (at !== -1) {
          html += escapeHtml(text.slice(from, at)) + `<mark>${escapeHtml(text.slice(at, at + query.length))}</mark>`;
          from = at + query.length;
          at = folded.indexOf(query, from);
        }
        return html + escapeHtml(text.slice(from));
      }

      function update() {
        const query = fold(input.value.trim());
        let shown = 0;
        items.forEach(({ item, attach, fields }) => {
          const match = (!attachOnly.checked || attach) && (!query || fields.some(({ text }) => fold(text).includes(query)));
          item.hidden = !match;
          if (match) shown += 1;
          fields.forEach(({ field, text }) => { field.innerHTML = highlight(text, match ? query : ''); });
        });
        count.textContent = plural(shown, strings.results_one, strings.results_other);
        emptyState.hidden = shown !== 0;
      }

      input.addEventListener('input', update);
      attachOnly.addEventListener('change', update);
    });
  }

  /* ---------- Composer model ---------- */

  function composerModel() {
    $$('[data-composer]').forEach((demo) => {
      const strings = JSON.parse(demo.dataset.strings);
      const locale = demo.dataset.locale;
      const sheet = $('[data-sheet]', demo);
      const menu = $('[data-menu]', demo);
      const scheduleButton = $('[data-schedule]', demo);
      const sendButton = $('[data-send]', demo);
      const toast = $('[data-composer-toast]', demo);
      const format = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
      const today = new Date();
      const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      // Next Monday is never tomorrow, so the two choices always differ.
      const toMonday = ((8 - today.getDay()) % 7 || 7) + (today.getDay() === 0 ? 7 : 0);
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + toMonday);
      const dates = { tomorrow: format.format(tomorrow), monday: format.format(monday) };
      $$('[data-date]', demo).forEach((slot) => { slot.textContent = dates[slot.dataset.date]; });
      const options = $$('[role="menuitem"]', menu);

      const openMenu = (open) => {
        menu.hidden = !open;
        scheduleButton.setAttribute('aria-expanded', String(open));
        if (open) options[0].focus();
      };

      function dispatch(text) {
        openMenu(false);
        $('[data-composer-text]', toast).textContent = text;
        toast.hidden = false;
        sendButton.disabled = true;
        scheduleButton.disabled = true;
        if (reduced()) {
          sheet.hidden = true;
        } else {
          sheet.classList.remove('is-back');
          sheet.classList.add('is-flying');
        }
        $('[data-composer-undo]', toast).focus();
      }

      scheduleButton.addEventListener('click', () => openMenu(menu.hidden));
      options.forEach((option) => option.addEventListener('click', () => dispatch(strings.scheduled.replace('{when}', dates[option.dataset.when]))));
      sendButton.addEventListener('click', () => dispatch(strings.sent));
      menu.addEventListener('keydown', (event) => {
        const index = options.indexOf(document.activeElement);
        if (event.key === 'Escape') {
          openMenu(false);
          scheduleButton.focus();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault();
          options[(index + (event.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length].focus();
        }
      });
      document.addEventListener('click', (event) => {
        if (!menu.hidden && !event.target.closest('.cd-actions')) openMenu(false);
      });
      $('[data-composer-undo]', toast).addEventListener('click', () => {
        toast.hidden = true;
        sheet.hidden = false;
        sheet.classList.remove('is-flying');
        if (!reduced()) sheet.classList.add('is-back');
        sendButton.disabled = false;
        scheduleButton.disabled = false;
        sendButton.focus();
      });
    });
  }

  /* ---------- Downloads ---------- */

  function downloads() {
    $$('[data-copy]').forEach((button) => button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
      } catch (error) {
        return;
      }
      const label = button.getAttribute('aria-label');
      button.classList.add('is-copied');
      button.setAttribute('aria-label', button.dataset.copied);
      window.setTimeout(() => {
        button.classList.remove('is-copied');
        button.setAttribute('aria-label', label);
      }, 1600);
    }));
    const hero = $('[data-platform-download]');
    if (hero && /Linux/.test(navigator.userAgent) && !/Android/.test(navigator.userAgent)) {
      $('span:last-child', hero).textContent = hero.dataset.linuxLabel;
    }
  }

  function start() {
    reveal();
    routes();
    heroScene();
    windowModel();
    privacyModel();
    searchModel();
    composerModel();
    downloads();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
