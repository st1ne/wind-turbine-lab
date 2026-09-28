/**
 * Brand (TECH_SPEC §3.1, §4.1). `name` and `domain` are left empty until the site has one:
 * empty values are simply not rendered (no brand line, a plain "wind-turbine" plate). Never
 * reuse a third-party brand.
 */
export const BRAND = {
  name: '',
  domain: '',
  handle: '@SolSt1ne',
  handleUrl: 'https://x.com/SolSt1ne',
} as const;
