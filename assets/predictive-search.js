class PredictiveSearch extends HTMLElement {
  constructor() {
    super();

    this.details = this.closest('[data-header-search]');
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-predictive-search-results]');
    this.abortController = null;
    this.cachedResults = new Map();
    this.searchingLabel = this.dataset.searchingLabel || 'Searching...';
    this.unavailableLabel = this.dataset.unavailableLabel || 'Search is temporarily unavailable.';
    this.onInputChange = this.debounce(this.onInputChange.bind(this), 250);
  }

  connectedCallback() {
    if (!this.input || !this.results) return;

    this.input.addEventListener('input', this.onInputChange);
    this.input.addEventListener('focus', () => {
      if (this.input.value.trim()) {
        this.onInputChange();
      }
    });

    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;

      this.close();
      this.details?.removeAttribute('open');
      this.details?.querySelector('summary')?.focus();
    });
  }

  onInputChange() {
    const searchTerm = this.input.value.trim();

    if (!searchTerm.length) {
      this.close();
      return;
    }

    this.renderStatus(this.searchingLabel);
    this.getSearchResults(searchTerm);
  }

  getSearchResults(searchTerm) {
    const cachedResult = this.cachedResults.get(searchTerm);
    if (cachedResult) {
      this.renderResults(cachedResult, searchTerm);
      return;
    }

    this.abortController?.abort();
    this.abortController = new AbortController();

    const searchUrl = new URL(`${window.Shopify?.routes?.root || '/'}search/suggest`, window.location.origin);
    searchUrl.searchParams.set('q', searchTerm);
    searchUrl.searchParams.set('section_id', 'predictive-search');
    searchUrl.searchParams.set('resources[type]', 'product,collection,page,article');
    searchUrl.searchParams.set('resources[limit]', '6');
    searchUrl.searchParams.set('resources[limit_scope]', 'all');
    searchUrl.searchParams.set('resources[options][unavailable_products]', 'last');

    fetch(searchUrl.toString(), {
      signal: this.abortController.signal
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Predictive search request failed with ${response.status}`);
        }

        return response.text();
      })
      .then((text) => {
        const resultsMarkup = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('#shopify-section-predictive-search')?.innerHTML;

        if (!resultsMarkup) {
          this.close();
          return;
        }

        this.cachedResults.set(searchTerm, resultsMarkup);

        if (this.input.value.trim() !== searchTerm) return;
        this.renderResults(resultsMarkup, searchTerm);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;

        console.error(error);
        this.renderStatus(this.unavailableLabel);
      });
  }

  renderResults(markup, searchTerm) {
    if (this.input.value.trim() !== searchTerm) return;

    this.results.innerHTML = markup;
    this.results.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  renderStatus(message) {
    this.results.hidden = false;
    this.results.innerHTML = `
      <div class="predictive-search-results predictive-search-results--status">
        <p>${this.escapeHtml(message)}</p>
      </div>
    `;
    this.input.setAttribute('aria-expanded', 'true');
  }

  close() {
    this.results.hidden = true;
    this.results.innerHTML = '';
    this.input?.setAttribute('aria-expanded', 'false');
  }

  escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  debounce(fn, wait) {
    let timeoutId;

    return (...args) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }
}

if (!customElements.get('predictive-search')) {
  customElements.define('predictive-search', PredictiveSearch);
}
