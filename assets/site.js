/* ─────────────────────────────────────────────────────────────
   Archie McGrath Portfolio — shared site logic
   Nav, footer, CMS loading, filterable grids and the detail modal.
   Content lives in assets/cms.json.
   ───────────────────────────────────────────────────────────── */

const SITE = {
    pages: [
        { id: 'home', href: 'index.html', label: 'Home' },
        {
            id: 'games', href: 'games.html', label: 'Games', icon: '⚔',
            desc: 'Steam releases, game jams and university projects: gameplay, VFX, UI and game feel.'
        },
        {
            id: 'tech-art', href: 'tech-art.html', label: 'Tech Art & Tools', icon: '⚒',
            desc: 'Procedural DCC tools, character rigging and animation, and real-time environment art.'
        },
        {
            id: 'localisation', href: 'localisation.html', label: 'Localisation', icon: '文',
            desc: 'Japanese, Spanish and English translation, subtitling and game localisation.'
        },
        {
            id: 'press', href: 'press.html', label: 'Press', icon: '📜',
            desc: 'Features and exhibitions: The Guardian, 80.lv and SIGGRAPH Asia.'
        },
        {
            id: 'experience', href: 'experience.html', label: 'Experience', icon: '🛡',
            desc: 'Full work history, education, languages and a downloadable CV.'
        }
    ],
    email: 'archieclarkmcg@gmail.com'
};

// Which page an item belongs to, and its display label
const CATEGORY = {
    game: { page: 'games', label: 'Game' },
    tool: { page: 'tech-art', label: 'Tool' },
    environment_art: { page: 'tech-art', label: 'Environment Art' },
    animation: { page: 'tech-art', label: 'Character Animation' },
    'environment art': { page: 'tech-art', label: 'Environment Art' },
    localisation: { page: 'localisation', label: 'Localisation' },
    article: { page: 'press', label: 'Press' }
};

const pageById = id => SITE.pages.find(p => p.id === id);
const catInfo = item => CATEGORY[item.category] || { page: 'home', label: '' };

// ── Language ─────────────────────────────────────────────────
// English is written directly in the HTML / cms.json. Other languages live in
// assets/i18n/<lang>.js and are looked up by the English text.
const LANG = (() => {
    let l = 'en';
    try {
        const q = new URLSearchParams(location.search).get('lang');
        if (q) localStorage.setItem('lang', q);
        l = q || localStorage.getItem('lang') || 'en';
    } catch (e) { /* storage blocked: stay in English */ }
    return (l === 'ja' && window.I18N && window.I18N.ja) ? 'ja' : 'en';
})();
const DICT = LANG === 'ja' ? window.I18N.ja : null;
const _norm = s => String(s).replace(/\s+/g, ' ').trim();
const _textMap = {};
if (DICT) Object.entries(DICT.text).forEach(([k, v]) => { _textMap[_norm(k)] = v; });

// t('English text', {vars}) → translated text (or the English if not translated)
function t(s, vars) {
    let out = s;
    if (DICT) {
        const hit = _textMap[_norm(s)];
        if (hit !== undefined) out = hit;
    }
    if (vars) out = String(out).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return out;
}

// Swap static English text in the page for its translation
function translateDOM(root = document.body) {
    if (!DICT) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE)$/.test(n.parentElement.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(n => {
        const key = _norm(n.nodeValue);
        if (!key || !(key in _textMap)) return;
        const lead = n.nodeValue.match(/^\s*/)[0], trail = n.nodeValue.match(/\s*$/)[0];
        n.nodeValue = lead + _textMap[key] + trail;
    });
    root.querySelectorAll('[alt],[aria-label],[title]').forEach(el => {
        ['alt', 'aria-label', 'title'].forEach(a => {
            const v = el.getAttribute(a);
            if (v && _norm(v) in _textMap) el.setAttribute(a, _textMap[_norm(v)]);
        });
    });
    if (root === document.body) {
        document.title = t(document.title);
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', t(meta.getAttribute('content')));
    }
}

function setLang(l) {
    try { localStorage.setItem('lang', l); } catch (e) { /* ignore */ }
    const url = new URL(location.href);
    url.searchParams.delete('lang');
    location.href = url.toString();
}

if (LANG === 'ja') {
    document.documentElement.lang = 'ja';
    document.documentElement.classList.add('lang-ja');
    const font = document.createElement('link');
    font.rel = 'stylesheet';
    font.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;600;700&display=swap';
    document.head.appendChild(font);
}

// ── Helpers ──────────────────────────────────────────────────
function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function multiline(s) {
    return esc(s).replace(/\\n/g, '<br>').replace(/\n/g, '<br>');
}
function slugify(s) {
    return String(s).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function mediaSrc(item) {
    return item.image || item.gif || '';
}
// Video player markup: nothing downloads until the viewer presses play
function videoPlayer(item, poster) {
    return `<video class="item-video" controls playsinline preload="none" poster="${esc(poster || mediaSrc(item))}">
        <source src="${esc(item.video)}" type="video/mp4">
        ${t("Your browser can't play this video.")}
    </video>`;
}
// Slideshow for items with a "gallery" list. Entries are either an image path,
// or { src, poster, caption } — any .mp4 src plays as a looping video slide.
function galleryEntries(item) {
    const caps = item.galleryCaptions || [];
    return item.gallery.map((e, i) => {
        const o = typeof e === 'string' ? { src: e } : { ...e };
        o.caption = o.caption || caps[i] || '';
        o.isVideo = /\.mp4$/i.test(o.src);
        o.thumb = o.isVideo ? (o.poster || mediaSrc(item)) : o.src;
        return o;
    });
}
function galleryMarkup(item) {
    const g = galleryEntries(item);
    return `<div class="gallery" data-index="0">
        <div class="gallery-stage">
            ${g.map((e, i) => e.isVideo
                ? `<video class="gallery-slide${i === 0 ? ' active' : ''}" src="${esc(e.src)}" poster="${esc(e.thumb)}" muted loop playsinline controls preload="${i === 0 ? 'auto' : 'none'}"></video>`
                : `<img class="gallery-slide${i === 0 ? ' active' : ''}" src="${esc(e.src)}" alt="${esc(item.title)}: ${esc(e.caption || 'image ' + (i + 1))}" ${i > 1 ? 'loading="lazy"' : ''}>`).join('')}
            <button class="gallery-nav gallery-prev" aria-label="${t('Previous')}">❮</button>
            <button class="gallery-nav gallery-next" aria-label="${t('Next')}">❯</button>
        </div>
        <div class="gallery-bar">
            <span class="gallery-caption"></span>
            <span class="gallery-count"></span>
        </div>
        <div class="gallery-thumbs">
            ${g.map((e, i) => `<button class="gallery-thumb${i === 0 ? ' active' : ''}${e.isVideo ? ' is-video' : ''}" data-i="${i}" aria-label="Show ${esc(e.caption || 'item ' + (i + 1))}"><img src="${esc(e.thumb)}" alt="" loading="lazy"></button>`).join('')}
        </div>
    </div>`;
}
function initGallery(root, item) {
    const el = root.querySelector('.gallery');
    if (!el) return;
    const g = galleryEntries(item);
    const slides = [...el.querySelectorAll('.gallery-slide')];
    const thumbs = [...el.querySelectorAll('.gallery-thumb')];
    const show = i => {
        const n = slides.length;
        i = (i + n) % n;
        el.dataset.index = i;
        slides.forEach((s, k) => {
            s.classList.toggle('active', k === i);
            if (s.tagName === 'VIDEO') {
                if (k === i) { s.preload = 'auto'; s.play().catch(() => {}); }
                else s.pause();
            }
        });
        thumbs.forEach((t, k) => t.classList.toggle('active', k === i));
        thumbs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        el.querySelector('.gallery-caption').textContent = g[i].caption;
        el.querySelector('.gallery-count').textContent = `${i + 1} / ${n}`;
    };
    el.querySelector('.gallery-prev').addEventListener('click', () => show(+el.dataset.index - 1));
    el.querySelector('.gallery-next').addEventListener('click', () => show(+el.dataset.index + 1));
    thumbs.forEach(t => t.addEventListener('click', () => show(+t.dataset.i)));
    el._keys = e => {
        if (e.key === 'ArrowLeft') show(+el.dataset.index - 1);
        if (e.key === 'ArrowRight') show(+el.dataset.index + 1);
    };
    document.addEventListener('keydown', el._keys);
    show(0);
}
function linkLabel(item) {
    const l = item.link || '';
    if (l.includes('steampowered')) return t('View on Steam');
    if (l.includes('youtube') || l.includes('vimeo')) return t('Watch Video');
    if (item.category === 'tool') return t('View Tool');
    if (item.category === 'localisation') return t('View Film');
    if (item.category === 'article') return t('Read Article');
    return t('View Showcase');
}
// Program matching keeps the old "Unreal" / "Unity" loose matching
function hasProgram(item, target) {
    const t = target.toLowerCase();
    return (item.programs || []).some(p => {
        const c = p.toLowerCase();
        return c === t || ((t === 'unreal' || t === 'unity') && c.includes(t));
    });
}

// ── CMS ──────────────────────────────────────────────────────
let _cms = null;
function loadCMS() {
    if (!_cms) {
        _cms = fetch('assets/cms.json?v=' + Date.now())
            .then(r => r.json())
            .then(data => data.map(item => localiseItem({ ...item, slug: slugify(item.title), titleEn: item.title })));
    }
    return _cms;
}

// Apply translated title / role / desc / captions to a cms item.
// Tag values stay English (filters match on them); they're translated for display only.
function localiseItem(item) {
    const tr = DICT && DICT.items && DICT.items[item.title];
    if (!tr) return item;
    ['title', 'role', 'desc'].forEach(k => { if (tr[k]) item[k] = tr[k]; });
    if (tr.captions && item.gallery) {
        if (typeof item.gallery[0] === 'string') item.galleryCaptions = tr.captions;
        else item.gallery = item.gallery.map((g, i) => ({ ...g, caption: tr.captions[i] || g.caption }));
    }
    return item;
}

// ── Nav & footer ─────────────────────────────────────────────
function renderChrome(activeId) {
    const header = document.getElementById('site-nav');
    if (header) {
        header.className = 'site-nav';
        header.innerHTML = `
            <div class="site-nav-inner">
                <a class="site-brand" href="index.html"><span class="brand-diamond">◆</span> Archie McGrath</a>
                <button class="lang-toggle" lang="${LANG === 'ja' ? 'en' : 'ja'}" aria-label="${LANG === 'ja' ? 'Switch to English' : '日本語に切り替え'}">
                    <span class="lang-icon" aria-hidden="true">文A</span> ${LANG === 'ja' ? 'English' : '日本語'}
                </button>
                <button class="nav-toggle" aria-label="${t('Open menu')}" aria-expanded="false">
                    <span></span><span></span><span></span>
                </button>
                <nav class="site-links" aria-label="Main">
                    ${SITE.pages.map(p => `
                        <a href="${p.href}" class="${p.id === activeId ? 'active' : ''}" ${p.id === activeId ? 'aria-current="page"' : ''}>${esc(t(p.label))}</a>
                    `).join('')}
                    <a href="#contact" class="site-link-contact">${t('Contact')}</a>
                </nav>
            </div>`;
        header.querySelector('.lang-toggle').addEventListener('click', () => setLang(LANG === 'ja' ? 'en' : 'ja'));
        const toggle = header.querySelector('.nav-toggle');
        toggle.addEventListener('click', () => {
            const open = header.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open);
        });
        header.querySelectorAll('.site-links a').forEach(a =>
            a.addEventListener('click', () => header.classList.remove('open')));
        const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    const footer = document.getElementById('contact');
    if (footer) {
        footer.innerHTML = `
            <div class="footer-content">
                <div class="contact-info">
                    <h3>${t('Get in touch!')}</h3>
                    <p>${t("I'm always interested in new opportunities")}</p>
                    <p style="margin-top: 1rem;"><a class="footer-email" href="mailto:${SITE.email}">${SITE.email}</a></p>
                </div>
                <nav class="footer-links" aria-label="Footer">
                    ${SITE.pages.map(p => `<a href="${p.href}">${esc(t(p.label))}</a>`).join('<span>◆</span>')}
                </nav>
                <p class="footer-text">© ${new Date().getFullYear()} Archie McGrath</p>
            </div>`;
    }

    // AI-translation notice
    if (DICT && header) {
        let dismissed = false;
        try { dismissed = sessionStorage.getItem('aiNoticeClosed') === '1'; } catch (e) { /* ignore */ }
        if (!dismissed) {
            const bar = document.createElement('div');
            bar.className = 'ai-banner';
            bar.setAttribute('role', 'note');
            bar.innerHTML = `
                <span class="ai-banner-icon" aria-hidden="true">◆</span>
                <p class="ai-banner-text">${esc(DICT.banner)}</p>
                <button class="ai-banner-en" lang="en">English version</button>
                <button class="ai-banner-close" aria-label="${t('Close')}">✕</button>`;
            bar.querySelector('.ai-banner-en').addEventListener('click', () => setLang('en'));
            bar.querySelector('.ai-banner-close').addEventListener('click', () => {
                bar.remove();
                try { sessionStorage.setItem('aiNoticeClosed', '1'); } catch (e) { /* ignore */ }
            });
            header.insertAdjacentElement('afterend', bar);
        }
    }

    translateDOM();
}

// ── Detail modal ─────────────────────────────────────────────
let _modalOnTag = null;
let _lastFocus = null;

function ensureModal() {
    let m = document.getElementById('item-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'item-modal';
    m.className = 'item-modal';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.hidden = true;
    m.innerHTML = `<div class="item-modal-backdrop"></div><div class="item-modal-panel project-card expanded" tabindex="-1"></div>`;
    document.body.appendChild(m);
    m.querySelector('.item-modal-backdrop').addEventListener('click', closeItem);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) closeItem(); });
    return m;
}

function openItem(item, { onTag = null, showPageLink = false } = {}) {
    const m = ensureModal();
    _modalOnTag = onTag;
    _lastFocus = document.activeElement;
    const panel = m.querySelector('.item-modal-panel');
    const d = item.disciplines || [];
    const p = item.programs || [];
    const page = pageById(catInfo(item).page);
    const tag = (tg, type) =>
        `<button class="badge-tag ${type}-badge ${onTag ? 'clickable-tag' : ''}" data-type="${type}" data-value="${esc(tg)}" ${onTag ? '' : 'disabled'}>${esc(t(tg))}</button>`;

    panel.innerHTML = `
        <button class="item-modal-close" aria-label="${t('Close')}">✕</button>
        <div class="gif expanded-gif">
            ${item.gallery ? galleryMarkup(item) : item.video ? videoPlayer(item) : mediaSrc(item) ? `<img src="${esc(mediaSrc(item))}" alt="${esc(item.title)}">` : ''}
        </div>
        <div class="project-content expanded-content">
            <div>
                <p class="item-kicker">${esc(t(catInfo(item).label))}</p>
                <h3 class="project-title" id="item-modal-title">${esc(item.title)}</h3>
                ${item['team-size'] ? `<p class="project-subtitle">${esc(t('Team size: {n}', { n: item['team-size'] }))}</p>` : ''}
                ${item.role ? `<p class="project-role"><strong>${t('My role(s):')}</strong> ${multiline(item.role)}</p>` : ''}
                <p class="project-description">${multiline(item.desc)}</p>
                <div class="expanded-tags-container">
                    ${d.length ? `<div class="expanded-tag-section"><strong>${t('Disciplines:')}</strong><div class="expanded-tag-list">${d.map(x => tag(x, 'discipline')).join('')}</div></div>` : ''}
                    ${p.length ? `<div class="expanded-tag-section"><strong>${t('Programs:')}</strong><div class="expanded-tag-list">${p.map(x => tag(x, 'program')).join('')}</div></div>` : ''}
                </div>
                <div class="item-actions">
                    ${item.link ? `<a href="${esc(item.link)}" target="_blank" rel="noopener" class="cta-button">${linkLabel(item)}</a>` : ''}
                    ${showPageLink && page ? `<a href="${page.href}" class="item-page-link">${esc(t('More in {label} →', { label: t(page.label) }))}</a>` : ''}
                </div>
            </div>
        </div>`;
    m.setAttribute('aria-labelledby', 'item-modal-title');

    panel.querySelector('.item-modal-close').addEventListener('click', closeItem);
    if (item.gallery) {
        panel.querySelector('.expanded-gif').classList.add('has-gallery');
        initGallery(panel, item);
    }
    panel.querySelectorAll('.clickable-tag').forEach(b => b.addEventListener('click', () => {
        const fn = _modalOnTag;
        closeItem();
        if (fn) fn(b.dataset.type, b.dataset.value);
    }));

    m.hidden = false;
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => m.classList.add('visible'));
    panel.querySelector('.item-modal-close').focus();
    history.replaceState(null, '', '#' + item.slug);
}

function closeItem() {
    const m = document.getElementById('item-modal');
    if (!m || m.hidden) return;
    m.querySelectorAll('video').forEach(v => v.pause());
    m.querySelectorAll('.gallery').forEach(g => g._keys && document.removeEventListener('keydown', g._keys));
    m.classList.remove('visible');
    m.hidden = true;
    document.body.classList.remove('modal-open');
    history.replaceState(null, '', location.pathname + location.search);
    if (_lastFocus && _lastFocus.focus) _lastFocus.focus();
}

// Open an item if the URL hash names one (shareable deep links)
function openFromHash(items, opts) {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (!slug || slug === 'contact') return;
    const item = items.find(i => i.slug === slug);
    if (item) openItem(item, opts);
}

// ── Filterable grid ──────────────────────────────────────────
// Builds tag chips from the items themselves, so new tags in cms.json
// appear automatically. One selection per group; click again to clear.
class FilterGrid {
    constructor({ items, grid, filters, count, renderItem, groups = ['discipline', 'program'], categories = null, onOpen }) {
        this.items = items;
        this.grid = grid;
        this.filters = filters;
        this.count = count;
        this.renderItem = renderItem;
        this.groups = groups;
        this.categories = categories; // [{id, label, match(item)}]
        this.onOpen = onOpen;
        this.state = { category: 'All', discipline: 'All', program: 'All' };
        this.buildFilters();
        this.render();
    }

    tagCounts(key) {
        const counts = {};
        this.items.forEach(i => (i[key] || []).forEach(x => { counts[x] = (counts[x] || 0) + 1; }));
        return Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(e => e[0]);
    }

    buildFilters() {
        if (!this.filters) return;
        const rows = [];
        if (this.categories) {
            rows.push(this.row('category', t('Section'), '◆', this.categories.map(c => ({ value: c.id, label: t(c.label) }))));
        }
        if (this.groups.includes('discipline')) {
            const tags = this.tagCounts('disciplines');
            if (tags.length > 1) rows.push(this.row('discipline', t('Skill'), '⚔', tags.map(x => ({ value: x, label: t(x) }))));
        }
        if (this.groups.includes('program')) {
            const tags = this.tagCounts('programs');
            if (tags.length > 1) rows.push(this.row('program', t('Program'), '⚙', tags.map(x => ({ value: x, label: x }))));
        }
        this.filters.innerHTML = rows.join('');
        this.filters.hidden = rows.length === 0;
        this.filters.querySelectorAll('.filter-tag').forEach(btn =>
            btn.addEventListener('click', () => this.set(btn.dataset.type, btn.dataset.value)));
    }

    row(type, label, icon, options) {
        return `
            <div class="filter-group">
                <span class="filter-label"><span class="filter-icon">${icon}</span> ${label}:</span>
                <div class="filter-tags">
                    <button class="filter-tag active" data-type="${type}" data-value="All">${t('All')}</button>
                    ${options.map(o => `<button class="filter-tag" data-type="${type}" data-value="${esc(o.value)}">${esc(o.label)}</button>`).join('')}
                </div>
            </div>`;
    }

    set(type, value) {
        this.state[type] = (this.state[type] === value && value !== 'All') ? 'All' : value;
        if (this.filters) {
            this.filters.querySelectorAll(`.filter-tag[data-type="${type}"]`).forEach(b =>
                b.classList.toggle('active', b.dataset.value === this.state[type]));
        }
        this.render();
    }

    reset() {
        ['category', 'discipline', 'program'].forEach(t => this.set(t, 'All'));
    }

    // Used by tags clicked inside the modal
    applyTag(type, value) {
        this.state[type] = 'All';
        this.set(type, value);
        (this.filters || this.grid).scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    visible() {
        const { category, discipline, program } = this.state;
        const cat = this.categories && this.categories.find(c => c.id === category);
        return this.items.filter(i =>
            (category === 'All' || !cat || cat.match(i)) &&
            (discipline === 'All' || (i.disciplines || []).includes(discipline)) &&
            (program === 'All' || hasProgram(i, program)));
    }

    render() {
        const shown = this.visible();
        const filtered = shown.length !== this.items.length;
        this.grid.innerHTML = '';
        this.grid.classList.toggle('is-filtered', filtered);
        if (this.count) {
            this.count.textContent = filtered
                ? t('Showing {a} of {b}', { a: shown.length, b: this.items.length })
                : t('{n} projects', { n: this.items.length });
        }
        if (!shown.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-filter-state';
            empty.innerHTML = `
                <p class="empty-filter-title">${t('Nothing Found')}</p>
                <p class="empty-filter-desc">${t('No work matches that combination of filters.')}</p>
                <button class="cta-button">${t('Reset Filters')}</button>`;
            empty.querySelector('button').addEventListener('click', () => this.reset());
            this.grid.appendChild(empty);
            return;
        }
        shown.forEach((item, idx) => {
            const el = this.renderItem(item, idx);
            el.addEventListener('click', e => {
                if (e.target.closest('a')) return;
                this.onOpen(item);
            });
            this.grid.appendChild(el);
        });
    }
}

// Standard card (category pages)
function renderCard(item) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'project-card grid-card';
    const tags = [
        ...(item.disciplines || []).map(t => ({ t, c: 'discipline-badge' })),
        ...(item.programs || []).map(t => ({ t, c: 'program-badge' }))
    ];
    const shownTags = tags.length > 3 ? tags.slice(0, 2) : tags;
    card.innerHTML = `
        <div class="gif card-media">
            ${mediaSrc(item) ? `<img src="${esc(mediaSrc(item))}" alt="" loading="lazy">` : ''}
            ${item.video ? '<span class="play-badge" aria-hidden="true">▶</span>' : ''}
            ${item.gallery ? `<span class="play-badge gallery-badge" aria-hidden="true">${item.gallery.length}</span>` : ''}
        </div>
        <div class="project-content">
            <div>
                <h3 class="project-title">${esc(item.title)}</h3>
                <div class="project-tags-preview">
                    ${shownTags.map(x => `<span class="badge-tag ${x.c}">${esc(t(x.t))}</span>`).join('')}
                    ${tags.length > 3 ? `<span class="badge-tag more-badge">${t('+{n} more', { n: tags.length - 2 })}</span>` : ''}
                </div>
            </div>
            <p class="expand-hint">${t('Click to see details')}</p>
        </div>`;
    return card;
}

// Standard category-page setup
async function initCategoryPage({ pageId, filter, gridId = 'pageGrid', filtersId = 'pageFilters', countId = 'pageCount' }) {
    renderChrome(pageId);
    const data = await loadCMS();
    const items = data.filter(filter);
    const fg = new FilterGrid({
        items,
        grid: document.getElementById(gridId),
        filters: document.getElementById(filtersId),
        count: document.getElementById(countId),
        renderItem: renderCard,
        onOpen: item => openItem(item, { onTag: (t, v) => fg.applyTag(t, v) })
    });
    openFromHash(items, { onTag: (t, v) => fg.applyTag(t, v) });
    return { data, items, fg };
}
