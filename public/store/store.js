/* Tabs and the small-screen menu. No email, no payments. */
(function () {
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-store-tab]'))
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-store-panel]'))
  if (!tabs.length || !panels.length) return

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

  var toggle = document.querySelector('.nav-toggle')
  var links = document.querySelector('.nav-links')
  if (toggle && links) {
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open')
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  }
})()
