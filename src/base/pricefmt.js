/* — форматирование цен: функции 1:1 из payment-flow.v2.js — */
window.MC_PRICE = (function(){
function formatUsd(num){ return '$' + (Math.abs(num % 1) < 0.001 ? Number(num).toFixed(0) : Number(num).toFixed(2)); }
function localizePlanPriceText(value){
    return String(value || '')
      .replace(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*month\s+billed annually\s+or\s+\$\s*(\d+(?:\.\d+)?)\s*\/\s*month\s+monthly/gi, '$$$1/мес при оплате за год или $$$2/мес ежемесячно')
      .replace(/\$\s*(\d+(?:\.\d+)?)\s*\/\s*mo\s*\(\$\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*\/\s*yr\)/gi, '$$$1/мес ($$$2/год)')
      .replace(/\bFree trial shown; final yearly price not disclosed\b/gi, 'Показан пробный период; итоговая цена за год не раскрыта')
      .replace(/\b7-day free trial\b/gi, '7 дней пробно')
      .replace(/\bfirst month\b/gi, 'первый месяц')
      .replace(/\bthen\b/gi, 'далее')
      .replace(/\bbilled annually\b/gi, 'при оплате за год')
      .replace(/\bmonthly\b/gi, 'ежемесячно')
      .replace(/\bannually\b/gi, 'в год')
      .replace(/\byearly\b/gi, 'годовой')
      .replace(/\bannual\b/gi, 'годовой')
      .replace(/\bper month\b/gi, 'в месяц')
      .replace(/\bper year\b/gi, 'в год')
      .replace(/\/month\b/gi, '/мес')
      .replace(/\/mo\b/gi, '/мес')
      .replace(/\/yr\b/gi, '/год')
      .replace(/\bmonth\b/gi, 'мес')
      .replace(/\byear\b/gi, 'год')
      .replace(/\bor\b/gi, 'или')
      .replace(/\s+/g, ' ')
      .trim();
  }
function compactPriceText(priceText, usd){
    const raw = String(priceText || '').trim();
    if (!raw) return typeof usd === 'number' ? formatUsd(usd) : 'Уточняется';
    let out = localizePlanPriceText(raw)
      .replace(/starting at/gi, 'от')
      .replace(/\s*→\s*/g, ' · ')
      .replace(/\s+/g, ' ')
      .trim();
    if (/\$\d/.test(out) && out.length > 48) {
      const dollars = out.match(/\$\d+(?:\.\d+)?/g) || [];
      if (dollars.length >= 2 && /7 дней пробно/i.test(out)) {
        out = '7 дней пробно · ' + dollars[0] + ' первый месяц · далее ' + dollars[1];
      } else if (dollars.length >= 2 && /далее/i.test(out)) {
        out = dollars[0] + ' · далее ' + dollars[1];
      } else if (dollars.length) {
        out = dollars[0] + (typeof usd === 'number' && usd != Number(dollars[0].replace('$','')) ? ' · условия тарифа' : '');
      }
    }
    return out;
  }
function compactPrimaryPriceText(priceText, usd){
    const raw = String(priceText || '').trim();
    if (!raw) return typeof usd === 'number' ? formatUsd(usd) : 'Уточняется';
    const dollars = raw.match(/\$\d+(?:\.\d+)?/g) || [];
    const explicitRecurring = raw.match(/then\s*(\$\d+(?:\.\d+)?)/i) || raw.match(/далее\s*(\$\d+(?:\.\d+)?)/i);
    if (explicitRecurring && explicitRecurring[1]) return explicitRecurring[1] + '/мес';
    if (/(trial|free trial|first month|первый месяц)/i.test(raw) && dollars.length) return dollars[dollars.length - 1] + '/мес';
    if (/(month|monthly|\/month|\/mo|per month|user\/month|seat\/month)/i.test(raw) && dollars.length) return dollars[0] + '/мес';
    if (/(year|yearly|annually|annual)/i.test(raw) && dollars.length && typeof usd === 'number') return formatUsd(usd) + '/мес';
    return compactPriceText(raw, usd);
  }
function monthlyOnlyDisplayPriceText(priceText, usd){
    const raw = String(priceText || '').trim();
    if (!raw) return typeof usd === 'number' ? formatUsd(usd) + '/мес' : 'Уточняется';
    const dollars = raw.match(/\$\d+(?:\.\d+)?/g) || [];
    const hasAnnual = /(billed annually|annually|annual|yearly|per year|\/yr|\/year|в год|годовой|при оплате за год)/i.test(raw);
    const hasMonthly = /(month|monthly|\/month|\/mo|per month|user\/month|seat\/month|ежемесячно|\/мес)/i.test(raw);
    if (hasAnnual && hasMonthly && dollars.length >= 2) return dollars[dollars.length - 1] + '/мес';
    if (hasMonthly && dollars.length) return compactPrimaryPriceText(raw, usd);
    return localizePlanPriceText(raw);
  }
return { localize: localizePlanPriceText, compact: compactPriceText, primary: compactPrimaryPriceText, monthly: monthlyOnlyDisplayPriceText };
})();
