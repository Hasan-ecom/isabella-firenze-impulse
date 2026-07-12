# Wealth Kings Custom Thema

A fast, accessible, fully customizable Shopify theme — free to use and distribute.

- **Version:** 1.0.0
- **Author:** YC Web Design
- **Platform:** [Shopify Online Store 2.0](https://shopify.dev/docs/storefronts/themes/architecture) (sections everywhere, JSON templates, theme blocks)

---

## Features

- Section-based, drag-and-drop storefront (Online Store 2.0)
- Sticky **cart drawer** with free-shipping progress bar and quantity editing
- **Predictive search** (products, collections, pages, articles)
- Configurable **product page**: gallery, variant picker, trust points, editorial blocks, size charts
- **Shipping-estimate** block with localized weekday/labels and bundled country flags
- **Recently viewed** products
- Testimonials & Trustpilot sliders (powered by Swiper)
- Newsletter, contact form, FAQ, rich text, hero, scrolling text/images, and more
- Responsive images (`srcset`/`sizes`), preloaded critical CSS and fonts
- Accessibility-minded: skip link, focus management, `prefers-reduced-motion` support, semantic markup

## Requirements

- A Shopify store
- [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) (recommended, for local development)

## Installation

### Option A — Upload the ZIP (no tooling required)

1. Download/zip this folder.
2. In Shopify admin go to **Online Store → Themes → Add theme → Upload zip file**.
3. Once uploaded, click **Customize** to configure it.

### Option B — Shopify CLI (for developers)

```bash
# Preview locally against your store
shopify theme dev --store your-store.myshopify.com

# Push to a new unpublished theme
shopify theme push --unpublished
```

See [`shopify.theme.toml`](shopify.theme.toml) to set up a named `production` environment.

## Customizing

Everything is configured from the Shopify theme editor (**Customize**):

- **Theme settings** (gear icon) — colors, typography, favicon, layout, social links, cart behavior.
- **Sections & blocks** — add, reorder, and configure sections on any template.
- **Product blocks** — on the product template, add blocks like Title, Price, Variant picker, Trust points, Shipping estimate, Size chart, and Editorial image.

### Shipping-estimate flags

The Shipping estimate block ships with bundled SVG flags (`assets/flag-*.svg`). Pick one from the **Flag** dropdown, or leave it on **Auto** to match the selected language. To add a flag that isn't listed:

1. Drop a `flag-<code>.svg` (ISO 3166-1 alpha-2, lowercase) into `assets/`.
2. Add the code to the `se_flags_available` list in [`snippets/product-info.liquid`](snippets/product-info.liquid).
3. Add an `{ "value": "<code>", "label": "<Country>" }` option to the `flag` setting in [`sections/main-product.liquid`](sections/main-product.liquid).

## Development

```bash
# Lint Liquid / theme structure (requires Shopify CLI)
shopify theme check
```

Theme-check rules are configured in [`.theme-check.yml`](.theme-check.yml).

## Project structure

```
assets/      CSS, JS, SVG flags, and other static files
blocks/      Reusable theme blocks
config/       settings_schema.json (theme settings) + settings_data.json (defaults)
layout/       theme.liquid + password.liquid
locales/      Translations (storefront + schema)
sections/     Storefront sections
snippets/     Reusable Liquid partials
templates/    JSON templates that compose sections
```

## Credits & licenses

Bundled third-party assets and their licenses are listed in [CREDITS.md](CREDITS.md).

## License

Released under the [MIT License](LICENSE). You are free to use, modify, and
distribute this theme. Bundled third-party assets remain under their own
licenses (see [CREDITS.md](CREDITS.md)).

## Support

- Documentation: https://ycwebdesign.com/theme-docs
- Support: https://ycwebdesign.com/theme-support
