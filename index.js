import { displayRange, textFilter, InfiniteScroller, IntegerIterator, title as getTitle } from './src'
import parshiyot from './build/parshiyot.json'
import pageTitles from './build/page-titles.json'

const petuchaClass = (isPetucha) => isPetucha ? 'mod-petucha' : ''

const setumaClass = (column) => column.length > 1 ? 'mod-setuma' : ''

const Line = ({ text, verses, aliyot, isPetucha }, annotated) => `
  <div class="line ${petuchaClass(isPetucha)}">
    ${text.map((column) => (`
      <div class="column">
        ${column.map((fragment) => (`
          <span class="fragment ${setumaClass(column)}">${textFilter({ text: fragment, annotated })}</span>
        `)).join('')}
      </div>
    `)).join('')}
    <span class="location-indicator mod-verses" ${annotated ? '' : 'hidden'}>${displayRange.asVersesRange(verses)}</span>
    <span class="location-indicator mod-aliyot" ${annotated ? '' : 'hidden'}>${displayRange.asAliyotRange(aliyot)}</span>
  </div>
`

const Page = (lines, annotated) => `
  <table>
    ${lines.map((line) => (`
      <tr>
        <td>${Line(line, annotated)}</td>
      </tr>
    `)).join('')}
  </table>
`

const ParshaPicker = () => `
  <div class="parsha-picker">
    <ol class="parsha-list">
      ${parshiyot.map(({ he, page }) => (`<li class="parsha" data-target-id="parsha" data-jump-to-page="${page}">${he}</li>`)).join('')}
    </ol>
  </div>
`

const insertBefore = (parent, child) => {
  parent.insertAdjacentElement('afterbegin', child)
}

const insertAfter = (parent, child) => {
  parent.insertAdjacentElement('beforeend', child)
}

const fetchPage = (n) => {
  if (n <= 0) return Promise.resolve({})

  return window.fetch(`/build/pages/${n}.json`)
    .then((res) => res.json())
    .then((page) => ({ key: n, content: page }))
    .catch((err) => {
      console.error(err)
      return {}
    })
}

const iterator = IntegerIterator.new({ startingAt: 1 })

const cache = {}

const unpackCache = (cache) => Object.keys(cache).map(key => cache[key])

let isShowingParshaPicker = false

const htmlToElement = (html) => {
  const template = document.createElement('template')
  html = html.trim() // Never return a text node of whitespace as the result
  template.innerHTML = html
  return template.content.firstChild
}

const state = {
  iterator
}

const render = ({ cache, showAnnotations, title }) => {
  unpackCache(cache)
    .forEach(({ node, content }) => {
      const el = htmlToElement(Page(content, showAnnotations))

      const firstChild = node.firstChild
      if (firstChild) {
        node.replaceChild(el, firstChild)
      } else {
        node.appendChild(el)
      }
    })

  document.querySelector('[data-target-id="parsha-title"]').innerHTML = title
}

const setState = (updates) => {
  const newState = Object.assign(state, updates)

  render(newState)
}

const emptyObject = (obj) => {
  for (const key in obj) {
    delete obj[key]
  }
}

const emptyNode = (node) => {
  while (node.firstChild) node.removeChild(node.firstChild)
}

const showParshaPicker = () => {
  document.querySelector('#js-app').appendChild(htmlToElement(ParshaPicker()))
  ;[...document.querySelectorAll('[data-target-id="parsha"]')]
    .forEach((parsha) => {
      parsha.addEventListener('click', (e) => {
        const page = Number(e.target.getAttribute('data-jump-to-page'))
        const title = getTitle(pageTitles[page - 1])

        emptyObject(cache)
        state.iterator = IntegerIterator.new({ startingAt: page })

        emptyNode(document.querySelector('[data-target-id="tikkun-book"]'))

        fetchPage(state.iterator.next())
          .then(({ key, content }) => {
            const node = document.createElement('div')
            node.classList.add('tikkun-page')
            node.setAttribute('data-page-number', key)

            cache[key] = { node, content }
            insertAfter(document.querySelector('[data-target-id="tikkun-book"]'), node)

            setState({
              cache,
              showAnnotations: document.querySelector('[data-target-id="annotations-toggle"]').checked,
              title
            })
          })

        toggleParshaPicker()
      })
    })
}

const toggleParshaPicker = () => {
  isShowingParshaPicker = !isShowingParshaPicker

  ;[
    '[data-test-id="annotations-toggle"]',
    '[data-target-id="repo-link"]',
    '[data-target-id="tikkun-book"]'
  ]
    .map(selector => document.querySelector(selector))
    .map(el => el.classList)
    .forEach(classList => {
      classList.toggle('u-hidden')
      classList.toggle('mod-animated')
    })

  if (isShowingParshaPicker) {
    showParshaPicker()
  } else {
    document.querySelector('#js-app').removeChild(document.querySelector('.parsha-picker'))
  }
}

const toggleAnnotations = (e) => {
  if (e.key !== 'Shift') return

  const toggle = document.querySelector('[data-target-id="annotations-toggle"]')

  toggle.checked = !toggle.checked

  setState({ showAnnotations: toggle.checked })
}

const isInView = (view, scrollView) => {
  return (
    view.offsetTop < scrollView.scrollTop + scrollView.clientHeight
  ) && (
    view.offsetTop + view.clientHeight > scrollView.scrollTop
  )
}

const updatePageTitle = (scrollView) => {
  const pages = [...document.querySelectorAll('.tikkun-page')]

  const inViewPages = pages.filter((page) => isInView(page, scrollView))

  const firstPageInView = inViewPages[0]

  const n = Number(firstPageInView.getAttribute('data-page-number'))
  setState({ title: getTitle(pageTitles[n - 1]) })
}

let timeout
const debounce = (f) => {
  clearTimeout(timeout)
  timeout = setTimeout(f, 100)
}

document.addEventListener('DOMContentLoaded', () => {
  InfiniteScroller
    .new({
      container: document.querySelector('[data-target-id="tikkun-book"]'),
      fetchPreviousContent: {
        fetch: () => fetchPage(state.iterator.previous()),
        render: (container, { key, content }) => {
          const node = document.createElement('div')
          node.classList.add('tikkun-page')
          node.setAttribute('data-page-number', key)

          insertBefore(container, node)
          cache[key] = { node, content }

          setState({ cache })
        }
      },
      fetchNextContent: {
        fetch: () => fetchPage(state.iterator.next()),
        render: (container, { key, content }) => {
          const node = document.createElement('div')
          node.classList.add('tikkun-page')
          node.setAttribute('data-page-number', key)

          insertAfter(container, node)
          cache[key] = { node, content }

          setState({ cache })
        }
      }
    })
    .attach()

  document.querySelector('[data-target-id="tikkun-book"]').addEventListener('scroll', (e) => {
    debounce(() => updatePageTitle(e.target))
  })

  document.querySelector('[data-target-id="annotations-toggle"]').addEventListener('change', (e) => {
    const showAnnotations = e.target.checked

    setState({ showAnnotations })
  })

  document.addEventListener('keydown', toggleAnnotations)
  document.addEventListener('keyup', toggleAnnotations)

  document.querySelector('[data-target-id="parsha-title"]').addEventListener('click', toggleParshaPicker)

  fetchPage(state.iterator.next())
    .then(({ key, content }) => {
      const node = document.createElement('div')
      node.classList.add('tikkun-page')
      node.setAttribute('data-page-number', key)

      cache[key] = { node, content }
      insertAfter(document.querySelector('[data-target-id="tikkun-book"]'), node)

      setState({
        cache,
        showAnnotations: document.querySelector('[data-target-id="annotations-toggle"]').checked,
        title: getTitle(pageTitles[key - 1])
      })
    })
})