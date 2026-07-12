class ProductSectionController {
  constructor(section) {
    this.section = section;
    this.product = this.parseProduct();
    this.form = section.querySelector('[data-product-form]');
    this.gallery = section.querySelector('[data-product-gallery]');
    this.viewport = section.querySelector('[data-gallery-viewport]');
    this.stickyBar = section.querySelector('[data-sticky-bar]');
    this.optionButtons = [...section.querySelectorAll('[data-option-button]')];
    this.optionSelects = [...section.querySelectorAll('[data-option-select]')];
    this.variantIdInputs = [...section.querySelectorAll('[data-variant-id-input]')];
    this.quantityInput = section.querySelector('[data-quantity-input]');
    this.accordionTriggers = [...section.querySelectorAll('[data-accordion-trigger]')];
    this.price = section.querySelector('[data-product-price]');
    this.comparePrice = section.querySelector('[data-product-compare-price]');
    this.savingsBadge = section.querySelector('[data-product-savings-badge]');
    this.priceWrap = section.querySelector('[data-savings-format]');
    this.savingsFormat = this.priceWrap?.dataset.savingsFormat || 'percent';
    this.savingsTemplatePercent = this.priceWrap?.dataset.savingsTemplatePercent || 'Save [[value]] today';
    this.savingsTemplateAmount = this.priceWrap?.dataset.savingsTemplateAmount || 'Save [[value]] today';
    this.inventory = section.querySelector('[data-product-inventory]');
    this.stockCount = section.querySelector('[data-low-stock-count]');
    this.stockCountTemplate = this.stockCount ? this.stockCount.dataset.template || 'Only [[count]] left in stock' : '';
    this.stockCountThreshold = this.stockCount ? parseInt(this.stockCount.dataset.threshold, 10) || 0 : 0;
    this.sku = section.querySelector('[data-product-sku]');
    this.addToCart = section.querySelector('[data-add-to-cart]');
    this.addToCartLabel = section.querySelector('[data-add-to-cart-label]');
    this.stickySubmit = section.querySelector('[data-sticky-submit]');
    this.stickyLabelText = this.stickySubmit ? this.stickySubmit.textContent.trim() : '';
    this.addToCartText = section.dataset.addToCartLabel || 'Add to cart';
    this.soldOutText = section.dataset.soldOutLabel || 'Sold out';
    this.unavailableText = section.dataset.unavailableLabel || 'Unavailable';
    this.availableToOrderText = section.dataset.availableToOrderLabel || 'Available to order';
    this.inStockTemplate = section.dataset.inStockTemplate || '[[count]] in stock';
    this.skuTemplate = section.dataset.skuTemplate || 'SKU: [[value]]';
    this.currentVariant = this.findInitialVariant();

    if (!this.product || !this.form) return;

    this.bindOptionInputs();
    this.bindQuantityControls();
    this.bindGallery();
    this.setupPeekLoop();
    this.bindStickyBar();
    this.bindAccordions();
    this.applySelections(this.currentVariant?.options || this.getSelectedOptions());
    this.updateVariantUI(this.currentVariant, true);
  }

  parseProduct() {
    const node = this.section.querySelector('[data-product-json]');
    if (!node) return null;

    try {
      return JSON.parse(node.textContent);
    } catch (error) {
      console.error('Unable to parse product JSON', error);
      return null;
    }
  }

  findInitialVariant() {
    const currentId = Number(this.form.querySelector('[name="id"]')?.value);
    return (
      this.product.variants.find((variant) => variant.id === currentId) ||
      this.product.selected_or_first_available_variant ||
      this.product.variants[0]
    );
  }

  bindOptionInputs() {
    this.optionButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const optionName = button.dataset.optionName;
        const optionValue = button.dataset.optionValue;
        this.handleVariantChange(optionName, optionValue);
      });
    });

    this.optionSelects.forEach((select) => {
      select.addEventListener('change', () => {
        this.handleVariantChange(select.dataset.optionName, select.value);
      });
    });
  }

  updateSelectedValue(optionName, optionValue) {
    const option = this.product.options.findIndex((name) => name === optionName);
    const label = this.section.querySelector(`[data-selected-option="${option + 1}"]`);
    if (label) label.textContent = optionValue;
  }

  getSelectedOptions() {
    return this.product.options.map((optionName) => {
      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (select) return select.value;

      const button = this.optionButtons.find(
        (item) => item.dataset.optionName === optionName && item.classList.contains('is-active')
      );
      return button?.dataset.optionValue;
    });
  }

  handleVariantChange(optionName, optionValue) {
    const optionIndex = this.product.options.findIndex((name) => name === optionName);
    const selectedOptions = this.getSelectedOptions();

    if (optionIndex >= 0) {
      selectedOptions[optionIndex] = optionValue;
    }

    const nextVariant = this.resolveVariantFromSelection(selectedOptions, optionIndex);
    if (!nextVariant) return;

    const normalizedSelections = [...nextVariant.options];
    this.applySelections(normalizedSelections);
    this.currentVariant = nextVariant;
    this.updateVariantUI(nextVariant);
  }

  applySelections(selectedOptions) {
    this.product.options.forEach((optionName, index) => {
      const selectedValue = selectedOptions[index];
      const relatedButtons = this.optionButtons.filter((button) => button.dataset.optionName === optionName);

      relatedButtons.forEach((button) => {
        const isActive = button.dataset.optionValue === selectedValue;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });

      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (select) select.value = selectedValue;

      this.updateSelectedValue(optionName, selectedValue);
    });

    this.updateOptionAvailability(selectedOptions);
  }

  updateOptionAvailability(selectedOptions) {
    this.product.options.forEach((optionName, index) => {
      this.optionButtons
        .filter((button) => button.dataset.optionName === optionName)
        .forEach((button) => {
          const isReachable = this.isOptionValueReachable(index, button.dataset.optionValue, selectedOptions);
          button.disabled = !isReachable;
          button.classList.toggle('is-unavailable', !isReachable);
          button.setAttribute('aria-disabled', isReachable ? 'false' : 'true');
          if (!isReachable) {
            button.title = button.dataset.unavailableLabel || 'Sold out';
          } else {
            button.removeAttribute('title');
          }
        });

      const select = this.optionSelects.find((item) => item.dataset.optionName === optionName);
      if (!select) return;

      [...select.options].forEach((option) => {
        option.disabled = !this.isOptionValueReachable(index, option.value, selectedOptions);
      });
    });
  }

  isOptionValueReachable(index, optionValue, selectedOptions) {
    return this.product.variants.some((variant) =>
      variant.options.every((value, variantIndex) => {
        if (variantIndex === index) return value === optionValue;

        const selectedValue = selectedOptions[variantIndex];
        return !selectedValue || value === selectedValue;
      })
    );
  }

  resolveVariantFromSelection(selectedOptions, changedIndex = 0) {
    const exactVariant = this.findVariantByOptions(selectedOptions);
    if (exactVariant) return exactVariant;

    const rankedVariants = this.product.variants
      .filter((variant) => {
        if (changedIndex < 0) return true;
        return variant.options[changedIndex] === selectedOptions[changedIndex];
      })
      .map((variant) => ({
        variant,
        score: variant.options.reduce((total, value, index) => total + (value === selectedOptions[index] ? 1 : 0), 0)
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (left.variant.available !== right.variant.available) {
          return Number(right.variant.available) - Number(left.variant.available);
        }

        return 0;
      });

    return rankedVariants[0]?.variant || null;
  }

  findVariantByOptions(selectedOptions) {
    return this.product.variants.find((variant) =>
      variant.options.every((option, index) => option === selectedOptions[index])
    );
  }

  updateVariantUI(variant, isInitial) {
    this.variantIdInputs.forEach((input) => {
      input.value = variant.id;
    });

    // On first load, keep the server-rendered price / compare price / savings
    // badge. Liquid already rendered them correctly in the buyer's presentment
    // currency; re-rendering here would use the base-currency values from the
    // product JSON and can wrongly hide the sale on multi-currency stores.
    if (!isInitial) {
      if (this.price) this.price.textContent = this.formatMoney(variant.price);

      if (this.comparePrice) {
        if (variant.compare_at_price > variant.price) {
          this.comparePrice.hidden = false;
          this.comparePrice.textContent = this.formatMoney(variant.compare_at_price);
        } else {
          this.comparePrice.hidden = true;
          this.comparePrice.textContent = '';
        }
      }

      if (this.savingsBadge) {
        if (variant.compare_at_price > variant.price) {
          const savingsAmount = variant.compare_at_price - variant.price;
          const savingsPercent = Math.round((savingsAmount / variant.compare_at_price) * 100);
          this.savingsBadge.hidden = false;
          this.savingsBadge.textContent =
            this.savingsFormat === 'amount'
              ? this.savingsTemplateAmount.replace('[[value]]', this.formatMoney(savingsAmount))
              : this.savingsTemplatePercent.replace('[[value]]', `${savingsPercent}%`);
        } else {
          this.savingsBadge.hidden = true;
          this.savingsBadge.textContent = '';
        }
      }
    }

    if (this.inventory) {
      this.inventory.textContent = variant.available
        ? variant.inventory_quantity > 0
          ? this.inStockTemplate.replace('[[count]]', variant.inventory_quantity)
          : this.availableToOrderText
        : this.unavailableText;
    }

    if (this.sku) {
      this.sku.textContent = variant.sku ? this.skuTemplate.replace('[[value]]', variant.sku) : '';
    }

    // Low-stock count: shows the real per-variant inventory (stable when revisiting a variant).
    if (this.stockCount) {
      const qty = variant.inventory_quantity;
      if (typeof qty === 'number' && qty > 0 && qty <= this.stockCountThreshold) {
        this.stockCount.hidden = false;
        this.stockCount.textContent = this.stockCountTemplate.replace('[[count]]', qty);
      } else {
        this.stockCount.hidden = true;
        this.stockCount.textContent = '';
      }
    }

    if (this.addToCart && this.addToCartLabel) {
      this.addToCart.disabled = !variant.available;
      this.addToCartLabel.textContent = variant.available ? this.addToCartText : this.soldOutText;
    }

    if (this.stickySubmit) {
      this.stickySubmit.disabled = !variant.available;
      this.stickySubmit.textContent = variant.available ? this.stickyLabelText : this.soldOutText;
    }

    if (variant.featured_media?.id) {
      this.showMedia(variant.featured_media.id);
    }

    const nextUrl = `${this.section.dataset.productUrl}?variant=${variant.id}`;
    window.history.replaceState({ variantId: variant.id }, '', nextUrl);
  }

  bindGallery() {
    if (!this.gallery || !this.viewport) return;

    const thumbButtons = [...this.section.querySelectorAll('[data-gallery-thumb]')];
    const items = [...this.section.querySelectorAll('[data-media-id]')];
    const prev = this.section.querySelector('[data-gallery-prev]');
    const next = this.section.querySelector('[data-gallery-next]');
    const zoomButtons = [...this.section.querySelectorAll('[data-gallery-zoom]')];
    const modal = this.section.querySelector('[data-gallery-modal]');
    const modalBody = this.section.querySelector('[data-gallery-modal-body]');
    const modalThumbs = this.section.querySelector('[data-gallery-modal-thumbs]');
    const modalTemplates = [...this.section.querySelectorAll('[data-gallery-modal-template]')];
    const closeModal = this.section.querySelector('[data-gallery-close]');
    const mediaIds = items.map((item) => Number(item.dataset.mediaId));
    let lastZoomTrigger = null;
    let activeModalMediaId = null;

    thumbButtons.forEach((button) => {
      button.addEventListener('click', () => this.showMedia(Number(button.dataset.targetMediaId)));
    });

    const scrollToOffset = (direction) => {
      this.viewport.scrollBy({ left: direction * this.viewport.clientWidth, behavior: 'smooth' });
    };

    prev?.addEventListener('click', () => scrollToOffset(-1));
    next?.addEventListener('click', () => scrollToOffset(1));

    const renderModalMedia = (mediaId) => {
      const template = modalTemplates.find((item) => Number(item.dataset.galleryModalTemplate) === mediaId);
      if (!template || !modalBody) return;

      modalBody.replaceChildren(template.content.cloneNode(true));
      activeModalMediaId = mediaId;

      modalThumbs?.querySelectorAll('[data-gallery-modal-thumb]').forEach((thumb) => {
        const isActive = Number(thumb.dataset.targetMediaId) === mediaId;
        thumb.classList.toggle('is-active', isActive);
        thumb.setAttribute('aria-current', isActive ? 'true' : 'false');
      });
    };

    const renderAdjacentModalMedia = (direction) => {
      if (!mediaIds.length || activeModalMediaId === null) return;
      const currentIndex = mediaIds.indexOf(activeModalMediaId);
      if (currentIndex < 0) return;

      const nextIndex = (currentIndex + direction + mediaIds.length) % mediaIds.length;
      renderModalMedia(mediaIds[nextIndex]);
    };

    modalThumbs?.querySelectorAll('[data-gallery-modal-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        renderModalMedia(Number(thumb.dataset.targetMediaId));
      });
    });

    zoomButtons.forEach((button) => {
      button.addEventListener('click', () => {
        const item = button.closest('[data-media-id]');
        if (!item || !modal || !modalBody) return;
        lastZoomTrigger = button;
        renderModalMedia(Number(item.dataset.mediaId));
        document.documentElement.classList.add('product-gallery-modal-open');
        document.body.classList.add('product-gallery-modal-open');
        modal.showModal();
        closeModal?.focus();
      });
    });

    closeModal?.addEventListener('click', () => modal?.close());
    modal?.addEventListener('click', (event) => {
      if (event.target === modal) modal.close();
    });
    modal?.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        renderAdjacentModalMedia(-1);
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        renderAdjacentModalMedia(1);
      }
    });
    modal?.addEventListener('close', () => {
      modalBody?.replaceChildren();
      activeModalMediaId = null;
      document.documentElement.classList.remove('product-gallery-modal-open');
      document.body.classList.remove('product-gallery-modal-open');
      lastZoomTrigger?.focus();
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((entry) => entry.isIntersecting);
        if (!visible) return;
        const mediaId = Number(visible.target.dataset.mediaId);
        items.forEach((item) => item.classList.toggle('is-active', item === visible.target));
        thumbButtons.forEach((button) =>
          button.classList.toggle('is-active', Number(button.dataset.targetMediaId) === mediaId)
        );
      },
      { root: this.viewport, threshold: 0.55 }
    );

    items.forEach((item) => observer.observe(item));
  }

  setupPeekLoop() {
    const viewport = this.viewport;
    if (!viewport || !this.gallery || !this.gallery.classList.contains('product-gallery--mobile-peek')) return;

    const reals = [...viewport.children].filter((child) => child.hasAttribute('data-media-id'));
    if (reals.length < 2) return;

    const mq = window.matchMedia('(max-width: 989px)');
    let clones = [];
    let scrollTimer = null;
    let jumping = false;

    const centerOn = (el) => {
      jumping = true;
      const itemLeft = el.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;
      viewport.scrollTo({ left: itemLeft - (viewport.clientWidth - el.offsetWidth) / 2, behavior: 'auto' });
      window.requestAnimationFrame(() => {
        jumping = false;
      });
    };

    const isCentered = (el) => {
      const vpRect = viewport.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      return Math.abs(rect.left + rect.width / 2 - (vpRect.left + vpRect.width / 2)) < rect.width / 2;
    };

    const handleSettle = () => {
      if (jumping || clones.length !== 2) return;
      if (isCentered(clones[0])) {
        centerOn(reals[reals.length - 1]);
      } else if (isCentered(clones[1])) {
        centerOn(reals[0]);
      }
    };

    const onScroll = () => {
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(handleSettle, 130);
    };

    const enable = () => {
      if (clones.length) return;
      const leadClone = reals[reals.length - 1].cloneNode(true);
      const tailClone = reals[0].cloneNode(true);
      [leadClone, tailClone].forEach((clone) => {
        clone.removeAttribute('data-media-id');
        clone.setAttribute('aria-hidden', 'true');
        clone.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
      });
      viewport.insertBefore(leadClone, reals[0]);
      viewport.appendChild(tailClone);
      clones = [leadClone, tailClone];
      viewport.addEventListener('scroll', onScroll, { passive: true });
      window.requestAnimationFrame(() => centerOn(reals[0]));
    };

    const disable = () => {
      if (!clones.length) return;
      viewport.removeEventListener('scroll', onScroll);
      window.clearTimeout(scrollTimer);
      clones.forEach((clone) => clone.remove());
      clones = [];
    };

    const apply = () => {
      if (mq.matches) {
        enable();
      } else {
        disable();
      }
    };

    apply();
    mq.addEventListener('change', apply);
  }

  bindQuantityControls() {
    if (!this.quantityInput) return;

    const decrease = this.section.querySelector('[data-quantity-decrease]');
    const increase = this.section.querySelector('[data-quantity-increase]');

    decrease?.addEventListener('click', () => {
      const nextValue = Math.max(1, Number(this.quantityInput.value || 1) - 1);
      this.quantityInput.value = nextValue;
    });

    increase?.addEventListener('click', () => {
      const nextValue = Math.max(1, Number(this.quantityInput.value || 1) + 1);
      this.quantityInput.value = nextValue;
    });

    this.quantityInput.addEventListener('change', () => {
      const normalized = Math.max(1, Number(this.quantityInput.value || 1));
      this.quantityInput.value = normalized;
    });
  }

  showMedia(mediaId) {
    const target = this.section.querySelector(`[data-media-id="${mediaId}"]`);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });

    this.section.querySelectorAll('[data-gallery-thumb]').forEach((button) => {
      button.classList.toggle('is-active', Number(button.dataset.targetMediaId) === mediaId);
    });
  }

  bindStickyBar() {
    if (!this.stickyBar || !this.addToCart || !this.stickySubmit) return;

    this.stickySubmit.addEventListener('click', () => {
      this.addToCart.click();
    });

    let hasSeenAddToCart = false;
    let rafId = null;

    const updateStickyBarVisibility = () => {
      // In the theme editor, keep the bar visible so it can be previewed/styled.
      if (window.Shopify && window.Shopify.designMode) {
        this.stickyBar.hidden = false;
        rafId = null;
        return;
      }

      const buttonBounds = this.addToCart.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const isVisible =
        buttonBounds.bottom > 0 &&
        buttonBounds.top < viewportHeight;

      if (isVisible) hasSeenAddToCart = true;

      const hasScrolledPastButton = buttonBounds.bottom <= 0;
      this.stickyBar.hidden = !(hasSeenAddToCart && hasScrolledPastButton);
      rafId = null;
    };

    const requestStickyBarUpdate = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateStickyBarVisibility);
    };

    updateStickyBarVisibility();

    window.addEventListener('scroll', requestStickyBarUpdate, { passive: true });
    window.addEventListener('resize', requestStickyBarUpdate);
  }

  bindAccordions() {
    if (!this.accordionTriggers.length) return;

    this.accordionTriggers.forEach((trigger) => {
      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? this.section.querySelector(`#${CSS.escape(panelId)}`) : null;
      if (!panel) return;

      if (panel.dataset.accordionOpenDefault === 'true') {
        panel.style.height = `${panel.scrollHeight}px`;
      }

      trigger.addEventListener('click', () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        this.setAccordionState(trigger, panel, !isOpen);
      });
    });
  }

  setAccordionState(trigger, panel, shouldOpen) {
    trigger.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
    trigger.classList.toggle('is-open', shouldOpen);
    panel.classList.toggle('is-open', shouldOpen);

    if (shouldOpen) {
      panel.style.height = `${panel.scrollHeight}px`;
    } else {
      panel.style.height = `${panel.scrollHeight}px`;
      requestAnimationFrame(() => {
        panel.style.height = '0px';
      });
    }
  }

  formatMoney(amount) {
    const currency = window.Shopify?.currency?.active || 'USD';
    const locale = document.documentElement.lang || 'en-US';
    let formatted;
    try {
      // narrowSymbol -> plain "$" rather than "A$"; append the ISO code to match money_with_currency
      formatted = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol'
      }).format(amount / 100);
    } catch (_) {
      formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 100);
    }
    return `${formatted} ${currency}`;
  }

}

document.querySelectorAll('[data-product-section]').forEach((section) => {
  new ProductSectionController(section);
});
