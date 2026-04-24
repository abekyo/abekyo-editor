---
name: Language / translation
about: Add a new UI language, or improve an existing translation
title: "[i18n] "
labels: i18n, good first issue
---

## Language

- **Locale code** (e.g. `es`, `pt-BR`, `fr`):
- **Native speaker?** yes / no
- **Adding a new language, or improving an existing one?**

## Checklist (for new language PRs)

- [ ] Copied `messages/en.json` to `messages/<code>.json` and translated all values
- [ ] Added `<code>` to `i18n/routing.ts` `locales` array
- [ ] Added a button to `components/LanguageSwitcher.tsx`
- [ ] Verified the app renders in both locales without missing keys (blank strings fall back visibly)

## Notes

<!-- Anything unusual: right-to-left layout, gendered plurals, region-specific variants, etc. -->
