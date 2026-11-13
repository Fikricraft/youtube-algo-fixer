// ==UserScript==
// @name         YouTube Algorithm Fixer (Newest Content First)
// @namespace    http://tampermonkey.net/
// @version      2.0.0
// @description  Forces YouTube to prioritize newest uploads via chip auto-selection, DOM age filtering, watched threshold, Shorts/Mixes removal, and chronological search sorting.
// @author       Fikricraft
// @license      MIT
// @match        https://www.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @homepageURL  https://github.com/Fikricraft/youtube-algo-fixer
// @supportURL   https://github.com/Fikricraft/youtube-algo-fixer/issues
// @downloadURL  https://raw.githubusercontent.com/Fikricraft/youtube-algo-fixer/main/youtube-algo-fixer.user.js
// @updateURL    https://raw.githubusercontent.com/Fikricraft/youtube-algo-fixer/main/youtube-algo-fixer.user.js
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    // --- Default Configuration ---
    const DEFAULT_CONFIG = {
        autoClickRecentChip: true, // Auto-click "Recently uploaded" chip on Home
        enableAgeFilter: true,     // Hide old videos from Home & Sidebar
        maxAgeDays: 14,            // Maximum age of videos in days
        forceSearchNewest: false,  // Force &sp=CAI%3D (Sort by upload date) on Search
        hideWatched: true,         // Hide videos with a watched progress bar
        watchedThreshold: 15,      // Min % watched to hide (prevents hover-preview false positives)
        hideShortsAndMixes: true   // Hide Shorts shelves and endless Mixes that lack timestamps
    };

    const config = {};
    for (const key of Object.keys(DEFAULT_CONFIG)) {
        config[key] = GM_getValue(key, DEFAULT_CONFIG[key]);
    }

    function saveConfig() {
        for (const key of Object.keys(config)) {
            GM_setValue(key, config[key]);
        }
        processFeed(true);
    }

    // --- CSS Styling ---
    GM_addStyle(`
        .yt-algo-hidden {
            display: none !important;
        }
        #yt-algo-fixer-panel {
            position: fixed;
            bottom: 16px;
            left: 16px;
            z-index: 2147483647;
            background: rgba(15, 15, 15, 0.94);
            color: #f1f1f1;
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 10px;
            padding: 10px 14px;
            font-family: "Roboto", "YouTube Sans", Arial, sans-serif;
            font-size: 12px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(10px);
            user-select: none;
            min-width: 230px;
        }
        #yt-algo-fixer-panel.minimized {
            min-width: unset;
            padding: 8px 12px;
        }
        #yt-algo-fixer-panel.minimized .yt-algo-body {
            display: none;
        }
        .yt-algo-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            cursor: pointer;
            font-weight: 600;
            color: #3ea6ff;
        }
        .yt-algo-badge {
            background: rgba(62, 166, 255, 0.18);
            color: #3ea6ff;
            border-radius: 4px;
            padding: 1px 5px;
            font-size: 11px;
            font-variant-numeric: tabular-nums;
        }
        .yt-algo-body {
            margin-top: 10px;
            display: flex;
            flex-direction: column;
            gap: 8px;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 8px;
        }
        .yt-algo-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            cursor: pointer;
        }
        .yt-algo-row input[type="number"] {
            width: 52px;
            background: #272727;
            color: #fff;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 2px 4px;
            text-align: center;
            font-size: 12px;
        }
        .yt-algo-row input[type="checkbox"] {
            cursor: pointer;
            accent-color: #3ea6ff;
        }
    `);

    // --- Parse Upload Time Strings (EN & ID Support, 2026 View-Model Ready) ---
    const LIVE_REGEX = /\b(second|seconds|detik|minute|minutes|menit|hour|hours|jam|live|premiere|tayang|streaming|baru saja|just now)\b/i;
    const AGE_REGEX = /(\d+)\s*(day|days|hari|week|weeks|minggu|month|months|bulan|year|years|tahun)\b/i;

    function parseAgeInDays(text) {
        if (!text) return null;
        const normalized = text.replace(/\u00A0/g, ' ').toLowerCase().trim();

        // Check for relative age first so titles containing "live" don't spoof old uploads if full string is passed
        const match = normalized.match(AGE_REGEX);
        if (match) {
            const value = parseInt(match[1], 10);
            const unit = match[2];

            if (unit.startsWith('day') || unit.startsWith('hari')) return value;
            if (unit.startsWith('week') || unit.startsWith('minggu')) return value * 7;
            if (unit.startsWith('month') || unit.startsWith('bulan')) return value * 30;
            if (unit.startsWith('year') || unit.startsWith('tahun')) return value * 365;
        }

        if (LIVE_REGEX.test(normalized)) {
            return 0;
        }

        return null;
    }

    // --- 1. Auto-Click "Recently Uploaded" Chip on Homepage ---
    let chipState = {
        doneForNav: false,
        attempts: 0
    };

    const TARGET_CHIP_LABELS = new Set([
        'recently uploaded',
        'baru diupload',
        'new to you',
        'baru untuk anda'
    ]);

    function tryClickRecentChip() {
        if (!config.autoClickRecentChip || window.location.pathname !== '/' || chipState.doneForNav) {
            return;
        }

        if (chipState.attempts > 15) {
            chipState.doneForNav = true;
            return;
        }
        chipState.attempts++;

        const chips = document.querySelectorAll(
            'yt-chip-cloud-chip-renderer, chip-view-model, yt-formatted-string#text.yt-chip-cloud-chip-renderer'
        );

        if (chips.length === 0) return;

        for (const node of chips) {
            const chip = node.closest('yt-chip-cloud-chip-renderer, chip-view-model') || node;
            const text = (chip.innerText || chip.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

            if (TARGET_CHIP_LABELS.has(text)) {
                const button = chip.querySelector('button, [role="tab"], [role="button"]') || chip;
                const isSelected =
                    chip.getAttribute('aria-selected') === 'true' ||
                    button.getAttribute('aria-selected') === 'true' ||
                    chip.hasAttribute('selected');

                if (!isSelected) {
                    button.click();
                }
                chipState.doneForNav = true;
                return;
            }
        }
    }

    // --- 2. Force Search Results to Sort by Upload Date ---
    function enforceSearchNewest() {
        if (!config.forceSearchNewest || window.location.pathname !== '/results') return;

        const url = new URL(window.location.href);
        if (!url.searchParams.has('sp')) {
            url.searchParams.set('sp', 'CAI=');
            window.location.replace(url.toString());
        }
    }

    // --- 3. Extract Upload Age & Watched Status from Any Card Architecture ---
    function isCardWatched(card) {
        const bar = card.querySelector(
            'ytd-thumbnail-overlay-resume-playback-renderer #progress, ' +
            '.ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment, ' +
            'yt-thumbnail-overlay-progress-bar-view-model .ytThumbnailOverlayProgressBarHostWatchedProgressBarSegment'
        );
        if (!bar) return false;

        const widthStyle = bar.style.width || '';
        if (widthStyle.endsWith('%')) {
            const pct = parseFloat(widthStyle);
            if (!isNaN(pct)) {
                return pct >= config.watchedThreshold;
            }
        }
        return true;
    }

    function extractCardAgeDays(card) {
        // 1. Check discrete metadata spans (Polymer + 2025/2026 View-Model classes)
        const metaSpans = card.querySelectorAll(
            '#metadata-line span, ' +
            '.inline-metadata-item, ' +
            '.yt-content-metadata-view-model__metadata-text, ' +
            '.yt-content-metadata-view-model-wiz__metadata-text, ' +
            '.ytContentMetadataViewModelMetadataText, ' +
            'yt-content-metadata-view-model span.yt-core-attributed-string'
        );

        for (const span of metaSpans) {
            const text = span.textContent || '';
            if (
                text.includes('ago') ||
                text.includes('lalu') ||
                text.includes('Streamed') ||
                text.includes('Ditayangkan') ||
                text.includes('Premiere') ||
                text.includes('LIVE')
            ) {
                const parsed = parseAgeInDays(text);
                if (parsed !== null) return parsed;
            }
        }

        // 2. Fallback: aria-label on the title anchor often contains full metadata
        const titleLink = card.querySelector(
            'a#video-title-link, a#video-title, a.yt-lockup-metadata-view-model__title, a.ytLockupMetadataViewModelTitle'
        );
        if (titleLink) {
            const aria = titleLink.getAttribute('aria-label');
            if (aria) {
                const parsed = parseAgeInDays(aria);
                if (parsed !== null) return parsed;
            }
        }

        return null;
    }

    function isMixOrShortCard(card) {
        // Check for Radio/Mix links or Shorts hrefs inside standard cards
        if (card.querySelector('a[href*="start_radio=1"], a[href*="/shorts/"], ytd-thumbnail-overlay-bottom-panel-renderer')) {
            return true;
        }
        const badge = card.querySelector('yt-badge-view-model, .badge-style-type-live-now-alternate');
        if (badge && /\bmix\b/i.test(badge.textContent || '')) {
            return true;
        }
        return false;
    }

    // --- 4. Filter Video Cards & Shelves ---
    let hiddenCount = 0;

    function processFeed(forceRecalc = false) {
        const path = window.location.pathname;
        const isTargetPage = path === '/' || path === '/watch';
        if (!isTargetPage) {
            updateBadge(0);
            return;
        }

        // Handle dedicated Shorts / Reel shelves
        const shelves = document.querySelectorAll(
            'ytd-rich-section-renderer, ytd-reel-shelf-renderer, yt-shelf-view-model'
        );
        shelves.forEach(shelf => {
            const isShortsShelf =
                shelf.tagName.toLowerCase() === 'ytd-reel-shelf-renderer' ||
                shelf.querySelector('ytd-rich-shelf-renderer[is-shorts], a[href*="/shorts/"]') !== null;
            if (isShortsShelf) {
                shelf.classList.toggle('yt-algo-hidden', config.hideShortsAndMixes);
            }
        });

        // Select ONLY top-level card containers so we don't hide inner lockups and leave blank grid cells
        const cards = document.querySelectorAll(
            'ytd-rich-item-renderer, ' +
            'ytd-compact-video-renderer, ' +
            'ytd-compact-radio-renderer, ' +
            'yt-lockup-view-model:not(ytd-rich-item-renderer *)'
        );

        let currentHidden = 0;
        let visibleCount = 0;

        cards.forEach(card => {
            if (!forceRecalc && card.dataset.algoChecked === '1') {
                if (card.classList.contains('yt-algo-hidden')) currentHidden++;
                else visibleCount++;
                return;
            }

            let shouldHide = false;

            if (config.hideShortsAndMixes) {
                if (card.tagName.toLowerCase() === 'ytd-compact-radio-renderer' || isMixOrShortCard(card)) {
                    shouldHide = true;
                }
            }

            if (!shouldHide && config.hideWatched && isCardWatched(card)) {
                shouldHide = true;
            }

            if (!shouldHide && config.enableAgeFilter) {
                const ageDays = extractCardAgeDays(card);
                if (ageDays !== null && ageDays > config.maxAgeDays) {
                    shouldHide = true;
                }
            }

            card.classList.toggle('yt-algo-hidden', shouldHide);
            // Mark card once metadata has hydrated so we don't re-parse strings on every mutation
            if (shouldHide || extractCardAgeDays(card) !== null) {
                card.dataset.algoChecked = '1';
            }

            if (shouldHide) currentHidden++;
            else visibleCount++;
        });

        if (forceRecalc) {
            cards.forEach(c => { c.dataset.algoChecked = '1'; });
        }

        hiddenCount = currentHidden;
        updateBadge(hiddenCount);

        // If heavy filtering leaves fewer than 6 items on screen, nudge YouTube's intersection observer to fetch more
        if (visibleCount < 6 && currentHidden > 0) {
            window.dispatchEvent(new Event('scroll'));
        }
    }

    // --- 5. Floating UI Panel ---
    function updateBadge(count) {
        const badge = document.getElementById('yt-algo-hidden-badge');
        if (badge) {
            badge.textContent = `${count} hidden`;
        }
    }

    function mountControlPanel() {
        if (document.getElementById('yt-algo-fixer-panel') || !document.body) return;

        const panel = document.createElement('div');
        panel.id = 'yt-algo-fixer-panel';
        panel.className = 'minimized';

        const header = document.createElement('div');
        header.className = 'yt-algo-header';

        const titleSpan = document.createElement('span');
        titleSpan.textContent = '⚡ Algo Fixer v2';

        const badgeSpan = document.createElement('span');
        badgeSpan.id = 'yt-algo-hidden-badge';
        badgeSpan.className = 'yt-algo-badge';
        badgeSpan.textContent = `${hiddenCount} hidden`;

        const toggleIcon = document.createElement('span');
        toggleIcon.textContent = '▲';

        header.append(titleSpan, badgeSpan, toggleIcon);

        header.addEventListener('click', () => {
            panel.classList.toggle('minimized');
            toggleIcon.textContent = panel.classList.contains('minimized') ? '▲' : '▼';
        });

        const body = document.createElement('div');
        body.className = 'yt-algo-body';

        function createCheckboxRow(labelText, configKey) {
            const row = document.createElement('label');
            row.className = 'yt-algo-row';
            const span = document.createElement('span');
            span.textContent = labelText;
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = Boolean(config[configKey]);
            input.addEventListener('change', () => {
                config[configKey] = input.checked;
                saveConfig();
            });
            row.append(span, input);
            return row;
        }

        function createNumberRow(labelText, configKey, min, max) {
            const row = document.createElement('div');
            row.className = 'yt-algo-row';
            const label = document.createElement('span');
            label.textContent = labelText;
            const input = document.createElement('input');
            input.type = 'number';
            input.min = String(min);
            input.max = String(max);
            input.value = String(config[configKey]);
            input.addEventListener('change', () => {
                const val = parseInt(input.value, 10);
                if (!isNaN(val) && val >= min && val <= max) {
                    config[configKey] = val;
                    saveConfig();
                }
            });
            row.append(label, input);
            return row;
        }

        body.append(
            createCheckboxRow('Auto "Recently Uploaded" chip', 'autoClickRecentChip'),
            createCheckboxRow('Filter out old videos', 'enableAgeFilter'),
            createNumberRow('Max video age (days)', 'maxAgeDays', 1, 365),
            createCheckboxRow('Hide watched videos', 'hideWatched'),
            createNumberRow('Watched threshold (%)', 'watchedThreshold', 1, 100),
            createCheckboxRow('Hide Shorts & Mixes', 'hideShortsAndMixes'),
            createCheckboxRow('Force newest on Search', 'forceSearchNewest')
        );

        panel.append(header, body);
        document.body.appendChild(panel);
    }

    // --- Lifecycle & SPA Navigation Hooks ---
    let debounceTimer = null;
    function scheduleRun() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            mountControlPanel();
            tryClickRecentChip();
            enforceSearchNewest();
            processFeed(false);
        }, 180);
    }

    window.addEventListener('yt-navigate-finish', () => {
        chipState.doneForNav = false;
        chipState.attempts = 0;
        document.querySelectorAll('[data-algo-checked]').forEach(el => {
            delete el.dataset.algoChecked;
        });
        scheduleRun();
    });

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.addedNodes.length > 0) {
                scheduleRun();
                break;
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    scheduleRun();
})();