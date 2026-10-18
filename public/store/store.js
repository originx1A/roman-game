/* Tabs, the small-screen menu, and audiobook buys when the server says sales are on. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-store-tab]'))
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-store-panel]'))

  function show(id) {
    tabs.forEach(function (tab) {
      var on = tab.getAttribute('data-store-tab') === id
      tab.setAttribute('aria-selected', on ? 'true' : 'false')
      tab.tabIndex = on ? 0 : -1
    })
    panels.forEach(function (panel) {
      panel.hidden = panel.id !== id
    })
  }

  if (tabs.length && panels.length) {
    var fromHash = (location.hash || '').replace(/^#/, '')
    var ids = tabs.map(function (tab) { return tab.getAttribute('data-store-tab') })
    show(ids.indexOf(fromHash) === -1 ? ids[0] : fromHash)

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-store-tab')
        show(id)
        if (history.replaceState) history.replaceState(null, '', '#' + id)
      })
      tab.addEventListener('keydown', function (event) {
        var next = -1
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length
        else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + tabs.length) % tabs.length
        else if (event.key === 'Home') next = 0
        else if (event.key === 'End') next = tabs.length - 1
        if (next === -1) return
        event.preventDefault()
        tabs[next].focus()
        tabs[next].click()
      })
    })
  }

  var toggle = document.querySelector('.nav-toggle')
  var links = document.querySelector('.nav-links')
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  }

  function fileUrl(base, key) {
    return String(base).replace(/\/$/, '') + '/' + String(key).split('/').map(function (part) {
      return encodeURIComponent(part)
    }).join('/')
  }

  fetch('/api/store-sales', { headers: { accept: 'application/json' } })
    .then(function (res) { return res.ok ? res.json() : null })
    .then(function (data) {
      if (!data) return
      var base = typeof data.publicBase === 'string' && data.publicBase.indexOf('https://') === 0 ? data.publicBase : ''
      if (base) {
        document.querySelectorAll('[data-cover]').forEach(function (img) {
          var key = img.getAttribute('data-cover')
          if (!key) return
          img.addEventListener('error', function () { img.hidden = true })
          img.src = fileUrl(base, key)
          img.hidden = false
        })
        document.querySelectorAll('[data-sample]').forEach(function (audio) {
          var key = audio.getAttribute('data-sample')
          if (!key) return
          audio.src = fileUrl(base, key)
          audio.hidden = false
        })
        document.querySelectorAll('[data-free]').forEach(function (link) {
          var key = link.getAttribute('data-free')
          if (!key) return
          link.href = fileUrl(base, key)
          link.hidden = false
          var card = link.closest('article')
          var wait = card && card.querySelector('[data-free-wait]')
          if (wait) wait.hidden = true
        })
      }
      if (data.enabled === true) {
        document.querySelectorAll('[data-buy]').forEach(function (btn) { btn.hidden = false })
        document.querySelectorAll('[data-soon]').forEach(function (note) { note.hidden = true })
      }
    })
    .catch(function () {})

  document.addEventListener('click', function (event) {
    var btn = event.target && event.target.closest ? event.target.closest('[data-buy]') : null
    if (!btn || btn.hidden) return
    var slug = btn.getAttribute('data-buy')
    if (!slug) return
    btn.disabled = true
    var note = btn.parentNode && btn.parentNode.parentNode ? btn.parentNode.parentNode.querySelector('[data-buy-error]') : null
    if (note) note.textContent = ''
    fetch('/api/store-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ slug: slug }),
    })
      .then(function (res) {
        return res.json().then(function (body) { return { ok: res.ok, body: body } })
      })
      .then(function (result) {
        var url = result.ok && result.body ? result.body.url : ''
        if (typeof url === 'string' && url.indexOf('https://checkout.stripe.com/') === 0) {
          location.href = url
          return
        }
        btn.disabled = false
        if (note) note.textContent = 'The buy button is unavailable right now. Please try again in a minute.'
      })
      .catch(function () {
        btn.disabled = false
        if (note) note.textContent = 'The buy button is unavailable right now. Please try again in a minute.'
      })
  })
})()
