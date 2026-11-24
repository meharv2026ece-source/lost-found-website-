(function () {
  'use strict';

  var STORAGE_KEY = 'claimcheck.items.v1';
  var CATEGORIES = ['Electronics', 'ID & Cards', 'Books & Notes', 'Bags', 'Keys', 'Clothing', 'Accessories', 'Other'];
  var STOP_WORDS = ['the', 'and', 'with', 'was', 'for', 'has', 'have', 'near', 'left', 'lost', 'found', 'black', 'blue', 'red', 'small', 'big'];

  /* ---------- Helpers ---------- */
  function $(id) { return document.getElementById(id); }

  function isoDate(offsetDays) {
    var d = new Date();
    d.setDate(d.getDate() - (offsetDays || 0));
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function makeId() {
    return 'CC-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function words(text) {
    var found = String(text || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [];
    return found.filter(function (w) { return STOP_WORDS.indexOf(w) === -1; });
  }

  /* ---------- Data ---------- */
  function sampleData() {
    return [
      { id: 'CC-A1F3', type: 'found', status: 'open', title: 'Blue water bottle', category: 'Accessories', location: 'Canteen, near the billing counter', date: isoDate(1), description: 'Steel bottle with a sticker on the side.', owner: 'Priya', contact: 'priya@college.edu' },
      { id: 'CC-B7K2', type: 'lost', status: 'open', title: 'Casio scientific calculator', category: 'Electronics', location: 'Block C, Room 204', date: isoDate(2), description: 'Black Casio fx-991, name written inside the cover.', owner: 'Arun', contact: '98765 43210' },
      { id: 'CC-C9M8', type: 'found', status: 'open', title: 'Casio calculator', category: 'Electronics', location: 'Block C corridor', date: isoDate(2), description: 'Found on a bench outside the labs.', owner: 'Divya', contact: 'divya@college.edu' },
      { id: 'CC-D4P1', type: 'found', status: 'open', title: 'Student ID card', category: 'ID & Cards', location: 'Library entrance', date: isoDate(3), description: 'Card belongs to a second-year student. Name hidden.', owner: 'Library desk', contact: 'library@college.edu' },
      { id: 'CC-E2Q6', type: 'lost', status: 'open', title: 'Bike key with red tag', category: 'Keys', location: 'Parking lot B', date: isoDate(4), description: 'Honda key with a red rubber keychain.', owner: 'Karthik', contact: '90000 11122' },
      { id: 'CC-F8R5', type: 'lost', status: 'resolved', title: 'Grey hoodie', category: 'Clothing', location: 'Auditorium', date: isoDate(8), description: 'Size M, college logo on the chest.', owner: 'Meena', contact: 'meena@college.edu', resolvedBy: 'Meena', resolvedOn: isoDate(6) }
    ];
  }

  function loadItems() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) { /* storage blocked or corrupted: fall back to sample data */ }
    return sampleData();
  }

  function saveItems() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch (e) { /* ignore */ }
  }

  var items = loadItems();
  var filters = { status: 'all', category: 'all', query: '' };
  var claimTargetId = null;

  /* ---------- Matching ---------- */
  function findMatches(item) {
    var base = words(item.title + ' ' + item.description);
    return items
      .filter(function (o) {
        return o.id !== item.id && o.status === 'open' && o.type !== item.type && o.category === item.category;
      })
      .map(function (o) {
        var other = words(o.title + ' ' + o.description);
        var shared = base.filter(function (w) { return other.indexOf(w) !== -1; }).length;
        var sameSpot = words(item.location).some(function (w) { return words(o.location).indexOf(w) !== -1; });
        return { item: o, score: 1 + shared * 2 + (sameSpot ? 1 : 0) };
      })
      .sort(function (a, b) { return b.score - a.score; });
  }

  /* ---------- Rendering ---------- */
  function visibleItems() {
    var q = filters.query.trim().toLowerCase();
    return items.filter(function (it) {
      if (filters.status === 'resolved' && it.status !== 'resolved') return false;
      if ((filters.status === 'lost' || filters.status === 'found') && (it.type !== filters.status || it.status === 'resolved')) return false;
      if (filters.category !== 'all' && it.category !== filters.category) return false;
      if (q) {
        var hay = (it.title + ' ' + it.description + ' ' + it.location + ' ' + it.category).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }

  function ticketHTML(it) {
    var resolved = it.status === 'resolved';
    var cls = resolved ? 'resolved' : it.type;
    var label = resolved ? 'Returned' : (it.type === 'lost' ? 'Lost' : 'Found');
    var verb = it.type === 'lost' ? 'Lost' : 'Found';
    var actions = '';

    if (resolved) {
      actions = '<span class="t-cat">Returned on ' + esc(formatDate(it.resolvedOn || it.date)) + '</span>';
    } else {
      var count = findMatches(it).length;
      actions += '<button class="btn btn-dark btn-small" type="button" data-action="claim" data-id="' + esc(it.id) + '">' +
        (it.type === 'found' ? 'This is mine' : 'I found this') + '</button>';
      if (count > 0) {
        actions += '<button class="match-btn" type="button" data-action="matches" data-id="' + esc(it.id) + '">' +
          count + (count === 1 ? ' possible match' : ' possible matches') + '</button>';
      }
    }
    actions += '<button class="link-btn" type="button" data-action="remove" data-id="' + esc(it.id) + '">Remove</button>';

    return '<article class="ticket ' + cls + '">' +
      '<div class="t-stub"><span class="t-status">' + label + '</span><span class="t-code">' + esc(it.id) + '</span></div>' +
      '<div class="t-perf" aria-hidden="true"></div>' +
      '<div class="t-body">' +
        '<h3>' + esc(it.title) + '</h3>' +
        '<span class="t-cat">' + esc(it.category) + '</span>' +
        (it.description ? '<p class="t-desc">' + esc(it.description) + '</p>' : '') +
        '<ul class="t-meta">' +
          '<li><strong>' + verb + ' at</strong> ' + esc(it.location) + '</li>' +
          '<li><strong>On</strong> ' + esc(formatDate(it.date)) + '</li>' +
          '<li><strong>Posted by</strong> ' + esc(it.owner) + '</li>' +
        '</ul>' +
      '</div>' +
      '<div class="t-foot">' + actions + '</div>' +
    '</article>';
  }

  function render() {
    var list = visibleItems();
    $('grid').innerHTML = list.map(ticketHTML).join('');
    $('empty').hidden = list.length > 0;

    var openLost = 0, openFound = 0, done = 0;
    items.forEach(function (it) {
      if (it.status === 'resolved') done++;
      else if (it.type === 'lost') openLost++;
      else openFound++;
    });
    $('statLost').textContent = openLost;
    $('statFound').textContent = openFound;
    $('statDone').textContent = done;
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(message) {
    var el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 3200);
  }

  /* ---------- Dialog helpers ---------- */
  function openDialog(dlg) {
    if (typeof dlg.showModal === 'function') dlg.showModal();
    else dlg.setAttribute('open', '');
  }
  function closeDialog(dlg) {
    if (typeof dlg.close === 'function') dlg.close();
    else dlg.removeAttribute('open');
  }

  document.querySelectorAll('[data-close]').forEach(function (btn) {
    btn.addEventListener('click', function () { closeDialog(btn.closest('dialog')); });
  });
  document.querySelectorAll('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(dlg); });
  });

  /* ---------- Post flow ---------- */
  var postForm = $('postForm');

  function fillCategories() {
    var opts = CATEGORIES.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
    $('fCategory').innerHTML = opts;
    $('catFilter').innerHTML = '<option value="all">All categories</option>' + opts;
  }

  function updateHint() {
    var isFound = $('typeFound').checked;
    $('descHint').textContent = isFound
      ? 'Leave out one detail that only the owner would know, so you can verify claims.'
      : 'Add colour, brand, marks and anything that was inside.';
  }

  function openPost(type) {
    postForm.reset();
    $('typeLost').checked = type !== 'found';
    $('typeFound').checked = type === 'found';
    $('fDate').value = isoDate(0);
    $('fDate').max = isoDate(0);
    $('postError').hidden = true;
    updateHint();
    openDialog($('postDialog'));
  }

  $('openPost').addEventListener('click', function () { openPost('lost'); });
  document.querySelectorAll('[data-start]').forEach(function (btn) {
    btn.addEventListener('click', function () { openPost(btn.getAttribute('data-start')); });
  });
  $('typeLost').addEventListener('change', updateHint);
  $('typeFound').addEventListener('change', updateHint);

  postForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = postForm.elements;
    var data = {
      title: f.title.value.trim(),
      location: f.location.value.trim(),
      date: f.date.value,
      owner: f.owner.value.trim(),
      contact: f.contact.value.trim()
    };
    if (!data.title || !data.location || !data.date || !data.owner || !data.contact) {
      $('postError').textContent = 'Fill in the item name, place, date, your name and a way to contact you.';
      $('postError').hidden = false;
      return;
    }
    var item = {
      id: makeId(),
      type: $('typeFound').checked ? 'found' : 'lost',
      status: 'open',
      title: data.title,
      category: f.category.value,
      location: data.location,
      date: data.date,
      description: f.description.value.trim(),
      owner: data.owner,
      contact: data.contact
    };
    items.unshift(item);
    saveItems();
    closeDialog($('postDialog'));
    filters.status = 'all';
    setActiveTab('all');
    render();

    var matches = findMatches(item);
    if (matches.length) {
      showMatches(item);
    } else {
      toast('Posted. We will flag matches as new items arrive.');
    }
  });

  /* ---------- Matches ---------- */
  function showMatches(item) {
    var list = findMatches(item);
    $('matchIntro').textContent = item.title + ' (' + item.category + ')';
    $('matchList').innerHTML = list.length
      ? list.map(function (m) {
          var o = m.item;
          return '<li><h3>' + esc(o.title) + '</h3>' +
            '<p>' + (o.type === 'found' ? 'Found' : 'Lost') + ' at ' + esc(o.location) + ' on ' + esc(formatDate(o.date)) + '</p>' +
            (o.description ? '<p>' + esc(o.description) + '</p>' : '') +
            '<p class="contact">Contact ' + esc(o.owner) + ': ' + esc(o.contact) + '</p></li>';
        }).join('')
      : '<li class="match-none">No matches yet.</li>';
    openDialog($('matchDialog'));
  }

  /* ---------- Claim flow ---------- */
  function openClaim(item) {
    claimTargetId = item.id;
    var isFound = item.type === 'found';
    $('claimForm').reset();
    $('claimError').hidden = true;
    $('claimTitle').textContent = isFound ? 'Claim this item' : 'Report that you found it';
    $('claimItem').textContent = item.title + ' | ' + item.id;
    $('cProofLabel').textContent = isFound
      ? 'Describe one detail only the owner would know'
      : 'Where is the item now?';
    $('claimSubmit').textContent = isFound ? 'Send claim' : 'Send report';
    openDialog($('claimDialog'));
  }

  $('claimForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('cName').value.trim();
    var contact = $('cContact').value.trim();
    var proof = $('cProof').value.trim();
    if (!name || !contact || !proof) {
      $('claimError').textContent = 'Fill in all three fields so the poster can verify you.';
      $('claimError').hidden = false;
      return;
    }
    var target = items.filter(function (it) { return it.id === claimTargetId; })[0];
    if (!target) { closeDialog($('claimDialog')); return; }
    target.status = 'resolved';
    target.resolvedBy = name;
    target.resolvedOn = isoDate(0);
    target.claimContact = contact;
    target.claimProof = proof;
    saveItems();
    closeDialog($('claimDialog'));
    render();
    toast('Done. ' + target.owner + ' can now reach you at ' + contact + '.');
  });

  /* ---------- Grid actions ---------- */
  $('grid').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var item = items.filter(function (it) { return it.id === id; })[0];
    if (!item) return;
    var action = btn.getAttribute('data-action');

    if (action === 'claim') openClaim(item);
    else if (action === 'matches') showMatches(item);
    else if (action === 'remove') {
      if (window.confirm('Remove "' + item.title + '" from the portal?')) {
        items = items.filter(function (it) { return it.id !== id; });
        saveItems();
        render();
        toast('Post removed.');
      }
    }
  });

  /* ---------- Filters ---------- */
  function setActiveTab(status) {
    document.querySelectorAll('.tab').forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-status') === status);
    });
  }

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      filters.status = tab.getAttribute('data-status');
      setActiveTab(filters.status);
      render();
    });
  });
  $('search').addEventListener('input', function (e) { filters.query = e.target.value; render(); });
  $('catFilter').addEventListener('change', function (e) { filters.category = e.target.value; render(); });

  /* ---------- Start ---------- */
  fillCategories();
  render();
})();