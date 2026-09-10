/**
 * Gerador de scripts para os Coletores do Mercado Livre:
 * 1. Coletor Manual (Bookmarklet padrão)
 * 2. Coletor Turbo (Bookmarklet com varredura autônoma multi-páginas)
 * 3. Coletor Automático (Userscript Tampermonkey com monitoramento silencioso contínuo e auto-envio)
 */

export interface MLCollectorResultItem {
  id?: string
  mlb_id?: string
  title: string
  price?: number
  currency?: string
  condition?: string // 'usado' | 'novo' | 'recondicionado' | etc
  sold_quantity: number | null
  sold_quantity_text?: string
  available_quantity?: number
  permalink?: string
  thumbnail?: string
  seller_name?: string
  is_free_shipping?: boolean
  is_full?: boolean
  page_number?: number
}

export interface MLCollectorPayload {
  version: string
  source_url: string
  collected_at: string
  search_term?: string
  results_count: number
  with_sales_count: number
  source?: string
  results: MLCollectorResultItem[]
}

/**
 * Retorna o código javascript compactado para o Bookmarklet Padrão (Manual da página atual)
 */
export function getBookmarkletScript(): string {
  const code = `
(function() {
  try {
    const existingModal = document.getElementById('ml-collector-overlay');
    if (existingModal) existingModal.remove();

    function parseSoldQuantity(text) {
      if (!text) return { qty: null, raw: '' };
      const clean = text.toLowerCase().replace(/\\s+/g, ' ').trim();
      const milMatch = clean.match(/\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:mil|k)\\s*(?:vendidos?|vendas?)/i);
      if (milMatch) {
        const num = parseFloat(milMatch[1].replace(',', '.'));
        return { qty: Math.round(num * 1000), raw: text.trim() };
      }
      const numMatch = clean.match(/\\+?\\s*(\\d+)\\s*(?:vendidos?|vendas?)/i);
      if (numMatch) {
        return { qty: parseInt(numMatch[1], 10), raw: text.trim() };
      }
      return { qty: null, raw: text.trim() };
    }

    function extractMlbId(url) {
      if (!url) return '';
      const m = url.match(/MLB-?(\\d+)/i);
      return m ? 'MLB' + m[1] : '';
    }

    function parsePrice(text) {
      if (!text) return undefined;
      const clean = text.replace(/[^0-9,\\.]/g, '').replace(/\\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    }

    const items = [];
    const sourceUrl = window.location.href;

    let searchTerm = '';
    const searchInput = document.querySelector('input.nav-search-input') || document.querySelector('input[name="as_word"]');
    if (searchInput && searchInput.value) {
      searchTerm = searchInput.value.trim();
    } else {
      const urlMatch = sourceUrl.match(/lista\\.mercadolivre\\.com\\.br\\/([^?#]+)/);
      if (urlMatch) {
        searchTerm = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
      }
    }

    const isSingleItemPage = sourceUrl.includes('/p/MLB') || /\\/MLB-?\\d+/i.test(sourceUrl);
    const singleTitleEl = document.querySelector('h1.ui-pdp-title');
    
    if (isSingleItemPage && singleTitleEl) {
      const title = singleTitleEl.textContent.trim();
      let price = undefined;
      const priceMetaEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction');
      if (priceMetaEl) {
        price = parsePrice(priceMetaEl.textContent);
      }

      let soldQty = null;
      let soldRaw = '';
      let condition = '';
      const subtitleEl = document.querySelector('.ui-pdp-subtitle') || document.querySelector('.ui-pdp-header__subtitle');
      if (subtitleEl) {
        const subText = subtitleEl.textContent || '';
        const parsed = parseSoldQuantity(subText);
        soldQty = parsed.qty;
        soldRaw = parsed.raw;
        if (/usado/i.test(subText)) condition = 'usado';
        else if (/recondicionado/i.test(subText)) condition = 'recondicionado';
        else if (/novo/i.test(subText)) condition = 'novo';
      }

      let sellerName = '';
      const sellerEl = document.querySelector('.ui-pdp-seller__link-trigger') || document.querySelector('.ui-seller-info a') || document.querySelector('.ui-pdp-action-modal__link');
      if (sellerEl) sellerName = sellerEl.textContent.trim();

      items.push({
        id: extractMlbId(sourceUrl) || 'MLB_PAGE',
        mlb_id: extractMlbId(sourceUrl),
        title,
        price,
        currency: 'BRL',
        condition: condition || 'usado',
        sold_quantity: soldQty,
        sold_quantity_text: soldRaw,
        permalink: sourceUrl,
        seller_name: sellerName
      });
    } else {
      const cardSelectors = [
        '.ui-search-layout__item',
        '.ui-search-result__wrapper',
        'li.ui-search-layout__item',
        'div[class*="ui-search-result"]',
        '.poly-card',
        '.poly-component',
        'section.ui-search-results li',
        '.andes-card'
      ];
      let cardNodes = document.querySelectorAll(cardSelectors.join(', '));
      if (!cardNodes || cardNodes.length === 0) {
        const mlbLinks = Array.from(document.querySelectorAll('a[href*="/MLB-"], a[href*="/p/MLB"]'));
        const seenCards = new Set();
        cardNodes = [];
        mlbLinks.forEach(a => {
          const container = a.closest('li') || a.closest('.andes-card') || a.parentElement;
          if (container && !seenCards.has(container)) {
            seenCards.add(container);
            cardNodes.push(container);
          }
        });
      }

      const seenLinks = new Set();

      cardNodes.forEach((card) => {
        try {
          const linkEl = card.querySelector('a.ui-search-link') || card.querySelector('a[href*="MLB"]') || card.querySelector('a.poly-component__title') || card.querySelector('h2 a') || card.querySelector('a');
          if (!linkEl) return;

          const permalink = linkEl.href || '';
          const mlbId = extractMlbId(permalink);
          if (permalink && seenLinks.has(permalink)) return;
          if (permalink) seenLinks.add(permalink);

          const titleEl = card.querySelector('h2') || card.querySelector('.ui-search-item__title') || card.querySelector('.poly-component__title') || linkEl;
          const title = (titleEl ? titleEl.textContent : '').trim();
          if (!title || title.length < 3) return;

          let price = undefined;
          const fractionEl = card.querySelector('.andes-money-amount__fraction') || card.querySelector('.price-tag-fraction') || card.querySelector('[class*="money-amount"] [class*="fraction"]');
          if (fractionEl) {
            price = parsePrice(fractionEl.textContent);
          }

          let soldQty = null;
          let soldRaw = '';

          const polyReviewsEl = card.querySelector('.poly-reviews__total') || card.querySelector('.ui-search-reviews__amount') || card.querySelector('.poly-component__sales') || card.querySelector('[class*="reviews__total"]') || card.querySelector('[class*="sales"]');
          if (polyReviewsEl) {
            const parsed = parseSoldQuantity(polyReviewsEl.textContent);
            if (parsed.qty != null) {
              soldQty = parsed.qty;
              soldRaw = parsed.raw;
            }
          }

          if (soldQty == null) {
            const textNodes = card.querySelectorAll('span, p, div');
            for (const node of textNodes) {
              if (node.children.length > 2) continue;
              const t = (node.textContent || '').trim();
              if (/vendidos?|vendas?/i.test(t)) {
                const parsed = parseSoldQuantity(t);
                if (parsed.qty != null) {
                  soldQty = parsed.qty;
                  soldRaw = parsed.raw;
                  break;
                }
              }
            }
          }

          let condition = undefined;
          const cardText = card.textContent || '';
          if (/\\busado\\b/i.test(cardText)) condition = 'usado';
          else if (/\\brecondicionado\\b/i.test(cardText)) condition = 'recondicionado';
          else if (/\\bnovo\\b/i.test(cardText)) condition = 'novo';

          let sellerName = '';
          const sellerEl = card.querySelector('.ui-search-official-store-label') || card.querySelector('.ui-search-item__brand-discoverability') || card.querySelector('.poly-component__seller') || card.querySelector('[class*="seller"]');
          if (sellerEl) {
            sellerName = sellerEl.textContent.replace(/por\\s+/i, '').trim();
          }

          const imgEl = card.querySelector('img');
          const thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';

          const isFull = Boolean(card.querySelector('.ui-search-item__fulfillment') || card.querySelector('.poly-component__shipped-from'));
          const isFreeShipping = /frete gr[áa]tis/i.test(cardText);

          items.push({
            id: mlbId || 'MLB_' + (items.length + 1),
            mlb_id: mlbId,
            title,
            price,
            currency: 'BRL',
            condition,
            sold_quantity: soldQty,
            sold_quantity_text: soldRaw,
            permalink,
            thumbnail,
            seller_name: sellerName,
            is_free_shipping: isFreeShipping,
            is_full: isFull
          });
        } catch (e) {
          console.warn('[Bookmarklet] Erro ao extrair item individual:', e);
        }
      });
    }

    const withSalesCount = items.filter(i => i.sold_quantity != null && i.sold_quantity > 0).length;

    const payload = {
      version: '1.0.0',
      source_url: sourceUrl,
      collected_at: new Date().toISOString(),
      search_term: searchTerm,
      results_count: items.length,
      with_sales_count: withSalesCount,
      notes: 'manual',
      results: items
    };

    const jsonStr = JSON.stringify(payload, null, 2);

    const overlay = document.createElement('div');
    overlay.id = 'ml-collector-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.8);backdrop-filter:blur(4px);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#ffffff;color:#0f172a;width:100%;max-width:640px;border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;border:1px solid #cbd5e1;display:flex;flex-direction:column;max-height:90vh;';

    box.innerHTML = \`
      <div style="padding:16px 20px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#38bdf8;"></span>
          <strong style="font-size:16px;font-weight:700;">Coletor do Navegador · Mercado Livre</strong>
        </div>
        <button id="ml-collector-close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;">&times;</button>
      </div>
      <div style="padding:18px 20px;overflow-y:auto;flex:1;">
        <div style="display:flex;gap:12px;margin-bottom:14px;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid #e2e8f0;">
          <div style="flex:1;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Termo Detectado</div>
            <div style="font-size:14px;font-weight:700;color:#0f172a;margin-top:2px;">\${searchTerm || 'Página do Mercado Livre'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Anúncios Lidos</div>
            <div style="font-size:16px;font-weight:800;color:#0284c7;">\${items.length}</div>
          </div>
          <div style="text-align:right;border-left:1px solid #cbd5e1;padding-left:12px;">
            <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;">Com Vendas Reais</div>
            <div style="font-size:16px;font-weight:800;color:#16a34a;">\${withSalesCount}</div>
          </div>
        </div>

        <p style="font-size:12px;color:#475569;margin-bottom:8px;">
          JSON gerado com sucesso! Clique em <strong>Copiar JSON</strong> e cole no aplicativo do sistema (ou baixe o arquivo).
        </p>

        <textarea id="ml-collector-json-textarea" readonly style="width:100%;height:180px;font-family:monospace;font-size:11px;padding:10px;border-radius:6px;border:1px solid #cbd5e1;background:#f1f5f9;color:#0f172a;resize:none;box-sizing:border-box;">\${jsonStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>

        <div id="ml-collector-feedback" style="display:none;margin-top:8px;padding:8px 12px;background:#dcfce7;color:#166534;border-radius:6px;font-size:12px;font-weight:600;text-align:center;">
          ✓ JSON copiado para a área de transferência! Cole agora no app de Lotes.
        </div>
      </div>
      <div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:flex-end;gap:10px;">
        <button id="ml-collector-download-btn" style="padding:8px 14px;border-radius:6px;background:#ffffff;border:1px solid #cbd5e1;color:#334155;font-size:12px;font-weight:600;cursor:pointer;">
          Baixar .json
        </button>
        <button id="ml-collector-copy-btn" style="padding:8px 18px;border-radius:6px;background:#0284c7;border:none;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;">
          Copiar JSON
        </button>
      </div>
    \`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('ml-collector-close');
    closeBtn.addEventListener('click', () => overlay.remove());

    const copyBtn = document.getElementById('ml-collector-copy-btn');
    const feedback = document.getElementById('ml-collector-feedback');
    const textarea = document.getElementById('ml-collector-json-textarea');

    copyBtn.addEventListener('click', async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(jsonStr);
        } else {
          textarea.select();
          document.execCommand('copy');
        }
        feedback.style.display = 'block';
        copyBtn.textContent = '✓ Copiado!';
        copyBtn.style.background = '#16a34a';
      } catch (err) {
        textarea.select();
        document.execCommand('copy');
        feedback.style.display = 'block';
      }
    });

    const downloadBtn = document.getElementById('ml-collector-download-btn');
    downloadBtn.addEventListener('click', () => {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeTerm = (searchTerm || 'mercadolivre').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
      a.href = url;
      a.download = 'ml_coleta_' + safeTerm + '_' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });

  } catch (err) {
    alert('Erro ao executar Coletor do Mercado Livre: ' + (err && err.message ? err.message : err));
  }
})();
  `.trim()

  return 'javascript:' + encodeURIComponent(code)
}

/**
 * Retorna o código do Bookmarklet Coletor Turbo:
 * Varre páginas consecutivas (até maxPages ou até a última), acumula deduplicado,
 * e exibe modal completo com Copiar JSON, Baixar .json e Enviar Diretamente ao App via endpoint.
 */
export function getTurboBookmarkletScript(options: {
  appUrl?: string
  backendUrl?: string
  collectorKey: string
}): string {
  // O endpoint de ingestão fica no backend PocketBase (VITE_POCKETBASE_URL / pb.baseUrl),
  // e não no frontend estático (*.goskip.app), para evitar rejeição com HTTP 405 Method Not Allowed.
  const targetBackendUrl = (options.backendUrl || options.appUrl || '').replace(/\/+$/, '')

  const code = `
(function() {
  try {
    const existingModal = document.getElementById('ml-collector-turbo-overlay');
    if (existingModal) existingModal.remove();

    const BACKEND_URL = ${JSON.stringify(targetBackendUrl)};
    const COLLECTOR_KEY = ${JSON.stringify(options.collectorKey || '')};
    const MAX_PAGES = 20;
    const PAGE_DELAY_MS = 1400;

    function parseSoldQuantity(text) {
      if (!text) return { qty: null, raw: '' };
      const clean = text.toLowerCase().replace(/\\s+/g, ' ').trim();
      const milMatch = clean.match(/\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:mil|k)\\s*(?:vendidos?|vendas?)/i);
      if (milMatch) {
        const num = parseFloat(milMatch[1].replace(',', '.'));
        return { qty: Math.round(num * 1000), raw: text.trim() };
      }
      const numMatch = clean.match(/\\+?\\s*(\\d+)\\s*(?:vendidos?|vendas?)/i);
      if (numMatch) {
        return { qty: parseInt(numMatch[1], 10), raw: text.trim() };
      }
      return { qty: null, raw: text.trim() };
    }

    function extractMlbId(url) {
      if (!url) return '';
      const m = url.match(/MLB-?(\\d+)/i);
      return m ? 'MLB' + m[1] : '';
    }

    function parsePrice(text) {
      if (!text) return undefined;
      const clean = text.replace(/[^0-9,\\.]/g, '').replace(/\\./g, '').replace(',', '.');
      const num = parseFloat(clean);
      return isNaN(num) ? undefined : num;
    }

    function extractItemsFromDocument(doc, pageNum) {
      const items = [];
      const cardSelectors = [
        '.ui-search-layout__item',
        '.ui-search-result__wrapper',
        'li.ui-search-layout__item',
        'div[class*="ui-search-result"]',
        '.poly-card',
        '.poly-component',
        'section.ui-search-results li',
        '.andes-card'
      ];
      let cardNodes = doc.querySelectorAll(cardSelectors.join(', '));
      if (!cardNodes || cardNodes.length === 0) {
        const mlbLinks = Array.from(doc.querySelectorAll('a[href*="/MLB-"], a[href*="/p/MLB"]'));
        const seenCards = new Set();
        cardNodes = [];
        mlbLinks.forEach(a => {
          const container = a.closest('li') || a.closest('.andes-card') || a.parentElement;
          if (container && !seenCards.has(container)) {
            seenCards.add(container);
            cardNodes.push(container);
          }
        });
      }

      cardNodes.forEach((card) => {
        try {
          const linkEl = card.querySelector('a.ui-search-link') || card.querySelector('a[href*="MLB"]') || card.querySelector('a.poly-component__title') || card.querySelector('h2 a') || card.querySelector('a');
          if (!linkEl) return;

          const permalink = linkEl.href || '';
          const mlbId = extractMlbId(permalink);
          const titleEl = card.querySelector('h2') || card.querySelector('.ui-search-item__title') || card.querySelector('.poly-component__title') || linkEl;
          const title = (titleEl ? titleEl.textContent : '').trim();
          if (!title || title.length < 3) return;

          let price = undefined;
          const fractionEl = card.querySelector('.andes-money-amount__fraction') || card.querySelector('.price-tag-fraction') || card.querySelector('[class*="money-amount"] [class*="fraction"]');
          if (fractionEl) {
            price = parsePrice(fractionEl.textContent);
          }

          let soldQty = null;
          let soldRaw = '';

          const polyReviewsEl = card.querySelector('.poly-reviews__total') || card.querySelector('.ui-search-reviews__amount') || card.querySelector('.poly-component__sales') || card.querySelector('[class*="reviews__total"]') || card.querySelector('[class*="sales"]');
          if (polyReviewsEl) {
            const parsed = parseSoldQuantity(polyReviewsEl.textContent);
            if (parsed.qty != null) {
              soldQty = parsed.qty;
              soldRaw = parsed.raw;
            }
          }

          if (soldQty == null) {
            const textNodes = card.querySelectorAll('span, p, div');
            for (const node of textNodes) {
              if (node.children.length > 2) continue;
              const t = (node.textContent || '').trim();
              if (/vendidos?|vendas?/i.test(t)) {
                const parsed = parseSoldQuantity(t);
                if (parsed.qty != null) {
                  soldQty = parsed.qty;
                  soldRaw = parsed.raw;
                  break;
                }
              }
            }
          }

          let condition = undefined;
          const cardText = card.textContent || '';
          if (/\\busado\\b/i.test(cardText)) condition = 'usado';
          else if (/\\brecondicionado\\b/i.test(cardText)) condition = 'recondicionado';
          else if (/\\bnovo\\b/i.test(cardText)) condition = 'novo';

          let sellerName = '';
          const sellerEl = card.querySelector('.ui-search-official-store-label') || card.querySelector('.ui-search-item__brand-discoverability') || card.querySelector('.poly-component__seller') || card.querySelector('[class*="seller"]');
          if (sellerEl) {
            sellerName = sellerEl.textContent.replace(/por\\s+/i, '').trim();
          }

          const imgEl = card.querySelector('img');
          const thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
          const isFull = Boolean(card.querySelector('.ui-search-item__fulfillment') || card.querySelector('.poly-component__shipped-from'));
          const isFreeShipping = /frete gr[áa]tis/i.test(cardText);

          items.push({
            id: mlbId || 'MLB_' + (items.length + 1),
            mlb_id: mlbId,
            title,
            price,
            currency: 'BRL',
            condition,
            sold_quantity: soldQty,
            sold_quantity_text: soldRaw,
            permalink,
            thumbnail,
            seller_name: sellerName,
            is_free_shipping: isFreeShipping,
            is_full: isFull,
            page_number: pageNum
          });
        } catch (e) {
          console.warn('[Turbo] Erro ao extrair card:', e);
        }
      });

      return items;
    }

    function findNextPageUrl(doc) {
      const nextBtn = doc.querySelector('a.andes-pagination__link--next') ||
                      doc.querySelector('li.andes-pagination__button--next a') ||
                      doc.querySelector('a[title="Seguinte"]') ||
                      doc.querySelector('a[title="Próxima"]') ||
                      doc.querySelector('.ui-search-pagination a:last-child');
      if (nextBtn && nextBtn.href && !nextBtn.hasAttribute('aria-disabled') && !nextBtn.classList.contains('andes-pagination__link--disabled')) {
        return nextBtn.href;
      }
      return null;
    }

    // Modal HUD de progresso inicial
    const overlay = document.createElement('div');
    overlay.id = 'ml-collector-turbo-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.85);backdrop-filter:blur(6px);z-index:99999999;display:flex;align-items:center;justify-content:center;padding:16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;';

    const box = document.createElement('div');
    box.style.cssText = 'background:#ffffff;color:#0f172a;width:100%;max-width:680px;border-radius:14px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.3);overflow:hidden;border:1px solid #cbd5e1;display:flex;flex-direction:column;max-height:92vh;';

    // Termo de busca
    let searchTerm = '';
    const searchInput = document.querySelector('input.nav-search-input') || document.querySelector('input[name="as_word"]');
    if (searchInput && searchInput.value) {
      searchTerm = searchInput.value.trim();
    } else {
      const urlMatch = window.location.href.match(/lista\\.mercadolivre\\.com\\.br\\/([^?#]+)/);
      if (urlMatch) {
        searchTerm = decodeURIComponent(urlMatch[1]).replace(/-/g, ' ');
      }
    }

    box.innerHTML = \`
      <div style="padding:16px 20px;background:#0f172a;color:#ffffff;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1e293b;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#f59e0b;animation:pulse 1.5s infinite;"></span>
          <strong style="font-size:16px;font-weight:700;">⚡ Coletor Turbo Multi-páginas</strong>
          <span style="font-size:10px;background:#f59e0b;color:#0f172a;font-weight:800;padding:2px 6px;border-radius:4px;">AUTO-SWEEP</span>
        </div>
        <button id="ml-turbo-close" style="background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:20px;line-height:1;padding:4px 8px;">&times;</button>
      </div>

      <div style="padding:20px;overflow-y:auto;flex:1;">
        <div id="ml-turbo-status-card" style="background:#f8fafc;padding:14px;border-radius:8px;border:1px solid #e2e8f0;margin-bottom:16px;">
          <div style="font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Status da Varredura</div>
          <div id="ml-turbo-status-text" style="font-size:15px;font-weight:700;color:#0f172a;margin-top:4px;">
            Lendo página 1 da busca...
          </div>
          <div style="display:flex;gap:12px;margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
            <div style="flex:1;">
              <div style="font-size:11px;color:#64748b;">Termo:</div>
              <div style="font-size:13px;font-weight:700;color:#0f172a;">\${searchTerm || 'Busca Mercado Livre'}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;color:#64748b;">Páginas Lidas:</div>
              <div id="ml-turbo-pages-count" style="font-size:16px;font-weight:800;color:#0284c7;">1</div>
            </div>
            <div style="text-align:right;border-left:1px solid #cbd5e1;padding-left:12px;">
              <div style="font-size:11px;color:#64748b;">Total Itens:</div>
              <div id="ml-turbo-items-count" style="font-size:16px;font-weight:800;color:#4f46e5;">0</div>
            </div>
            <div style="text-align:right;border-left:1px solid #cbd5e1;padding-left:12px;">
              <div style="font-size:11px;color:#64748b;">Com Vendas:</div>
              <div id="ml-turbo-sales-count" style="font-size:16px;font-weight:800;color:#16a34a;">0</div>
            </div>
          </div>
        </div>

        <div id="ml-turbo-progress-container" style="margin-bottom:16px;">
          <div style="height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden;">
            <div id="ml-turbo-progress-bar" style="height:100%;background:#f59e0b;width:5%;transition:width 0.3s;"></div>
          </div>
        </div>

        <div id="ml-turbo-result-area" style="display:none;">
          <p style="font-size:12px;color:#475569;margin-bottom:8px;">
            Varredura Turbo concluída! Os anúncios de todas as páginas foram deduplicados.
          </p>
          <textarea id="ml-turbo-json-textarea" readonly style="width:100%;height:160px;font-family:monospace;font-size:11px;padding:10px;border-radius:6px;border:1px solid #cbd5e1;background:#f1f5f9;color:#0f172a;resize:none;box-sizing:border-box;"></textarea>
          
          <div id="ml-turbo-feedback" style="display:none;margin-top:8px;padding:10px 12px;background:#dcfce7;color:#166534;border-radius:6px;font-size:12px;font-weight:600;text-align:center;">
          </div>
        </div>
      </div>

      <div style="padding:14px 20px;background:#f8fafc;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <button id="ml-turbo-stop-btn" style="padding:8px 14px;border-radius:6px;background:#ef4444;border:none;color:#ffffff;font-size:12px;font-weight:700;cursor:pointer;">
          Parar Varredura
        </button>

        <div style="display:flex;gap:8px;">
          <button id="ml-turbo-download-btn" disabled style="padding:8px 14px;border-radius:6px;background:#ffffff;border:1px solid #cbd5e1;color:#64748b;font-size:12px;font-weight:600;cursor:not-allowed;">
            Baixar .json
          </button>
          <button id="ml-turbo-copy-btn" disabled style="padding:8px 14px;border-radius:6px;background:#ffffff;border:1px solid #cbd5e1;color:#64748b;font-size:12px;font-weight:600;cursor:not-allowed;">
            Copiar JSON
          </button>
          <button id="ml-turbo-send-btn" disabled style="padding:8px 18px;border-radius:6px;background:#cbd5e1;border:none;color:#ffffff;font-size:12px;font-weight:700;cursor:not-allowed;">
            🚀 Enviar ao App
          </button>
        </div>
      </div>
    \`;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const closeBtn = document.getElementById('ml-turbo-close');
    closeBtn.addEventListener('click', () => overlay.remove());

    const statusText = document.getElementById('ml-turbo-status-text');
    const pagesCountEl = document.getElementById('ml-turbo-pages-count');
    const itemsCountEl = document.getElementById('ml-turbo-items-count');
    const salesCountEl = document.getElementById('ml-turbo-sales-count');
    const progressBar = document.getElementById('ml-turbo-progress-bar');
    const resultArea = document.getElementById('ml-turbo-result-area');
    const jsonTextarea = document.getElementById('ml-turbo-json-textarea');
    const feedback = document.getElementById('ml-turbo-feedback');

    const stopBtn = document.getElementById('ml-turbo-stop-btn');
    const downloadBtn = document.getElementById('ml-turbo-download-btn');
    const copyBtn = document.getElementById('ml-turbo-copy-btn');
    const sendBtn = document.getElementById('ml-turbo-send-btn');

    let isStopped = false;
    stopBtn.addEventListener('click', () => {
      isStopped = true;
      stopBtn.textContent = 'Parando...';
      stopBtn.disabled = true;
    });

    // Iniciar varredura multi-páginas
    const allItemsMap = new Map();
    let currentPageNum = 1;
    let nextUrl = window.location.href;

    async function runTurboSweep() {
      try {
        // 1. Extrair página atual do DOM nativo
        const initialItems = extractItemsFromDocument(document, 1);
        initialItems.forEach(item => {
          const key = item.mlb_id || item.permalink || item.id;
          if (key && !allItemsMap.has(key)) {
            allItemsMap.set(key, item);
          }
        });

        updateStats(1);
        nextUrl = findNextPageUrl(document);

        // 2. Varrer próximas páginas via fetch sob a mesma sessão do usuário
        while (nextUrl && currentPageNum < MAX_PAGES && !isStopped) {
          currentPageNum++;
          statusText.textContent = 'Carregando página ' + currentPageNum + '...';
          progressBar.style.width = Math.min(100, Math.round((currentPageNum / MAX_PAGES) * 100)) + '%';

          // Delay de gentileza entre páginas para não acionar bloqueios
          await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
          if (isStopped) break;

          try {
            const resp = await fetch(nextUrl, { credentials: 'include' });
            if (!resp.ok) {
              console.warn('[Turbo] Erro HTTP ao carregar próxima página:', resp.status);
              break;
            }
            const htmlText = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlText, 'text/html');

            const pageItems = extractItemsFromDocument(doc, currentPageNum);
            pageItems.forEach(item => {
              const key = item.mlb_id || item.permalink || item.id;
              if (key && !allItemsMap.has(key)) {
                allItemsMap.set(key, item);
              }
            });

            updateStats(currentPageNum);
            nextUrl = findNextPageUrl(doc);
          } catch (fetchErr) {
            console.warn('[Turbo] Erro de rede:', fetchErr);
            break;
          }
        }

        finishSweep();
      } catch (err) {
        statusText.textContent = 'Erro durante a varredura: ' + (err.message || err);
        finishSweep();
      }
    }

    function updateStats(pageNum) {
      pagesCountEl.textContent = String(pageNum);
      itemsCountEl.textContent = String(allItemsMap.size);
      let salesCount = 0;
      allItemsMap.forEach(i => {
        if (i.sold_quantity != null && i.sold_quantity > 0) salesCount++;
      });
      salesCountEl.textContent = String(salesCount);
    }

    function finishSweep() {
      stopBtn.style.display = 'none';
      progressBar.style.width = '100%';
      progressBar.style.background = '#16a34a';

      const itemsArray = Array.from(allItemsMap.values());
      let salesCount = 0;
      itemsArray.forEach(i => {
        if (i.sold_quantity != null && i.sold_quantity > 0) salesCount++;
      });

      statusText.innerHTML = '✓ Varredura finalizada! <strong>' + itemsArray.length + ' anúncios</strong> coletados (' + salesCount + ' com vendas).';
      resultArea.style.display = 'block';

      const payload = {
        version: '1.1.0',
        source: 'turbo',
        source_url: window.location.href,
        collected_at: new Date().toISOString(),
        search_term: searchTerm,
        results_count: itemsArray.length,
        with_sales_count: salesCount,
        results: itemsArray
      };

      const jsonStr = JSON.stringify(payload, null, 2);
      jsonTextarea.value = jsonStr;

      // Habilitar botões
      downloadBtn.disabled = false;
      downloadBtn.style.cursor = 'pointer';
      downloadBtn.style.color = '#0f172a';

      copyBtn.disabled = false;
      copyBtn.style.cursor = 'pointer';
      copyBtn.style.color = '#0f172a';

      sendBtn.disabled = false;
      sendBtn.style.cursor = 'pointer';
      sendBtn.style.background = '#4f46e5';

      copyBtn.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(jsonStr);
          } else {
            jsonTextarea.select();
            document.execCommand('copy');
          }
          feedback.style.display = 'block';
          feedback.textContent = '✓ JSON copiado para a área de transferência!';
          copyBtn.textContent = '✓ Copiado';
          setTimeout(() => { copyBtn.textContent = 'Copiar JSON'; }, 3000);
        } catch (_) {
          jsonTextarea.select();
          document.execCommand('copy');
          feedback.style.display = 'block';
          feedback.textContent = '✓ JSON copiado!';
        }
      });

      downloadBtn.addEventListener('click', () => {
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const safeTerm = (searchTerm || 'mercadolivre').replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
        a.href = url;
        a.download = 'ml_turbo_' + safeTerm + '_' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });

      sendBtn.addEventListener('click', async () => {
        sendBtn.disabled = true;
        sendBtn.textContent = 'Enviando… ' + itemsArray.length + ' itens';
        sendBtn.style.background = '#f59e0b';
        feedback.style.display = 'block';
        feedback.style.background = '#fef3c7';
        feedback.style.color = '#92400e';
        feedback.textContent = 'Enviando… ' + itemsArray.length + ' itens ao app...';

        try {
          // Endpoint padrão da coleção PocketBase (garantido no runtime PocketBase v0.36)
          const primaryEndpoint = BACKEND_URL + '/api/collections/ml_collector_imports/records';
          const recordBody = {
            search_term: searchTerm,
            source_url: window.location.href,
            imported_at: new Date().toISOString(),
            payload: payload,
            results_count: itemsArray.length,
            with_sales_count: withSalesCount,
            notes: 'turbo'
          };

          let resp = await fetch(primaryEndpoint, {
            method: 'POST',
            mode: 'cors',
            headers: {
              'Content-Type': 'application/json',
              'X-Collector-Key': COLLECTOR_KEY
            },
            body: JSON.stringify(recordBody)
          });

          // Se a rota nativa falhar com 404, tenta rota customizada como fallback
          if (resp.status === 404) {
            const fallbackEndpoint = BACKEND_URL + '/backend/v1/ml-collector/ingest';
            resp = await fetch(fallbackEndpoint, {
              method: 'POST',
              mode: 'cors',
              headers: {
                'Content-Type': 'application/json',
                'X-Collector-Key': COLLECTOR_KEY
              },
              body: JSON.stringify(recordBody)
            });
          }

          if (resp.status === 401 || resp.status === 403) {
            throw new Error('Chave de coleta recusada (HTTP ' + resp.status + ') — verifique sua chave no app');
          }

          const data = await resp.json().catch(() => ({}));
          if (resp.ok && (data.id || data.ok)) {
            feedback.style.display = 'block';
            feedback.style.background = '#dcfce7';
            feedback.style.color = '#166534';
            feedback.innerHTML = '✓ Enviado (' + itemsArray.length + ' itens) — Coleta Turbo gravada com sucesso! Atualize o Raio-X para ver as vendas reais.';
            sendBtn.textContent = '✓ Enviado (' + itemsArray.length + ' itens)';
            sendBtn.style.background = '#16a34a';
          } else {
            throw new Error(data.message || data.error || 'Erro no servidor (HTTP ' + resp.status + ')');
          }
        } catch (postErr) {
          feedback.style.display = 'block';
          feedback.style.background = '#fee2e2';
          feedback.style.color = '#991b1b';

          let failMsg = postErr.message || 'Erro de rede';
          if (failMsg.includes('Failed to fetch') || failMsg.includes('NetworkError')) {
            failMsg = 'Erro de rede — certifique-se de que a URL do backend PocketBase está acessível';
          }
          feedback.textContent = '✗ ' + failMsg + '. Você também pode usar "Copiar JSON" e colar diretamente no app.';
          sendBtn.disabled = false;
          sendBtn.textContent = 'Tentar Enviar Novamente';
          sendBtn.style.background = '#ef4444';
        }
      });
    }

    runTurboSweep();

  } catch (err) {
    alert('Erro ao iniciar Coletor Turbo: ' + (err && err.message ? err.message : err));
  }
})();
  `.trim()

  return 'javascript:' + encodeURIComponent(code)
}

/**
 * Retorna o código COMPLETO do userscript Tampermonkey.
 * O usuário instala uma única vez e o script monitora automaticamente qualquer busca do ML.
 */
export function getTampermonkeyUserscript(options: {
  appUrl?: string
  backendUrl?: string
  collectorKey: string
}): string {
  // O endpoint de ingestão fica no backend PocketBase (VITE_POCKETBASE_URL),
  // e não no frontend estático (*.goskip.app), para evitar rejeição com HTTP 405 Method Not Allowed.
  const cleanBackendUrl = (options.backendUrl || options.appUrl || '').replace(/\/+$/, '')
  const cleanAppUrl = (options.appUrl || '').replace(/\/+$/, '')
  const collectorKey = options.collectorKey || ''

  // Monta lista de domínios @connect:
  // 1. Hosts fixos do app (preview e produção)
  // 2. Host do backend PocketBase (se fornecido)
  // 3. Host do app (se fornecido)
  // 4. Wildcard de fallback para extensões e outros subdomínios PocketBase
  const connectDomains = new Set<string>([
    'controle-de-lotes-de-equipamentos-25024--preview.goskip.app',
    'controle-de-lotes-de-equipamentos-25024.goskip.app',
  ])

  function addHostFromUrl(rawUrl: string) {
    if (!rawUrl) return
    try {
      const parsed = new URL(rawUrl)
      if (parsed.hostname) {
        connectDomains.add(parsed.hostname)
      }
    } catch {
      /* intentionally ignored */
    }
  }

  addHostFromUrl(cleanBackendUrl)
  addHostFromUrl(cleanAppUrl)

  const connectDirectives = Array.from(connectDomains)
    .map((domain) => `// @connect      ${domain}`)
    .join('\n')

  const SCRIPT_VERSION = '1.5.0'

  return `// ==UserScript==
// @name         Coletor Automático Mercado Livre · Lotes & Raio-X
// @namespace    https://controle-de-lotes.app/
// @version      ${SCRIPT_VERSION}
// @description  Captura contadores públicos de vendas e anúncios no Mercado Livre com envio sob demanda ao app de Lotes
// @author       Controle de Lotes de Equipamentos
// @match        *://lista.mercadolivre.com.br/*
// @match        *://www.mercadolivre.com.br/*
// @match        *://mercadolivre.com.br/*
// @match        *://*.mercadolivre.com.br/*
// @include      *://lista.mercadolivre.com.br/*
// @include      *://www.mercadolivre.com.br/*
// @include      *://mercadolivre.com.br/*
// @include      *://*.mercadolivre.com.br/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
${connectDirectives}
// @connect      *
// ==/UserScript==

(function() {
  'use strict';

  const VERSION = '${SCRIPT_VERSION}';

  // Log imediato para diagnóstico
  try {
    console.info('[Coletor Lotes] v' + VERSION + ' carregado em', location.href);
  } catch { /* intentionally ignored */ }

  // Configuração do Coletor Automático
  const CONFIG = {
    backendUrl: ${JSON.stringify(cleanBackendUrl)},
    appUrl: ${JSON.stringify(cleanAppUrl || cleanBackendUrl)},
    collectorKey: ${JSON.stringify(collectorKey)},
    storageKeyPrefix: 'ml_auto_collector_'
  };

  // Detecção flexível de tipo de página (informativa, NÃO bloqueia o HUD)
  const isSearchPage = window.location.href.includes('lista.mercadolivre.com.br') ||
                       window.location.href.includes('/jm/search') ||
                       window.location.search.includes('as_word') ||
                       window.location.search.includes('q=') ||
                       window.location.search.includes('query=') ||
                       /#D\\[A:/i.test(window.location.href);
  const isItemPage = window.location.href.includes('/p/MLB') || /\\/MLB-?\\d+/i.test(window.location.href);

  // Funções de extração de dados
  function parseSoldQuantity(text) {
    if (!text) return { qty: null, raw: '' };
    const clean = text.toLowerCase().replace(/\\s+/g, ' ').trim();
    const milMatch = clean.match(/\\+?\\s*(\\d+(?:[.,]\\d+)?)\\s*(?:mil|k)\\s*(?:vendidos?|vendas?)/i);
    if (milMatch) {
      const num = parseFloat(milMatch[1].replace(',', '.'));
      return { qty: Math.round(num * 1000), raw: text.trim() };
    }
    const numMatch = clean.match(/\\+?\\s*(\\d+)\\s*(?:vendidos?|vendas?)/i);
    if (numMatch) {
      return { qty: parseInt(numMatch[1], 10), raw: text.trim() };
    }
    return { qty: null, raw: text.trim() };
  }

  function extractMlbId(url) {
    if (!url) return '';
    const m = url.match(/MLB-?(\\d+)/i);
    return m ? 'MLB' + m[1] : '';
  }

  function parsePrice(text) {
    if (!text) return undefined;
    const clean = text.replace(/[^0-9,\\.]/g, '').replace(/\\./g, '').replace(',', '.');
    const num = parseFloat(clean);
    return isNaN(num) ? undefined : num;
  }

  function extractSearchTerm() {
    const searchInput = document.querySelector('input.nav-search-input') || document.querySelector('input[name="as_word"]');
    if (searchInput && searchInput.value) {
      return searchInput.value.trim();
    }
    const urlMatch = window.location.href.match(/lista\\.mercadolivre\\.com\\.br\\/([^?#]+)/);
    if (urlMatch) {
      try {
        return decodeURIComponent(urlMatch[1]).replace(/-/g, ' ').trim();
      } catch { /* intentionally ignored */ }
    }
    return '';
  }

  function extractItemsFromDOM() {
    const items = [];
    const sourceUrl = window.location.href;

    try {
      if (isItemPage) {
        const singleTitleEl = document.querySelector('h1.ui-pdp-title') || document.querySelector('h1');
        if (singleTitleEl) {
          const title = singleTitleEl.textContent.trim();
          let price = undefined;
          const priceMetaEl = document.querySelector('.ui-pdp-price__second-line .andes-money-amount__fraction') ||
                              document.querySelector('.andes-money-amount__fraction');
          if (priceMetaEl) {
            price = parsePrice(priceMetaEl.textContent);
          }

          let soldQty = null;
          let soldRaw = '';
          let condition = '';
          const subtitleEl = document.querySelector('.ui-pdp-subtitle') ||
                             document.querySelector('.ui-pdp-header__subtitle') ||
                             document.querySelector('.ui-pdp-color--GRAY');
          if (subtitleEl) {
            const subText = subtitleEl.textContent || '';
            const parsed = parseSoldQuantity(subText);
            soldQty = parsed.qty;
            soldRaw = parsed.raw;
            if (/usado/i.test(subText)) condition = 'usado';
            else if (/recondicionado/i.test(subText)) condition = 'recondicionado';
            else if (/novo/i.test(subText)) condition = 'novo';
          }

          let sellerName = '';
          const sellerEl = document.querySelector('.ui-pdp-seller__link-trigger') ||
                           document.querySelector('.ui-seller-info a') ||
                           document.querySelector('.ui-pdp-action-modal__link');
          if (sellerEl) sellerName = sellerEl.textContent.trim();

          items.push({
            id: extractMlbId(sourceUrl) || 'MLB_PAGE',
            mlb_id: extractMlbId(sourceUrl),
            title,
            price,
            currency: 'BRL',
            condition: condition || 'usado',
            sold_quantity: soldQty,
            sold_quantity_text: soldRaw,
            permalink: sourceUrl,
            seller_name: sellerName
          });
        }
        return items;
      }

      // Variações de layout e classes do Mercado Livre (clássico, poly, grid, lista)
      const cardSelectors = [
        '.ui-search-layout__item',
        '.ui-search-result__wrapper',
        'li.ui-search-layout__item',
        'div[class*="ui-search-result"]',
        '.poly-card',
        '.poly-component',
        'section.ui-search-results li',
        '.andes-card'
      ];
      let cardNodes = document.querySelectorAll(cardSelectors.join(', '));
      if (!cardNodes || cardNodes.length === 0) {
        // Fallback: busca por links que contenham /MLB- ou /p/MLB
        const mlbLinks = Array.from(document.querySelectorAll('a[href*="/MLB-"], a[href*="/p/MLB"]'));
        const seenCards = new Set();
        cardNodes = [];
        mlbLinks.forEach(a => {
          const container = a.closest('li') || a.closest('.andes-card') || a.parentElement;
          if (container && !seenCards.has(container)) {
            seenCards.add(container);
            cardNodes.push(container);
          }
        });
      }

      const seenLinks = new Set();

      cardNodes.forEach((card) => {
        try {
          const linkEl = card.querySelector('a.ui-search-link') ||
                         card.querySelector('a.poly-component__title') ||
                         card.querySelector('a[href*="MLB"]') ||
                         card.querySelector('h2 a') ||
                         card.querySelector('a');
          if (!linkEl) return;

          const permalink = linkEl.href || '';
          const mlbId = extractMlbId(permalink);
          if (permalink && seenLinks.has(permalink)) return;
          if (permalink) seenLinks.add(permalink);

          const titleEl = card.querySelector('h2') ||
                          card.querySelector('.ui-search-item__title') ||
                          card.querySelector('.poly-component__title') ||
                          linkEl;
          const title = (titleEl ? titleEl.textContent : '').trim();
          if (!title || title.length < 3) return;

          let price = undefined;
          const fractionEl = card.querySelector('.andes-money-amount__fraction') ||
                             card.querySelector('.price-tag-fraction') ||
                             card.querySelector('[class*="money-amount"] [class*="fraction"]');
          if (fractionEl) {
            price = parsePrice(fractionEl.textContent);
          }

          let soldQty = null;
          let soldRaw = '';

          // Busca contadores explícitos estilo "+100 vendidos", "+5 mil vendidos"
          const polyReviewsEl = card.querySelector('.poly-reviews__total') ||
                                card.querySelector('.ui-search-reviews__amount') ||
                                card.querySelector('.poly-component__sales') ||
                                card.querySelector('[class*="reviews__total"]') ||
                                card.querySelector('[class*="sales"]');
          if (polyReviewsEl) {
            const parsed = parseSoldQuantity(polyReviewsEl.textContent);
            if (parsed.qty != null) {
              soldQty = parsed.qty;
              soldRaw = parsed.raw;
            }
          }

          if (soldQty == null) {
            const textNodes = card.querySelectorAll('span, p, div');
            for (const node of textNodes) {
              if (node.children.length > 2) continue;
              const t = (node.textContent || '').trim();
              if (/vendidos?|vendas?/i.test(t)) {
                const parsed = parseSoldQuantity(t);
                if (parsed.qty != null) {
                  soldQty = parsed.qty;
                  soldRaw = parsed.raw;
                  break;
                }
              }
            }
          }

          let condition = undefined;
          const cardText = card.textContent || '';
          if (/\\busado\\b/i.test(cardText)) condition = 'usado';
          else if (/\\brecondicionado\\b/i.test(cardText)) condition = 'recondicionado';
          else if (/\\bnovo\\b/i.test(cardText)) condition = 'novo';

          let sellerName = '';
          const sellerEl = card.querySelector('.ui-search-official-store-label') ||
                           card.querySelector('.ui-search-item__brand-discoverability') ||
                           card.querySelector('.poly-component__seller') ||
                           card.querySelector('[class*="seller"]');
          if (sellerEl) {
            sellerName = sellerEl.textContent.replace(/por\\s+/i, '').trim();
          }

          const imgEl = card.querySelector('img');
          const thumbnail = imgEl ? (imgEl.src || imgEl.getAttribute('data-src') || '') : '';
          const isFull = Boolean(card.querySelector('.ui-search-item__fulfillment') || card.querySelector('.poly-component__shipped-from'));
          const isFreeShipping = /frete gr[áa]tis/i.test(cardText);

          items.push({
            id: mlbId || 'MLB_' + (items.length + 1),
            mlb_id: mlbId,
            title,
            price,
            currency: 'BRL',
            condition,
            sold_quantity: soldQty,
            sold_quantity_text: soldRaw,
            permalink,
            thumbnail,
            seller_name: sellerName,
            is_free_shipping: isFreeShipping,
            is_full: isFull
          });
        } catch (cardErr) {
          // Se falhar a leitura de um card específico, não quebra a extração dos demais
          console.warn('[Coletor] Erro ao extrair card individual:', cardErr);
        }
      });
    } catch (err) {
      console.error('[Coletor] Falha geral em extractItemsFromDOM:', err);
    }

    return items;
  }

  // Criação segura e infalível do HUD flutuante no canto inferior direito
  function mountHud() {
    if (document.getElementById('ml-auto-collector-hud')) {
      return document.getElementById('ml-auto-collector-hud');
    }

    const targetParent = document.body || document.documentElement;
    if (!targetParent) return null;

    const hud = document.createElement('div');
    hud.id = 'ml-auto-collector-hud';
    hud.style.cssText = [
      'position: fixed',
      'bottom: 18px',
      'right: 18px',
      'z-index: 2147483647',
      'background: rgba(15, 23, 42, 0.96)',
      'color: #ffffff',
      'padding: 10px 14px',
      'border-radius: 10px',
      'box-shadow: 0 10px 25px -5px rgba(0,0,0,0.45)',
      'font-family: system-ui, -apple-system, sans-serif',
      'font-size: 11px',
      'line-height: 1.4',
      'border: 1px solid rgba(255,255,255,0.18)',
      'backdrop-filter: blur(8px)',
      'max-width: 440px',
      'display: flex',
      'align-items: center',
      'gap: 10px',
      'transition: all 0.3s ease'
    ].join(';');

    hud.innerHTML = \`
      <div style="display:flex;flex-direction:column;gap:6px;width:100%;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="ml-auto-indicator" style="width:8px;height:8px;border-radius:50%;background:#38bdf8;box-shadow:0 0 8px #38bdf8;display:inline-block;shrink:0;"></span>
          <div style="display:flex;align-items:center;gap:6px;">
            <strong style="font-weight:700;color:#ffffff;">Coletor Lotes</strong>
            <span id="ml-auto-version" style="color:#94a3b8;font-size:9px;font-weight:normal;">v\${VERSION}</span>
            <span id="ml-auto-badge" style="background:#1e293b;color:#38bdf8;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:600;">Ativo</span>
          </div>
          <div style="display:flex;gap:4px;margin-left:auto;align-items:center;">
            <button id="ml-auto-send-btn" title="Enviar agora para o app" style="background:#0284c7;color:#fff;border:none;border-radius:4px;padding:4px 9px;font-size:10px;font-weight:700;cursor:pointer;transition:background 0.2s;">
              Enviar
            </button>
            <button id="ml-auto-min-btn" title="Minimizar" style="background:transparent;color:#94a3b8;border:none;cursor:pointer;padding:2px 4px;font-size:14px;line-height:1;">
              &minus;
            </button>
          </div>
        </div>

        <div id="ml-auto-expand-area" style="display:flex;flex-direction:column;gap:5px;">
          <div id="ml-auto-text" style="color:#cbd5e1;font-size:10px;line-height:1.3;">Ativo nesta página · aguardando resultados...</div>

          <div id="ml-auto-nav-controls" style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);padding:4px 6px;border-radius:6px;border:1px solid rgba(255,255,255,0.08);">
            <label for="ml-auto-pages-input" style="color:#94a3b8;font-size:10px;white-space:nowrap;">Páginas:</label>
            <input id="ml-auto-pages-input" type="number" min="1" max="100" value="1" title="Quantidade de páginas a coletar em sequência" style="width:42px;background:#0f172a;color:#ffffff;border:1px solid rgba(255,255,255,0.25);border-radius:4px;padding:2px 4px;font-size:10px;text-align:center;font-weight:bold;" />
            <button id="ml-auto-collect-multi-btn" type="button" title="Navega e acumula anúncios automaticamente pelas páginas do ML (envio continua manual)" style="background:#059669;color:#ffffff;border:none;border-radius:4px;padding:3px 8px;font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;display:flex;align-items:center;gap:3px;">
              <span>⚡ Coletar N Páginas</span>
            </button>
            <button id="ml-auto-stop-nav-btn" type="button" title="Interromper navegação de páginas" style="display:none;background:#dc2626;color:#ffffff;border:none;border-radius:4px;padding:3px 6px;font-size:10px;font-weight:700;cursor:pointer;">
              Parar
            </button>
          </div>
        </div>
      </div>
    \`;

    targetParent.appendChild(hud);
    return hud;
  }

  // Inicializa o HUD imediatamente ou aguarda o body
  let hudContainer = mountHud();
  if (!hudContainer) {
    document.addEventListener('DOMContentLoaded', () => {
      hudContainer = mountHud();
      bindHudEvents();
    });
  }

  // Elementos do HUD
  let indicator = null;
  let badge = null;
  let hudText = null;
  let sendBtn = null;
  let minBtn = null;
  let pagesInput = null;
  let collectMultiBtn = null;
  let stopNavBtn = null;
  let expandArea = null;
  let isMinimized = false;

  // Estado de paginação persistido na sessionStorage para navegação entre páginas reais do ML
  const SESSION_KEY = 'ml_collector_multi_session';

  function getMultiSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return null;
  }

  function saveMultiSession(data) {
    try {
      if (!data) sessionStorage.removeItem(SESSION_KEY);
      else sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  }

  function clearMultiSession() {
    try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
  }

  function findNextPageHref() {
    // 1. Botão "Seguinte" ou próximo padrão do Mercado Livre (.andes-pagination__button--next a)
    const nextBtn = document.querySelector('.andes-pagination__button--next a') ||
                    document.querySelector('a.andes-pagination__link--next') ||
                    document.querySelector('li.andes-pagination__button--next a') ||
                    document.querySelector('a[title="Seguinte"]') ||
                    document.querySelector('a[title="Próxima"]');
    if (nextBtn && nextBtn.href && !nextBtn.hasAttribute('aria-disabled') && !nextBtn.classList.contains('andes-pagination__link--disabled')) {
      return nextBtn.href;
    }

    // 2. Links com padrão _Desde_ da paginação clássica do Mercado Livre
    const allLinks = Array.from(document.querySelectorAll('a[href*="_Desde_"]'));
    const curMatch = window.location.href.match(/_Desde_(d+)/i);
    const curDesde = curMatch ? parseInt(curMatch[1], 10) : 1;

    for (const a of allLinks) {
      const match = a.href.match(/_Desde_(d+)/i);
      if (match) {
        const linkDesde = parseInt(match[1], 10);
        if (linkDesde > curDesde) {
          return a.href;
        }
      }
    }

    // 3. Fallback de paginação genérica
    const genericNext = document.querySelector('.ui-search-pagination a:last-child');
    if (genericNext && genericNext.href && genericNext.href !== window.location.href) {
      return genericNext.href;
    }

    return null;
  }

  function bindHudEvents() {
    indicator = document.getElementById('ml-auto-indicator');
    badge = document.getElementById('ml-auto-badge');
    hudText = document.getElementById('ml-auto-text');
    sendBtn = document.getElementById('ml-auto-send-btn');
    minBtn = document.getElementById('ml-auto-min-btn');
    pagesInput = document.getElementById('ml-auto-pages-input');
    collectMultiBtn = document.getElementById('ml-auto-collect-multi-btn');
    stopNavBtn = document.getElementById('ml-auto-stop-nav-btn');
    expandArea = document.getElementById('ml-auto-expand-area');

    if (minBtn && !minBtn.dataset.bound) {
      minBtn.dataset.bound = 'true';
      minBtn.addEventListener('click', () => {
        isMinimized = !isMinimized;
        const hudEl = document.getElementById('ml-auto-collector-hud');
        if (isMinimized) {
          if (expandArea) expandArea.style.display = 'none';
          minBtn.innerHTML = '&#43;';
          if (hudEl) hudEl.style.padding = '6px 10px';
        } else {
          if (expandArea) expandArea.style.display = 'flex';
          minBtn.innerHTML = '&minus;';
          if (hudEl) hudEl.style.padding = '10px 14px';
        }
      });
    }

    if (sendBtn && !sendBtn.dataset.bound) {
      sendBtn.dataset.bound = 'true';
      sendBtn.addEventListener('click', () => {
        sendBatchToApp();
      });
    }

    if (collectMultiBtn && !collectMultiBtn.dataset.bound) {
      collectMultiBtn.dataset.bound = 'true';
      collectMultiBtn.addEventListener('click', () => {
        startMultiPageCollection();
      });
    }

    if (stopNavBtn && !stopNavBtn.dataset.bound) {
      stopNavBtn.dataset.bound = 'true';
      stopNavBtn.addEventListener('click', () => {
        clearMultiSession();
        if (stopNavBtn) stopNavBtn.style.display = 'none';
        if (collectMultiBtn) {
          collectMultiBtn.disabled = false;
          collectMultiBtn.innerHTML = '<span>⚡ Coletar N Páginas</span>';
        }
        setStatus('collecting', 'Paginação interrompida. ' + accumulatedItems.size + ' itens acumulados no HUD. Clique em Enviar para salvar.');
      });
    }
  }

  bindHudEvents();

  // Estado acumulado na memória da sessão
  let accumulatedItems = new Map();
  let currentSearchTerm = extractSearchTerm() || '';
  let isSending = false;

  function setStatus(state, msg) {
    if (!indicator || !badge || !hudText) {
      bindHudEvents();
    }
    if (indicator && badge) {
      if (state === 'idle') {
        indicator.style.background = '#94a3b8';
        indicator.style.boxShadow = '0 0 6px #94a3b8';
        badge.textContent = 'Ativo';
        badge.style.color = '#94a3b8';
      } else if (state === 'collecting') {
        indicator.style.background = '#38bdf8';
        indicator.style.boxShadow = '0 0 8px #38bdf8';
        badge.textContent = 'Coletando';
        badge.style.color = '#38bdf8';
      } else if (state === 'sending') {
        indicator.style.background = '#f59e0b';
        indicator.style.boxShadow = '0 0 8px #f59e0b';
        badge.textContent = 'Enviando...';
        badge.style.color = '#f59e0b';
      } else if (state === 'success') {
        indicator.style.background = '#10b981';
        indicator.style.boxShadow = '0 0 8px #10b981';
        badge.textContent = 'Sincronizado';
        badge.style.color = '#10b981';
      } else if (state === 'error') {
        indicator.style.background = '#ef4444';
        indicator.style.boxShadow = '0 0 8px #ef4444';
        badge.textContent = 'Aviso';
        badge.style.color = '#ef4444';
      }
    }
    if (msg && hudText) hudText.textContent = msg;
  }

  function collectCurrentPage() {
    try {
      if (!document.getElementById('ml-auto-collector-hud')) {
        mountHud();
        bindHudEvents();
      }

      const term = extractSearchTerm() || currentSearchTerm;
      if (term && term !== currentSearchTerm && accumulatedItems.size > 0) {
        // O usuário mudou de busca na mesma aba: limpa o lote anterior
        accumulatedItems.clear();
        currentSearchTerm = term;
      } else if (term) {
        currentSearchTerm = term;
      }

      const items = extractItemsFromDOM();
      let newItemsCount = 0;
      items.forEach(item => {
        const key = item.mlb_id || item.permalink || item.id;
        if (key && !accumulatedItems.has(key)) {
          accumulatedItems.set(key, item);
          newItemsCount++;
        }
      });

      let salesCount = 0;
      accumulatedItems.forEach(i => {
        if (i.sold_quantity != null && i.sold_quantity > 0) salesCount++;
      });

      if (accumulatedItems.size === 0) {
        const termLabel = currentSearchTerm ? ('"' + currentSearchTerm.substring(0, 16) + '" · ') : '';
        setStatus('idle', termLabel + '0 itens detectados (aguardando resultados)');
      } else {
        const termLabel = currentSearchTerm ? ('"' + currentSearchTerm.substring(0, 18) + '" · ') : '';
        setStatus('collecting', termLabel + accumulatedItems.size + ' itens detectados (' + salesCount + ' com vendas) · Clique em Enviar');
      }
    } catch (collectErr) {
      console.error('[Coletor Automático] Erro durante collectCurrentPage:', collectErr);
      setStatus('error', 'Falha ao ler página: ' + (collectErr && collectErr.message ? collectErr.message : 'desconhecida'));
    }
  }

  function sendBatchToApp(isSync = false) {
    if (accumulatedItems.size === 0 || isSending) return;
    isSending = true;
    setStatus('sending', 'Enviando… ' + accumulatedItems.size + ' itens');

    const itemsArray = Array.from(accumulatedItems.values());
    let salesCount = 0;
    itemsArray.forEach(i => {
      if (i.sold_quantity != null && i.sold_quantity > 0) salesCount++;
    });

    const payload = {
      version: '1.1.0',
      source: 'auto',
      source_url: window.location.href,
      collected_at: new Date().toISOString(),
      search_term: currentSearchTerm || 'Busca Mercado Livre',
      results_count: itemsArray.length,
      with_sales_count: salesCount,
      results: itemsArray
    };

    const baseUrl = (CONFIG.backendUrl || CONFIG.appUrl || '').replace(/\\/+$/, '');
    // Endpoint oficial: API de coleções padrão do PocketBase
    const primaryEndpoint = baseUrl + '/api/collections/ml_collector_imports/records';
    const fallbackEndpoint = baseUrl + '/backend/v1/ml-collector/ingest';

    const recordBody = {
      search_term: currentSearchTerm || 'Busca Mercado Livre',
      source_url: window.location.href,
      imported_at: new Date().toISOString(),
      payload: payload,
      results_count: itemsArray.length,
      with_sales_count: salesCount,
      notes: 'auto'
    };
    const bodyStr = JSON.stringify(recordBody);

    // Envio cross-origin com fallback (GM_xmlhttpRequest, GM.xmlHttpRequest e fetch)
    let failureResetTimer = null;

    function handleSuccess(serverMsg) {
      isSending = false;
      if (failureResetTimer) clearTimeout(failureResetTimer);
      setStatus('success', '✓ Enviado (' + itemsArray.length + ' itens)');
      if (sendBtn) {
        sendBtn.textContent = '✓ Enviado';
        sendBtn.style.background = '#10b981';
      }
      setTimeout(() => {
        if (sendBtn) {
          sendBtn.textContent = 'Enviar';
          sendBtn.style.background = '#0284c7';
        }
        // Retorna status para coletando/pronto após alguns segundos
        const latestSales = Array.from(accumulatedItems.values()).filter(i => i.sold_quantity != null && i.sold_quantity > 0).length;
        const termLabel = currentSearchTerm ? ('"' + currentSearchTerm.substring(0, 18) + '" · ') : '';
        setStatus('collecting', termLabel + accumulatedItems.size + ' itens (' + latestSales + ' com vendas)');
      }, 5000);
    }

    function handleFailure(reasonType, detail) {
      isSending = false;
      if (failureResetTimer) clearTimeout(failureResetTimer);

      let msg = '';
      if (reasonType === 'blocked') {
        msg = '✗ Envio bloqueado pelo Tampermonkey — autorize o domínio';
      } else if (reasonType === 'auth') {
        msg = '✗ Chave recusada (' + (detail || '401/403') + ')';
      } else if (reasonType === 'method_not_allowed') {
        msg = '✗ HTTP 405: URL aponta para frontend estático em vez do backend PocketBase';
      } else if (reasonType === 'timeout') {
        msg = '✗ Timeout no envio — Tampermonkey aguardando autorização';
      } else if (reasonType === 'server') {
        msg = '✗ Erro no servidor: HTTP ' + detail;
      } else {
        msg = '✗ Erro de rede: ' + (detail || 'falha na conexão');
      }

      setStatus('error', msg);
      if (sendBtn) {
        sendBtn.textContent = 'Reenviar';
        sendBtn.style.background = '#ef4444';
      }
      console.warn('[Coletor Automático] Falha no envio:', reasonType, detail);

      // Persiste a mensagem por 7 segundos antes de voltar ao estado normal
      failureResetTimer = setTimeout(() => {
        if (sendBtn) {
          sendBtn.textContent = 'Enviar';
          sendBtn.style.background = '#0284c7';
        }
        const latestSales = Array.from(accumulatedItems.values()).filter(i => i.sold_quantity != null && i.sold_quantity > 0).length;
        const termLabel = currentSearchTerm ? ('"' + currentSearchTerm.substring(0, 18) + '" · ') : '';
        setStatus('collecting', termLabel + accumulatedItems.size + ' itens (' + latestSales + ' com vendas)');
      }, 7000);
    }

    function trySendRequest(targetUrl, isFallback) {
      const gmXmlHttp = (typeof GM_xmlhttpRequest === 'function')
        ? GM_xmlhttpRequest
        : (typeof GM !== 'undefined' && typeof GM.xmlHttpRequest === 'function')
          ? GM.xmlHttpRequest
          : null;

      if (gmXmlHttp) {
        try {
          gmXmlHttp({
            method: 'POST',
            url: targetUrl,
            headers: {
              'Content-Type': 'application/json',
              'X-Collector-Key': CONFIG.collectorKey
            },
            data: bodyStr,
            timeout: 25000,
            onload: function(response) {
              if (response.status >= 200 && response.status < 300) {
                handleSuccess();
              } else if (response.status === 404 && !isFallback) {
                trySendRequest(fallbackEndpoint, true);
              } else if (response.status === 401 || response.status === 403) {
                handleFailure('auth', response.status);
              } else if (response.status === 405) {
                handleFailure('method_not_allowed', response.status);
              } else {
                handleFailure('server', response.status);
              }
            },
            onerror: function(err) {
              const errStr = (err && (err.responseText || err.error || err.statusText || '')) + '';
              if (errStr.toLowerCase().includes('not connected') || errStr.toLowerCase().includes('connect') || errStr.toLowerCase().includes('permission') || !errStr) {
                handleFailure('blocked', errStr);
              } else {
                handleFailure('network', errStr);
              }
            },
            ontimeout: function() {
              handleFailure('timeout');
            }
          });
        } catch (callErr) {
          handleFailure('blocked', callErr && callErr.message);
        }
      } else {
        fetch(targetUrl, {
          method: 'POST',
          mode: 'cors',
          headers: {
            'Content-Type': 'application/json',
            'X-Collector-Key': CONFIG.collectorKey
          },
          body: bodyStr
        })
        .then(r => {
          if (r.status === 404 && !isFallback) {
            trySendRequest(fallbackEndpoint, true);
            return null;
          }
          if (r.status === 401 || r.status === 403) {
            handleFailure('auth', r.status);
            return null;
          }
          if (r.status === 405) {
            handleFailure('method_not_allowed', r.status);
            return null;
          }
          if (!r.ok) {
            handleFailure('server', r.status);
            return null;
          }
          return r.json();
        })
        .then(data => {
          if (!data) return;
          if (data.id || data.ok) handleSuccess();
          else handleFailure('server', data.message || data.error || 'Erro na resposta');
        })
        .catch(err => {
          const msg = (err && err.message) || '';
          if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
            handleFailure('network', 'falha de conexão CORS');
          } else {
            handleFailure('network', msg);
          }
        });
      }
    }

    trySendRequest(primaryEndpoint, false);
  }

  // Observador de mutação do DOM para acompanhar paginação SPA do Mercado Livre (apenas leitura passiva, sem auto-envio)
  let observerTimer = null;
  const observer = new MutationObserver(() => {
    if (observerTimer) clearTimeout(observerTimer);
    observerTimer = setTimeout(() => {
      collectCurrentPage();
    }, 1500);
  });

  try {
    const observeTarget = document.body || document.documentElement;
    if (observeTarget) {
      observer.observe(observeTarget, { childList: true, subtree: true });
    }
  } catch { /* intentionally ignored */ }

  // Iniciar varredura multi-páginas navegando pelo Mercado Livre
  function startMultiPageCollection() {
    const rawPages = pagesInput ? parseInt(pagesInput.value, 10) : 1;
    const targetPages = Math.max(1, Math.min(100, isNaN(rawPages) ? 1 : rawPages));

    // Se pediu 1 página, apenas garante a leitura da página atual
    if (targetPages <= 1) {
      collectCurrentPage();
      setStatus('collecting', 'Página atual minerada (' + accumulatedItems.size + ' itens). Clique em Enviar.');
      return;
    }

    // Coleta a página atual primeiro
    collectCurrentPage();

    const storedItemsObj = {};
    accumulatedItems.forEach((val, k) => { storedItemsObj[k] = val; });

    const sessionData = {
      targetPages: targetPages,
      currentPage: 1,
      searchTerm: currentSearchTerm || extractSearchTerm(),
      items: storedItemsObj,
      startedAt: Date.now()
    };

    saveMultiSession(sessionData);
    continueMultiPageSession(sessionData);
  }

  function continueMultiPageSession(sessionData) {
    if (!sessionData) return;

    if (stopNavBtn) stopNavBtn.style.display = 'inline-block';
    if (collectMultiBtn) {
      collectMultiBtn.disabled = true;
      collectMultiBtn.innerHTML = '<span>⏳ Pág. ' + sessionData.currentPage + '/' + sessionData.targetPages + '</span>';
    }

    setStatus('collecting', 'Navegando: pág. ' + sessionData.currentPage + ' de ' + sessionData.targetPages + ' (' + accumulatedItems.size + ' anúncios acumulados)...');

    if (sessionData.currentPage >= sessionData.targetPages) {
      // Concluído todas as páginas solicitadas!
      clearMultiSession();
      if (stopNavBtn) stopNavBtn.style.display = 'none';
      if (collectMultiBtn) {
        collectMultiBtn.disabled = false;
        collectMultiBtn.innerHTML = '<span>⚡ Coletar N Páginas</span>';
      }
      let salesCount = 0;
      accumulatedItems.forEach(i => {
        if (i.sold_quantity != null && i.sold_quantity > 0) salesCount++;
      });
      setStatus('collecting', '✓ ' + sessionData.targetPages + ' páginas coletadas com sucesso (' + accumulatedItems.size + ' anúncios, ' + salesCount + ' com vendas). Envio MANUAL: clique em Enviar!');
      return;
    }

    // Procura link da próxima página
    const nextHref = findNextPageHref();
    if (!nextHref) {
      clearMultiSession();
      if (stopNavBtn) stopNavBtn.style.display = 'none';
      if (collectMultiBtn) {
        collectMultiBtn.disabled = false;
        collectMultiBtn.innerHTML = '<span>⚡ Coletar N Páginas</span>';
      }
      setStatus('collecting', 'Fim da paginação do ML alcançado na página ' + sessionData.currentPage + ' (' + accumulatedItems.size + ' itens acumulados). Clique em Enviar.');
      return;
    }

    // Avança contador e navega para a próxima página após pausa para garantir DOM estável
    sessionData.currentPage += 1;
    const storedItemsObj = {};
    accumulatedItems.forEach((val, k) => { storedItemsObj[k] = val; });
    sessionData.items = storedItemsObj;
    saveMultiSession(sessionData);

    setStatus('collecting', 'Aguardando 1.5s para navegar para a página ' + sessionData.currentPage + '/' + sessionData.targetPages + '...');

    setTimeout(() => {
      window.location.href = nextHref;
    }, 1500);
  }

  // Restaura sessão de multi-páginas se estiver no meio de uma navegação
  function checkAndResumeMultiSession() {
    const session = getMultiSession();
    if (!session) return false;

    // Se a sessão expirou (> 15 minutos), limpa
    if (session.startedAt && Date.now() - session.startedAt > 15 * 60 * 1000) {
      clearMultiSession();
      return false;
    }

    // Restaura itens acumulados da sessão anterior
    if (session.items && typeof session.items === 'object') {
      Object.keys(session.items).forEach(k => {
        accumulatedItems.set(k, session.items[k]);
      });
    }

    if (session.searchTerm) {
      currentSearchTerm = session.searchTerm;
    }

    if (pagesInput) {
      pagesInput.value = session.targetPages || 1;
    }

    // Coleta a página recém-carregada
    collectCurrentPage();

    // Continua a navegação
    setTimeout(() => {
      continueMultiPageSession(session);
    }, 1200);

    return true;
  }

  // Primeira coleta após carga inicial
  setTimeout(() => {
    const resumed = checkAndResumeMultiSession();
    if (!resumed) {
      collectCurrentPage();
    }
  }, 800);
})();
`
}
