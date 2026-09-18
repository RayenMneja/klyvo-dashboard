import { sanitizeProductDescription } from './description-safe.js';
import { getProduct, getProducts } from './api.js';
import { clampQuantity, formatPrice, productAvailableStock, recommendProducts, resolveVariantSelection, selectedUnitPrice } from './core.js';
import { cartStore } from './cart-store.js';
import { emptyState, errorState, escapeHtml, initCommonUI, productCard, showCartWidget, updateCartBadge } from './ui.js';
const root = document.querySelector('#product-detail');
const id = new URLSearchParams(location.search).get('id');

function availableStock(product, color, size) {
  return productAvailableStock(product, { color, size });
}

function optionButtons(values, type, product) {
  return values.map((value) => {
    const disabled = Array.isArray(product.variants) && product.variants.length && availableStock(product, type === 'color' ? value : '', type === 'size' ? value : '') === 0;
    return `<button class="option-button" type="button" data-option="${type}" data-value="${escapeHtml(value)}" ${disabled ? 'disabled' : ''}>${escapeHtml(value)}</button>`;
  }).join('');
}

function structuredData(product) {
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Product', name: product.name, image: product.images, description: product.description, shortDescription: product.shortDescription, sku: product.sku, brand: { '@type': 'Brand', name: product.brand }, offers: { '@type': 'Offer', priceCurrency: 'TND', price: selectedUnitPrice(product), availability: productAvailableStock(product) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } });
  document.head.appendChild(script);
}

function renderProduct(product) {
  const sale = Number(product.discountPrice) > 0;
  const initialStock = productAvailableStock(product);
  const initialPrice = selectedUnitPrice(product);
  const images = [...new Set([product.image, ...(product.images || [])].filter(Boolean))];
  root.innerHTML = ` <div class="row g-4 g-lg-5">
    <div class="col-lg-6"><div class="gallery-main"><img id="main-product-image" src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" width="800" height="600"></div><div class="gallery-thumbs" aria-label="Galerie du produit">${images.map((image, index) => `<button class="gallery-thumb ${index === 0 ? 'active' : ''}" type="button" data-gallery-image="${escapeHtml(image)}" aria-label="Afficher l’image ${index + 1}"><img src="${escapeHtml(image)}" alt="" width="78" height="65"></button>`).join('')}</div></div>
    <div class="col-lg-6 " style="margin-top: 20%;">
      <p class="eyebrow mb-2">${escapeHtml(product.category)} · ${escapeHtml(product.subcategory)}</p>
      <h1 class="display-6 mb-3">${escapeHtml(product.name)}</h1>
      <p class="lead text-secondary">${escapeHtml(product.shortDescription)}</p>
      <div class="d-flex align-items-end gap-3 my-4"><span class="detail-price" id="detail-price">${formatPrice(initialPrice)}</span>${sale ? `<span class="old-price fs-6 mb-2">${formatPrice(product.price)}</span><span class="badge text-bg-danger mb-2">${escapeHtml((1-product.discountPrice/product.price).toFixed(2)*100)}%</span>` : ''}</div>
      <div class="stock-line ${initialStock > 0 ? 'in-stock' : 'out-stock'} mb-4" id="detail-stock"><span></span>${initialStock > 0 ? `${initialStock} unités disponibles` : 'Rupture de stock'}</div>
      ${product.colors?.length ? `<fieldset class="mb-4"><legend class="h6">Couleur <span class="text-danger">*</span></legend><div class="option-grid">${optionButtons(product.colors, 'color', product)}</div></fieldset>` : ''}
      ${product.sizes?.length ? `<fieldset class="mb-4"><legend class="h6">Taille <span class="text-danger">*</span></legend><div class="option-grid">${optionButtons(product.sizes, 'size', product)}</div></fieldset>` : ''}
      <div class="d-flex flex-wrap align-items-center gap-3 mb-4"><div class="quantity-control"><button type="button" data-quantity-change="-1" aria-label="Diminuer la quantité">−</button><input id="product-quantity" type="number" min="1" max="${initialStock}" value="${initialStock > 0 ? 1 : 0}" aria-label="Quantité"><button type="button" data-quantity-change="1" aria-label="Augmenter la quantité">+</button></div><button class="btn btn-primary btn-lg flex-grow-1" type="button" id="add-to-cart" ${initialStock <= 0 ? 'disabled' : ''}><i class="bi bi-bag-plus me-2"></i>Ajouter au panier</button></div>
      <p class="text-danger small" id="option-error" role="alert"></p>
      ${product.brand?.length ?`<div class="detail-facts mb-4"><div class="detail-fact"><small>Marque</small><strong>${escapeHtml(product.brand)}</strong></div>` : ''}
      <div class="detail-fact"><small>Référence</small><strong>${escapeHtml(product.sku)}</strong></div>
      <div class="border-top "><h2 class="h5">Description</h2>` + sanitizeProductDescription(product.description) + `</div>
    </div></div>`;

  let color = '';
  let size = '';
  const quantity = root.querySelector('#product-quantity');
  const refreshVariantDisplay = () => {
    const stock = availableStock(product, color, size);
    const price = selectedUnitPrice(product, { color, size });
    const stockElement = root.querySelector('#detail-stock');
    root.querySelector('#detail-price').textContent = formatPrice(price);
    stockElement.className = `stock-line ${stock > 0 ? 'in-stock' : 'out-stock'} mb-4`;
    stockElement.innerHTML = `<span></span>${stock > 0 ? `${stock} unités disponibles` : 'Variante indisponible'}`;
    quantity.max = String(stock);
    quantity.value = String(clampQuantity(quantity.value, stock));
    root.querySelector('#add-to-cart').disabled = stock <= 0;
    if (Array.isArray(product.variants) && product.variants.length) {
      root.querySelectorAll('[data-option="color"]').forEach((button) => { button.disabled = availableStock(product, button.dataset.value, '') <= 0; });
      root.querySelectorAll('[data-option="size"]').forEach((button) => { button.disabled = availableStock(product, '', button.dataset.value) <= 0; });
    }
  };
  root.addEventListener('click', (event) => {
    const gallery = event.target.closest('[data-gallery-image]');
    if (gallery) { root.querySelector('#main-product-image').src = gallery.dataset.galleryImage; root.querySelectorAll('.gallery-thumb').forEach((thumb) => thumb.classList.toggle('active', thumb === gallery)); }
    const option = event.target.closest('[data-option]');
    if (option) {
      const next = resolveVariantSelection(product, { color, size }, { type: option.dataset.option, value: option.dataset.value });
      color = next.color;
      size = next.size;
      root.querySelectorAll('[data-option="color"]').forEach((button) => button.classList.toggle('active', button.dataset.value === color));
      root.querySelectorAll('[data-option="size"]').forEach((button) => button.classList.toggle('active', button.dataset.value === size));
      refreshVariantDisplay();
      root.querySelector('#option-error').textContent = '';
    }
    const change = event.target.closest('[data-quantity-change]');
    if (change) quantity.value = String(clampQuantity(Number(quantity.value) + Number(change.dataset.quantityChange), Number(quantity.max)));
  });
  quantity.addEventListener('change', () => { quantity.value = String(clampQuantity(quantity.value, Number(quantity.max))); });
  root.querySelector('#add-to-cart').addEventListener('click', () => {
    const missing = (!color && product.colors?.length) || (!size && product.sizes?.length);
    if (missing) { root.querySelector('#option-error').textContent = 'Veuillez choisir les options du produit.'; return; }
    const stock = availableStock(product, color, size);
    if (stock <= 0) { root.querySelector('#option-error').textContent = 'Cette variante n’est plus disponible.'; return; }
    const unitPrice = selectedUnitPrice(
  product,
  { color, size }
);

cartStore.add(product, {
  color,
  size,
  quantity: quantity.value,
  stock,
  unitPrice
});

updateCartBadge();

showCartWidget(product, {
  color,
  size,
  quantity: quantity.value,
  unitPrice
});
  });
}

async function initProduct() {
  const products = await getProducts();
  initCommonUI(products);
  const product = id ? await getProduct(id) : null;
  if (!product) { root.innerHTML = emptyState('Produit introuvable', 'Ce produit n’existe pas ou n’est plus disponible.'); document.title = 'Produit introuvable — klyvo.tn'; return; }
  document.title = `${product.name} — klyvo.tn`;
  const productUrl = new URL('https://klyvo.tn/product.html');
  productUrl.searchParams.set('id', id);

  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = productUrl.href;
  document.head.appendChild(canonical);

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = productUrl.href;
  document.querySelector('meta[name="description"]').content = product.shortDescription;
  structuredData(product);
  document.querySelector('#product-breadcrumb').innerHTML = `<li class="breadcrumb-item"><a href="index.html">Accueil</a></li><li class="breadcrumb-item"><a href="products.html?category=${encodeURIComponent(product.category)}">${escapeHtml(product.category)}</a></li><li class="breadcrumb-item active" aria-current="page">${escapeHtml(product.name)}</li>`;
  renderProduct(product);
  const similar = recommendProducts(products, product, 4);
  if (similar.length) { document.querySelector('#similar-section').hidden = false; document.querySelector('#similar-products').innerHTML = similar.map((item) => `<div class="col">${productCard(item)}</div>`).join(''); }
}

initProduct().catch((error) => { console.error(error); root.innerHTML = errorState(error.message); document.querySelector('[data-retry]')?.addEventListener('click', () => location.reload()); });
