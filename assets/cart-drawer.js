class CartDrawerController {
  constructor() {
    this.drawer = document.querySelector('[data-cart-drawer]');
    if (!this.drawer) return;

    this.panel = this.drawer.querySelector('.cart-drawer__panel');
    this.body = this.drawer.querySelector('[data-cart-drawer-body]');
    this.footer = this.drawer.querySelector('[data-cart-drawer-footer]');
    this.liveRegion = this.drawer.querySelector('[data-cart-drawer-live-region]');
    this.countNodes = [...document.querySelectorAll('[data-cart-count]')];
    this.toggleNodes = [...document.querySelectorAll('[data-cart-toggle]')];
    this.drawerCount = this.drawer.querySelector('[data-cart-drawer-count]');
    this.subtotalNode = this.drawer.querySelector('[data-cart-drawer-subtotal]');
    this.compareSubtotalNode = this.drawer.querySelector('[data-cart-drawer-compare-subtotal]');
    this.currency = this.drawer.dataset.cartCurrency || 'USD';
    this.showCompareAt = this.drawer.dataset.cartDrawerShowCompareAt === 'true';
    this.variantCompareAtPrices = this.parseVariantCompareAtPrices();
    this.activeAddButton = null;
    this.activeAddLabel = null;
    this.activeAddLabelText = '';
    this.lastActiveElement = null;
    this.pendingItemKeys = new Set();
    this.isRefreshing = false;
    this.closeLabel = this.drawer.dataset.cartDrawerCloseLabel || '';
    this.emptyTitle = this.drawer.dataset.cartDrawerEmptyTitle || '';
    this.emptyCopy = this.drawer.dataset.cartDrawerEmptyCopy || '';
    this.continueUrl = this.drawer.dataset.cartDrawerContinueUrl || '/collections/all';
    this.continueLabel = this.drawer.dataset.cartDrawerContinueLabel || '';
    this.decreaseQuantityLabel = this.drawer.dataset.cartDrawerDecreaseLabel || '';
    this.increaseQuantityLabel = this.drawer.dataset.cartDrawerIncreaseLabel || '';
    this.quantityLabel = this.drawer.dataset.cartDrawerQuantityLabel || '';
    this.removeLabel = this.drawer.dataset.cartDrawerRemoveLabel || '';
    this.subtotalLabel = this.drawer.dataset.cartDrawerSubtotalLabel || '';
    this.secureCheckoutLabel = this.drawer.dataset.cartDrawerSecureCheckoutLabel || '';
    this.liveRegionTemplate = this.drawer.dataset.cartDrawerLiveTemplate || '';
    this.addingLabel = this.drawer.dataset.cartDrawerAddingLabel || '';
    this.loadingLabel = this.drawer.dataset.cartDrawerLoadingLabel || 'Loading cart';

    this.bindUI();
  }

  bindUI() {
    this.toggleNodes.forEach((trigger) => {
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.addEventListener('click', async (event) => {
        event.preventDefault();
        this.lastActiveElement = trigger;
        await this.refresh();
        this.open();
      });
    });

    this.drawer.querySelectorAll('[data-cart-drawer-close]').forEach((button) => {
      button.addEventListener('click', () => this.close());
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.drawer.classList.contains('is-open')) {
        this.close();
      } else if (event.key === 'Tab' && this.drawer.classList.contains('is-open')) {
        this.trapFocus(event);
      }
    });

    document.addEventListener('submit', (event) => this.handleAddToCart(event));
    this.drawer.addEventListener('click', (event) => this.handleDrawerClick(event));
    this.drawer.addEventListener('change', (event) => this.handleDrawerChange(event));
  }

  async handleAddToCart(event) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!form.matches('[data-product-form]')) return;

    const submitter = event.submitter;
    if (!submitter || submitter.getAttribute('name') !== 'add') return;

    event.preventDefault();

    const formData = new FormData(form);
    this.activeAddButton = submitter;
    this.activeAddLabel = submitter.querySelector('[data-add-to-cart-label]');
    this.activeAddLabelText = this.activeAddLabel?.textContent || '';
    this.cacheFormVariantCompareAt(form);

    try {
      this.setAddButtonState(true);

      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/add.js`, {
        method: 'POST',
        headers: {
          Accept: 'application/json'
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Unable to add item to cart');
      }

      await response.json();
      await this.refresh();
      this.open();
    } catch (error) {
      console.error(error);
      window.location.href = form.action || '/cart';
    } finally {
      this.setAddButtonState(false);
    }
  }

  async handleDrawerClick(event) {
    const quantityTrigger = event.target.closest('[data-cart-quantity-change]');
    if (quantityTrigger) {
      const item = quantityTrigger.closest('[data-cart-item-key]');
      if (!item) return;

      const key = item.dataset.cartItemKey;
      if (!key || this.pendingItemKeys.has(key)) return;

      const delta = Number(quantityTrigger.dataset.cartQuantityDelta || 0);
      const quantityValue = item.querySelector('.cart-drawer__quantity-value');
      const currentQuantity = Number(quantityValue?.value ?? quantityValue?.textContent ?? 0);
      const nextQuantity = Math.max(0, currentQuantity + delta);

      await this.changeItem(key, nextQuantity);
      return;
    }

    const removeTrigger = event.target.closest('[data-cart-remove]');
    if (removeTrigger) {
      const item = removeTrigger.closest('[data-cart-item-key]');
      if (!item) return;

      const key = item.dataset.cartItemKey;
      if (!key || this.pendingItemKeys.has(key)) return;

      await this.changeItem(key, 0);
    }
  }

  async handleDrawerChange(event) {
    const input = event.target.closest('[data-cart-quantity-input]');
    if (!input) return;

    const item = input.closest('[data-cart-item-key]');
    if (!item) return;

    const key = item.dataset.cartItemKey;
    if (!key || this.pendingItemKeys.has(key)) return;

    const quantity = Math.max(0, Number(input.value) || 0);
    await this.changeItem(key, quantity);
  }

  async changeItem(key, quantity) {
    if (!key || this.pendingItemKeys.has(key)) return;

    this.pendingItemKeys.add(key);
    this.setItemPendingState(key, true);

    try {
      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart/change.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          id: key,
          quantity
        })
      });

      if (!response.ok) {
        throw new Error('Unable to update cart item');
      }

      const cart = await response.json();
      this.render(cart);
    } catch (error) {
      console.error(error);
      this.pendingItemKeys.delete(key);
      await this.refresh();
    } finally {
      this.pendingItemKeys.delete(key);
      this.setItemPendingState(key, false);
    }
  }

  showSkeleton(count = 2) {
    if (!this.body) return;

    const items = Array.from({ length: count }, () => `
      <div class="cart-drawer__skeleton-item" aria-hidden="true">
        <div class="cart-drawer__skeleton-media"></div>
        <div class="cart-drawer__skeleton-lines">
          <div class="cart-drawer__skeleton-line"></div>
          <div class="cart-drawer__skeleton-line"></div>
          <div class="cart-drawer__skeleton-line"></div>
        </div>
      </div>
    `).join('');

    this.body.innerHTML = `<div class="cart-drawer__skeleton" aria-busy="true" aria-label="${this.escapeHtml(this.loadingLabel)}">${items}</div>`;
  }

  async refresh() {
    if (this.isRefreshing) return null;

    this.isRefreshing = true;

    const currentCount = Number(this.drawerCount?.textContent || 0);
    if (currentCount > 0) {
      this.showSkeleton(Math.min(currentCount, 3));
    }

    try {
      const response = await fetch(`${window.Shopify?.routes?.root || '/'}cart.js`, {
        headers: {
          Accept: 'application/json'
        }
      });
      const cart = await response.json();
      this.render(cart);
      return cart;
    } finally {
      this.isRefreshing = false;
    }
  }

  render(cart) {
    this.hydrateCompareAtPrices(cart);
    const itemCount = cart.item_count || 0;

    if (this.drawerCount) {
      this.drawerCount.textContent = itemCount;
    }

    this.countNodes.forEach((node) => {
      node.textContent = itemCount;
      node.hidden = itemCount === 0;
    });

    if (this.subtotalNode) {
      this.subtotalNode.textContent = this.formatMoney(cart.total_price || 0);
    }

    if (this.liveRegion) {
      this.liveRegion.textContent = this.liveRegionTemplate
        .replace('[[count]]', String(itemCount))
        .replace('[[subtotal]]', this.formatMoney(cart.total_price || 0));
    }

    const compareTotal = (cart.items || []).reduce(
      (sum, item) => sum + (item.compare_at_line_price || item.final_line_price || 0),
      0
    );
    if (this.compareSubtotalNode) {
      const showCompareSubtotal = this.showCompareAt && compareTotal > (cart.total_price || 0);
      this.compareSubtotalNode.hidden = !showCompareSubtotal;
      this.compareSubtotalNode.textContent = showCompareSubtotal ? this.formatMoney(compareTotal) : '';
    }

    if (this.footer) {
      this.footer.hidden = itemCount === 0;
    }

    if (!itemCount) {
      this.body.innerHTML = `
        <div class="cart-drawer__empty" data-cart-drawer-empty>
          <p class="cart-drawer__empty-title">${this.escapeHtml(this.emptyTitle)}</p>
          <p class="cart-drawer__empty-copy">${this.escapeHtml(this.emptyCopy)}</p>
          <a href="${this.escapeHtml(this.continueUrl)}" class="button button--primary cart-drawer__empty-cta">
            ${this.escapeHtml(this.continueLabel)}
          </a>
        </div>
      `;
      return;
    }

    const itemsMarkup = cart.items
      .map((item) => {
        const imageMarkup = item.image
          ? `<a href="${this.escapeHtml(item.url)}" class="cart-drawer__item-media">
              <img src="${this.escapeHtml(item.image)}" alt="${this.escapeHtml(item.product_title)}" class="cart-drawer__item-image" loading="lazy">
            </a>`
          : `<div class="cart-drawer__item-media"></div>`;

        const variantMarkup =
          item.variant_title && item.variant_title !== 'Default Title'
            ? `<p class="cart-drawer__item-variant">${this.escapeHtml(item.variant_title)}</p>`
            : '';

        const comparePriceMarkup =
          this.showCompareAt && (item.compare_at_line_price || 0) > (item.final_line_price || 0)
            ? `<p class="cart-drawer__item-compare-price">${this.formatMoney(item.compare_at_line_price)}</p>`
            : '';

        const isPending = this.pendingItemKeys.has(item.key);

        return `
          <li class="cart-drawer__item${isPending ? ' is-pending' : ''}" data-cart-item-key="${item.key}" aria-busy="${isPending ? 'true' : 'false'}">
            ${imageMarkup}
            <div class="cart-drawer__item-content">
              <div class="cart-drawer__item-top">
                <div>
                  <a href="${this.escapeHtml(item.url)}" class="cart-drawer__item-title">${this.escapeHtml(item.product_title)}</a>
                  ${variantMarkup}
                </div>
                <div class="cart-drawer__item-prices">
                  <p class="cart-drawer__item-price">${this.formatMoney(item.final_line_price)}</p>
                  ${comparePriceMarkup}
                </div>
              </div>
              <div class="cart-drawer__item-bottom">
                <div class="cart-drawer__quantity">
                  <button type="button" class="cart-drawer__quantity-button" data-cart-quantity-change data-cart-quantity-delta="-1" aria-label="${this.escapeHtml(this.decreaseQuantityLabel)}" ${isPending ? 'disabled' : ''}>-</button>
                  <input type="number" class="cart-drawer__quantity-value" value="${item.quantity}" min="1" aria-label="${this.escapeHtml(this.quantityLabel)}" data-cart-quantity-input ${isPending ? 'disabled' : ''}>
                  <button type="button" class="cart-drawer__quantity-button" data-cart-quantity-change data-cart-quantity-delta="1" aria-label="${this.escapeHtml(this.increaseQuantityLabel)}" ${isPending ? 'disabled' : ''}>+</button>
                </div>
                <button type="button" class="cart-drawer__remove" data-cart-remove ${isPending ? 'disabled' : ''} aria-label="${this.escapeHtml(this.removeLabel)}: ${this.escapeHtml(item.product_title)}">${this.escapeHtml(this.removeLabel)}</button>
              </div>
            </div>
          </li>
        `;
      })
      .join('');

    this.body.innerHTML = `<ul class="cart-drawer__items" data-cart-drawer-items role="list">${itemsMarkup}</ul>`;
  }

  setBackgroundInert(isInert) {
    if (isInert) {
      this.inertedElements = [...document.body.children].filter(
        (el) => el !== this.drawer && el.tagName !== 'SCRIPT' && !el.hasAttribute('inert')
      );
      this.inertedElements.forEach((el) => el.setAttribute('inert', ''));
    } else {
      (this.inertedElements || []).forEach((el) => el.removeAttribute('inert'));
      this.inertedElements = [];
    }
  }

  open() {
    this.drawer.classList.add('is-open');
    this.drawer.setAttribute('aria-hidden', 'false');
    document.body.classList.add('cart-drawer-open');
    this.toggleNodes.forEach((node) => node.setAttribute('aria-expanded', 'true'));
    this.setBackgroundInert(true);

    const focusTarget =
      this.panel.querySelector('#CartDrawerTitle') ||
      this.panel.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    focusTarget?.focus();
  }

  close() {
    this.drawer.classList.remove('is-open');
    this.drawer.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('cart-drawer-open');
    this.toggleNodes.forEach((node) => node.setAttribute('aria-expanded', 'false'));
    this.setBackgroundInert(false);
    this.lastActiveElement?.focus();
  }

  setAddButtonState(isLoading) {
    if (!this.activeAddButton) return;

    this.activeAddButton.disabled = isLoading;
    if (this.activeAddLabel) {
      this.activeAddLabel.textContent = isLoading ? this.addingLabel : this.activeAddLabelText;
    }
  }

  setItemPendingState(key, isPending) {
    const item = this.body?.querySelector(`[data-cart-item-key="${CSS.escape(key)}"]`);
    if (!item) return;

    item.classList.toggle('is-pending', isPending);
    item.setAttribute('aria-busy', isPending ? 'true' : 'false');

    item.querySelectorAll('button').forEach((button) => {
      button.disabled = isPending;
    });
  }

  trapFocus(event) {
    const focusableNodes = [...this.panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter((node) => !node.hasAttribute('disabled'));
    if (!focusableNodes.length) return;

    const firstNode = focusableNodes[0];
    const lastNode = focusableNodes[focusableNodes.length - 1];

    if (event.shiftKey && document.activeElement === firstNode) {
      event.preventDefault();
      lastNode.focus();
    } else if (!event.shiftKey && document.activeElement === lastNode) {
      event.preventDefault();
      firstNode.focus();
    }
  }

  formatMoney(cents) {
    return new Intl.NumberFormat(document.documentElement.lang || 'en-US', {
      style: 'currency',
      currency: this.currency
    }).format((cents || 0) / 100);
  }

  escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  parseJsonNode(selector) {
    const node = this.drawer.querySelector(selector);
    if (!node) return null;

    try {
      return JSON.parse(node.textContent || '{}');
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  parseVariantCompareAtPrices() {
    const value = this.parseJsonNode('[data-cart-drawer-compare-at-prices]');
    const prices = new Map();

    Object.entries(value || {}).forEach(([variantId, compareAtPrice]) => {
      const normalizedId = Number(variantId);
      if (!normalizedId) return;

      prices.set(normalizedId, Number(compareAtPrice || 0));
    });

    return prices;
  }

  cacheFormVariantCompareAt(form) {
    if (!this.showCompareAt) return;

    const variantId = Number(form.querySelector('[name="id"]')?.value || 0);
    if (!variantId || this.variantCompareAtPrices.has(variantId)) return;

    const productJsonNode = form.closest('[data-product-section]')?.querySelector('[data-product-json]');
    if (!productJsonNode) return;

    try {
      const product = JSON.parse(productJsonNode.textContent || '{}');
      const variant = (product.variants || []).find((item) => Number(item.id) === variantId);
      if (!variant) return;

      this.variantCompareAtPrices.set(variantId, Number(variant.compare_at_price || 0));
    } catch (error) {
      console.error(error);
    }
  }

  hydrateCompareAtPrices(cart) {
    if (!this.showCompareAt || !cart?.items?.length) return;

    cart.items.forEach((item) => {
      const variantId = Number(item.variant_id || 0);
      const compareAtUnitPrice = Number(this.variantCompareAtPrices.get(variantId) || 0);
      const finalUnitPrice = Number(item.final_price || 0);

      item.compare_at_unit_price = compareAtUnitPrice;
      item.compare_at_line_price =
        compareAtUnitPrice > finalUnitPrice ? compareAtUnitPrice * Number(item.quantity || 0) : 0;
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new CartDrawerController();
});
