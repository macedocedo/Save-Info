// ════════════════════════════════════════════════════════
//  ⚠️  CONFIGURE AQUI — substitua pelos seus dados do Supabase
//  Acesse: supabase.com → seu projeto → Settings → API
// ════════════════════════════════════════════════════════
const SUPABASE_URL = 'https://gwmccqpxuyichkrzyqyi.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3bWNjcXB4dXlpY2hrcnp5cXlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1Mjc5OTAsImV4cCI6MjA5MTEwMzk5MH0.vORdYx-ilVFzzYJkzPftIukPZMt5nhUhn0ETvGw6zCc';               
// ════════════════════════════════════════════════════════

const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── State ──
let posts      = [];
let categories = [];
let activeTab      = 'none';
let activeCategory = null;
let currentSort    = 'recent';
let editingPostId  = null;
let viewingPostId  = null;
let uploadedImgData = null;

// ── Helpers ──
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora mesmo';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(ts).toLocaleDateString('pt-BR');
}

function catColor(cat) {
  const colors = ['#2d7d46','#1a5ca8','#7d2d2d','#5a2d7d','#7d5a2d','#2d5a7d'];
  if (!cat) return colors[0];
  let h = 0;
  for (let c of cat) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(h) % colors.length];
}

function getEmbedUrl(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') || u.hostname.includes('youtu.be')) {
      const vid = u.searchParams.get('v') || u.pathname.split('/').pop();
      return `https://www.youtube.com/embed/${vid}`;
    }
    if (u.hostname.includes('vimeo.com')) {
      const vid = u.pathname.split('/').pop();
      return `https://player.vimeo.com/video/${vid}`;
    }
  } catch (_) {}
  return url;
}
// ── Auth ──
async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    showApp();
  } else {
    showAuthScreen();
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session) showApp();
    else showAuthScreen();
  });
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('logout-btn').style.display = 'inline-flex';
  loadData();
}

function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('logout-btn').style.display = 'none';
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearAuthError() {
  document.getElementById('auth-error').style.display = 'none';
}

function showLogin() {
  document.getElementById('auth-login-form').style.display = 'block';
  document.getElementById('auth-signup-form').style.display = 'none';
  clearAuthError();
}

function showSignup() {
  document.getElementById('auth-login-form').style.display = 'none';
  document.getElementById('auth-signup-form').style.display = 'block';
  clearAuthError();
}

async function doLogin() {
  clearAuthError();
  const email    = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showAuthError('Preencha email e senha.'); return; }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) showAuthError('Email ou senha incorretos.');
}

async function doSignup() {
  clearAuthError();
  const email    = document.getElementById('auth-signup-email').value.trim();
  const password = document.getElementById('auth-signup-password').value;
  if (!email || !password) { showAuthError('Preencha email e senha.'); return; }
  if (password.length < 6) { showAuthError('A senha deve ter no mínimo 6 caracteres.'); return; }

  const { error } = await db.auth.signUp({ email, password });
  if (error) showAuthError(error.message);
  else showToast('Conta criada! Verifique seu email se necessário.');
}

async function doLogout() {
  await db.auth.signOut();
  posts = [];
  categories = [];
  renderPosts();
  renderCategories();
}

// ── Supabase: Carregar dados ──
async function loadData() {
  try {
    const { data: cats, error: catErr } = await db
      .from('categories')
      .select('name')
      .order('id');

    if (catErr) throw catErr;
    categories = cats.map(c => c.name);

    const { data: ps, error: postErr } = await db
      .from('posts')
      .select('*')
      .order('ts', { ascending: false });

    if (postErr) throw postErr;
    posts = ps.map(p => ({
      id:        p.id,
      title:     p.title,
      body:      p.body,
      author:    p.author,
      category:  p.category,
      pinned:    p.pinned,
      mediaType: p.media_type,
      mediaSrc:  p.media_src,
      ts:        p.ts,
      editedAt:  p.edited_at
    }));

    renderCategories();
    renderPosts();
  } catch (err) {
    console.error('Erro ao carregar dados:', err);
    showToast('Erro ao conectar ao banco de dados');
  }
}

// ── Supabase: Salvar post (criar ou editar) ──
async function savePost(post) {
  const { error } = await db.from('posts').upsert({
    id:         post.id,
    title:      post.title,
    body:       post.body,
    author:     post.author,
    category:   post.category || null,
    pinned:     post.pinned,
    media_type: post.mediaType || null,
    media_src:  post.mediaSrc  || null,
    ts:         post.ts,
    edited_at:  post.editedAt  || null
  });
  if (error) throw error;
}

// ── Supabase: Deletar post ──
async function deletePostDB(id) {
  const { error } = await db.from('posts').delete().eq('id', id);
  if (error) throw error;
}

// ── Supabase: Adicionar categoria ──
async function addCategoryDB(name) {
  const { error } = await db.from('categories').insert({ name });
  if (error) throw error;
}

// ── Supabase: Renomear categoria ──
async function renameCategoryDB(oldName, newName) {
  const { error: catErr } = await db
    .from('categories')
    .update({ name: newName })
    .eq('name', oldName);
  if (catErr) throw catErr;

  const { error: postErr } = await db
    .from('posts')
    .update({ category: newName })
    .eq('category', oldName);
  if (postErr) throw postErr;
}

// ── Supabase: Deletar categoria ──
async function deleteCategoryDB(name) {
  const { error: catErr } = await db
    .from('categories')
    .delete()
    .eq('name', name);
  if (catErr) throw catErr;

  const { error: postErr } = await db
    .from('posts')
    .update({ category: null })
    .eq('category', name);
  if (postErr) throw postErr;
}

// ── Categories: Render ──
function renderCategories() {
  const list = document.getElementById('cat-list');
  let html = `
    <div class="category-item ${activeCategory === null ? 'active' : ''}" onclick="setCategory(null)">
      <span class="category-dot" style="background:#888;"></span>
      <span>Todas</span>
      <span class="category-count">${posts.length}</span>
      <div class="cat-actions"></div>
    </div>`;

  categories.forEach((cat, i) => {
    const count = posts.filter(p => p.category === cat).length;
    const safecat = cat.replace(/'/g, "\\'");
    html += `
      <div class="category-item ${activeCategory === cat ? 'active' : ''}" onclick="setCategory('${safecat}')">
        <span class="category-dot" style="background:${catColor(cat)};"></span>
        <span id="cat-label-${i}">${cat}</span>
        <span class="category-count">${count}</span>
        <div class="cat-actions">
          <button title="Renomear" onclick="event.stopPropagation(); startEditCat(${i})">✏️</button>
          <button class="del" title="Excluir" onclick="event.stopPropagation(); deleteCategory(${i})">🗑</button>
        </div>
      </div>`;
  });

  list.innerHTML = html;

  document.getElementById('info-posts').textContent =
    `${posts.length} publicaç${posts.length !== 1 ? 'ões' : 'ão'}`;
  document.getElementById('info-cats').textContent =
    `${categories.length} categori${categories.length !== 1 ? 'as' : 'a'}`;

  const sel = document.getElementById('f-cat');
  if (sel) {
    sel.innerHTML = `<option value="">Sem categoria</option>` +
      categories.map(c => `<option value="${c}">${c}</option>`).join('');
  }
}

function startEditCat(i) {
  const label = document.getElementById(`cat-label-${i}`);
  if (!label) return;
  const item = label.parentElement;
  const oldName = categories[i];
  label.outerHTML = `<input class="cat-edit-input" id="cat-edit-${i}" value="${oldName}" maxlength="30"
    onfocus="this.select()"
    onkeydown="if(event.key==='Enter') confirmEditCat(${i}); if(event.key==='Escape') renderCategories();" />`;
  const inp = document.getElementById(`cat-edit-${i}`);
  inp.focus();
  const acts = item.querySelector('.cat-actions');
  if (acts) acts.innerHTML = `<button class="cat-edit-confirm" onclick="confirmEditCat(${i})">✓</button>`;
}

async function confirmEditCat(i) {
  const inp = document.getElementById(`cat-edit-${i}`);
  if (!inp) return;
  const newName = inp.value.trim();
  if (!newName) return;
  const oldName = categories[i];
  try {
    await renameCategoryDB(oldName, newName);
    categories[i] = newName;
    posts.forEach(p => { if (p.category === oldName) p.category = newName; });
    if (activeCategory === oldName) activeCategory = newName;
    renderCategories();
    renderPosts();
    showToast('Categoria renomeada');
  } catch (err) {
    console.error(err);
    showToast('Erro ao renomear categoria');
    renderCategories();
  }
}

async function deleteCategory(i) {
  if (!confirm(`Excluir categoria "${categories[i]}"? As publicações ficarão sem categoria.`)) return;
  const old = categories[i];
  try {
    await deleteCategoryDB(old);
    categories.splice(i, 1);
    posts.forEach(p => { if (p.category === old) p.category = ''; });
    if (activeCategory === old) activeCategory = null;
    renderCategories();
    renderPosts();
    showToast('Categoria excluída');
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir categoria');
  }
}

function toggleAddCat() {
  const f = document.getElementById('add-cat-form');
  f.style.display = f.style.display === 'none' ? 'flex' : 'none';
  if (f.style.display === 'flex') document.getElementById('new-cat-input').focus();
}

async function confirmAddCat() {
  const inp  = document.getElementById('new-cat-input');
  const name = inp.value.trim();
  if (!name) return;
  if (categories.includes(name)) { showToast('Categoria já existe'); return; }
  try {
    await addCategoryDB(name);
    categories.push(name);
    inp.value = '';
    document.getElementById('add-cat-form').style.display = 'none';
    renderCategories();
    showToast('Categoria adicionada');
  } catch (err) {
    console.error(err);
    showToast('Erro ao adicionar categoria');
  }
}

document.getElementById('new-cat-input').addEventListener('keydown', e => {
  if (e.key === 'Enter')  confirmAddCat();
  if (e.key === 'Escape') {
    e.target.value = '';
    document.getElementById('add-cat-form').style.display = 'none';
  }
});

function setCategory(cat) {
  activeCategory = cat;
  document.getElementById('page-title').textContent = cat || 'Todas as Publicações';
  const filtered = cat ? posts.filter(p => p.category === cat) : posts;
  document.getElementById('page-subtitle').textContent =
    cat ? `${filtered.length} publicações` : 'Bem-vindo ao fórum';
  renderCategories();
  renderPosts();
}

// ── Sort ──
function setSort(s) {
  currentSort = s;
  document.querySelectorAll('.sort-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.sort === s));
  renderPosts();
}

function getFilteredPosts() {
  let list = activeCategory
    ? posts.filter(p => p.category === activeCategory)
    : [...posts];

  if (currentSort === 'recent')      list.sort((a, b) => b.ts - a.ts);
  else if (currentSort === 'oldest') list.sort((a, b) => a.ts - b.ts);
  else                               list.sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));

  const pinned = list.filter(p => p.pinned);
  const rest   = list.filter(p => !p.pinned);
  return [...pinned, ...rest];
}

// ── Render Posts ──
function renderPosts() {
  const container = document.getElementById('posts-container');
  const list = getFilteredPosts();

  if (!list.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="icon">📭</div>
        <h3>Nenhuma publicação ainda</h3>
        <p>Clique em "Nova Publicação" para começar!</p>
      </div>`;
    return;
  }

  container.innerHTML = list.map(p => {
    let mediaIndicator = '';
    let thumb = '';

    if (p.mediaType === 'img') {
      mediaIndicator = '<span class="media-indicator">🖼️ Imagem</span>';
      if (p.mediaSrc)
        thumb = `<img class="post-img-thumb" src="${p.mediaSrc}" alt="" onerror="this.style.display='none'" />`;
    } else if (p.mediaType === 'video') {
      mediaIndicator = '<span class="media-indicator">🎬 Vídeo</span>';
    } else if (p.mediaType === 'embed') {
      mediaIndicator = '<span class="media-indicator">▶️ Vídeo incorporado</span>';
    }

    const catDot   = p.category ? `<span class="tag tag-colored">${p.category}</span>` : '';
    const pinBadge = p.pinned   ? `<span class="pin-badge">📌 Fixado</span>` : '';

    return `
      <div class="post-card ${p.pinned ? 'pinned' : ''}" onclick="viewPost('${p.id}')">
        <div class="post-card-inner">
          <div class="post-card-body">
            <div class="post-meta">
              <div class="avatar" style="background:${catColor(p.author) + '22'}; color:${catColor(p.author)};">
                ${getInitials(p.author || '?')}
              </div>
              <span class="author">${p.author || 'Anônimo'}</span>
              <span class="post-date">${timeAgo(p.ts)}</span>
              ${catDot}
              ${pinBadge}
            </div>
            <div class="post-title">${p.title}</div>
            <div class="post-excerpt">${p.body || ''}</div>
            ${mediaIndicator}
          </div>
          ${thumb}
        </div>
      </div>`;
  }).join('');
}

// ── View Post ──
function viewPost(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  viewingPostId = id;
  document.getElementById('view-cat-tag').textContent = p.category || 'Sem categoria';

  let mediaHtml = '';
  if (p.mediaType === 'img' && p.mediaSrc) {
    mediaHtml = `<div class="post-view-media"><img src="${p.mediaSrc}" alt="" /></div>`;
  } else if (p.mediaType === 'video' && p.mediaSrc) {
    mediaHtml = `<div class="post-view-media"><video controls src="${p.mediaSrc}"></video></div>`;
  } else if (p.mediaType === 'embed' && p.mediaSrc) {
    const embedUrl = getEmbedUrl(p.mediaSrc);
    mediaHtml = `
      <div class="post-view-media" style="position:relative; padding-bottom:56.25%; height:0; overflow:hidden;">
        <iframe src="${embedUrl}"
          style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;"
          allowfullscreen></iframe>
      </div>`;
  }

  document.getElementById('view-content').innerHTML = `
    <div class="post-view-content">
      <div class="post-view-title">${p.title}</div>
      ${mediaHtml}
      <div class="post-view-body">${p.body || ''}</div>
    </div>`;

  document.getElementById('view-meta').innerHTML = `
    <div class="avatar" style="background:${catColor(p.author) + '22'}; color:${catColor(p.author)};">
      ${getInitials(p.author || '?')}
    </div>
    <span style="font-weight:500; font-size:14px;">${p.author || 'Anônimo'}</span>
    <span style="font-size:13px; color:var(--text3);">${new Date(p.ts).toLocaleString('pt-BR')}</span>
    ${p.pinned ? '<span class="pin-badge">📌 Fixado</span>' : ''}`;

  document.getElementById('view-overlay').classList.add('open');
}

function closeView() {
  document.getElementById('view-overlay').classList.remove('open');
  viewingPostId = null;
}

function editCurrentPost() {
  const p = posts.find(x => x.id === viewingPostId);
  if (!p) return;
  closeView();
  editingPostId = p.id;

  document.getElementById('form-modal-title').textContent = 'Editar Publicação';
  document.getElementById('f-title').value  = p.title;
  document.getElementById('f-body').value   = p.body;
  document.getElementById('f-author').value = p.author;
  document.getElementById('f-pin').checked  = !!p.pinned;

  renderCategories();
  document.getElementById('f-cat').value = p.category || '';

  switchTab('none');
  if (p.mediaType === 'img' && p.mediaSrc) {
    switchTab('img-url');
    document.getElementById('f-img-url').value = p.mediaSrc;
    previewImgUrl();
  } else if (p.mediaType === 'video' && p.mediaSrc) {
    switchTab('video-url');
    document.getElementById('f-video-url').value = p.mediaSrc;
  } else if (p.mediaType === 'embed' && p.mediaSrc) {
    switchTab('video-embed');
    document.getElementById('f-video-embed').value = p.mediaSrc;
  }

  document.getElementById('new-post-overlay').classList.add('open');
}

async function deleteCurrentPost() {
  if (!confirm('Excluir esta publicação?')) return;
  try {
    await deletePostDB(viewingPostId);
    posts = posts.filter(p => p.id !== viewingPostId);
    closeView();
    renderCategories();
    renderPosts();
    showToast('Publicação excluída');
  } catch (err) {
    console.error(err);
    showToast('Erro ao excluir publicação');
  }
}

// ── New Post Modal ──
function openNewPost() {
  editingPostId = null;
  document.getElementById('form-modal-title').textContent = 'Nova Publicação';
  document.getElementById('f-title').value  = '';
  document.getElementById('f-body').value   = '';
  document.getElementById('f-author').value = '';
  document.getElementById('f-pin').checked  = false;
  document.getElementById('f-img-url').value     = '';
  document.getElementById('f-video-url').value   = '';
  document.getElementById('f-video-embed').value = '';
  document.getElementById('img-url-preview').style.display    = 'none';
  document.getElementById('img-upload-preview').style.display = 'none';
  uploadedImgData = null;
  switchTab('none');
  renderCategories();
  document.getElementById('new-post-overlay').classList.add('open');
}

function closeNewPost() {
  document.getElementById('new-post-overlay').classList.remove('open');
}

// ── Media tabs ──
function switchTab(tab) {
  activeTab = tab;
  const tabIds = ['none','img-url','img-upload','video-url','video-embed'];
  document.querySelectorAll('.media-tab').forEach((b, i) =>
    b.classList.toggle('active', tabIds[i] === tab));
  document.querySelectorAll('.media-section').forEach(s =>
    s.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.classList.add('active');
}

function previewImgUrl() {
  const url  = document.getElementById('f-img-url').value.trim();
  const prev = document.getElementById('img-url-preview');
  const thumb = document.getElementById('img-url-thumb');
  if (url) { prev.style.display = 'block'; thumb.src = url; }
  else      { prev.style.display = 'none'; }
}

function handleImgUpload() {
  const file = document.getElementById('f-img-file').files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    uploadedImgData = e.target.result;
    const prev = document.getElementById('img-upload-preview');
    prev.style.display = 'block';
    document.getElementById('img-upload-thumb').src = uploadedImgData;
  };
  reader.readAsDataURL(file);
}

// Drag & drop upload
const uploadArea = document.getElementById('upload-area');
uploadArea.addEventListener('dragover', e => {
  e.preventDefault();
  uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
uploadArea.addEventListener('drop', e => {
  e.preventDefault();
  uploadArea.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) {
    const dt = new DataTransfer();
    dt.items.add(file);
    document.getElementById('f-img-file').files = dt.files;
    handleImgUpload();
  }
});

// ── Submit Post ──
async function submitPost() {
  const title = document.getElementById('f-title').value.trim();
  const body  = document.getElementById('f-body').value.trim();
  if (!title) { showToast('Insira um título'); return; }

  let mediaType = null, mediaSrc = null;

  if (activeTab === 'img-url') {
    const url = document.getElementById('f-img-url').value.trim();
    if (url) { mediaType = 'img'; mediaSrc = url; }
  } else if (activeTab === 'img-upload') {
    if (uploadedImgData) { mediaType = 'img'; mediaSrc = uploadedImgData; }
  } else if (activeTab === 'video-url') {
    const url = document.getElementById('f-video-url').value.trim();
    if (url) { mediaType = 'video'; mediaSrc = url; }
  } else if (activeTab === 'video-embed') {
    const url = document.getElementById('f-video-embed').value.trim();
    if (url) { mediaType = 'embed'; mediaSrc = url; }
  }

  try {
    if (editingPostId) {
      const p = posts.find(x => x.id === editingPostId);
      if (p) {
        p.title     = title;
        p.body      = body;
        p.author    = document.getElementById('f-author').value.trim() || 'Anônimo';
        p.category  = document.getElementById('f-cat').value;
        p.pinned    = document.getElementById('f-pin').checked;
        p.mediaType = mediaType;
        p.mediaSrc  = mediaSrc;
        p.editedAt  = Date.now();
        await savePost(p);
      }
      showToast('Publicação atualizada!');
    } else {
      const post = {
        id:        'p' + Date.now(),
        title,
        body,
        author:    document.getElementById('f-author').value.trim() || 'Anônimo',
        category:  document.getElementById('f-cat').value,
        pinned:    document.getElementById('f-pin').checked,
        mediaType,
        mediaSrc,
        ts:        Date.now()
      };
      await savePost(post);
      posts.unshift(post);
      showToast('Publicação criada!');
    }

    uploadedImgData = null;
    closeNewPost();
    renderCategories();
    renderPosts();
  } catch (err) {
    console.error(err);
    showToast('Erro ao salvar publicação');
  }
}

// ── Search ──
function openSearch() {
  document.getElementById('search-overlay').classList.add('open');
  setTimeout(() => document.getElementById('search-input').focus(), 50);
}

function closeSearch() {
  document.getElementById('search-overlay').classList.remove('open');
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').innerHTML = '';
}

function doSearch() {
  const q   = document.getElementById('search-input').value.toLowerCase().trim();
  const res = document.getElementById('search-results');
  if (!q) { res.innerHTML = ''; return; }

  const found = posts.filter(p =>
    p.title.toLowerCase().includes(q) ||
    (p.body     || '').toLowerCase().includes(q) ||
    (p.author   || '').toLowerCase().includes(q) ||
    (p.category || '').toLowerCase().includes(q)
  );

  if (!found.length) {
    res.innerHTML = '<p style="color:var(--text3);font-size:14px;">Nenhum resultado encontrado.</p>';
    return;
  }

  res.innerHTML = found.map(p => `
    <div class="post-card" style="margin-bottom:10px; cursor:pointer;"
         onclick="closeSearch(); viewPost('${p.id}')">
      <div class="post-meta">
        ${p.category ? `<span class="tag tag-colored">${p.category}</span>` : ''}
        <span class="post-date">${timeAgo(p.ts)}</span>
      </div>
      <div class="post-title" style="font-size:16px;">${p.title}</div>
      <div class="post-excerpt" style="-webkit-line-clamp:1;">${p.body || ''}</div>
    </div>`).join('');
}

// ── Overlay close on background click ──
function closeOnBg(e, id) {
  if (e.target.id === id) {
    if (id === 'view-overlay')          closeView();
    else if (id === 'new-post-overlay') closeNewPost();
    else if (id === 'search-overlay')   closeSearch();
  }
}

// ── Keyboard shortcuts ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeView();
    closeNewPost();
    closeSearch();
  }
});

// ── Init ──
initAuth();
