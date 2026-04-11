const Decimal = require('decimal.js');
const { addDays, isAfter, isBefore, isEqual, parseISO } = require('date-fns');

// Pasted subset of cgt-engine calculations for debugging...
function isInTaxYear(dateString, taxYear) {
  // Mock '2024-25' always true
  return true;
}

function runCGTEngineCalculations(allTransactions, taxYear) {
  const byTicker = {};
  for(const t of allTransactions) {
    if(!byTicker[t.ticker]) byTicker[t.ticker] = [];
    byTicker[t.ticker].push(t);
  }
  
  const allDisposals = [];
  const poolsByTicker = {};

  for (const ticker in byTicker) {
    const txns = byTicker[ticker];
    txns.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let pool = { shares: new Decimal(0), totalCost: new Decimal(0) };

    let i = 0;
    while (i < txns.length) {
      const txn = txns[i];

      if (txn.type === 'BUY') {
        const unmatchedQty = new Decimal(txn.quantity).minus(txn.matched || 0);
        if (unmatchedQty.gt(0)) {
          const totalCostIncFees = new Decimal(txn.totalGBP).plus(txn.feesGBP || 0);
          const unmatchedCost = unmatchedQty.div(txn.quantity).times(totalCostIncFees);
          pool.shares = pool.shares.plus(unmatchedQty);
          pool.totalCost = pool.totalCost.plus(unmatchedCost);
        }
        i++;
        continue;
      }

      if (txn.type === 'SELL') {
          let remainingQty = new Decimal(txn.quantity);
          let totalAllowableCost = new Decimal(0);
          const disposalParts = [];

          // same day
          const sameDayBuys = txns.filter(t => t.type === 'BUY' && t.date === txn.date && t.ticker === ticker && !(t.matched && new Decimal(t.matched).gte(t.quantity)));
          for (const buy of sameDayBuys) {
            if (remainingQty.lte(0)) break;
            const availableBuyQty = new Decimal(buy.quantity).minus(buy.matched || 0);
            const matchQty = Decimal.min(remainingQty, availableBuyQty);
            const matchCost = matchQty.div(buy.quantity).times(new Decimal(buy.totalGBP).plus(buy.feesGBP || 0));
            remainingQty = remainingQty.minus(matchQty);
            totalAllowableCost = totalAllowableCost.plus(matchCost);
            buy.matched = (buy.matched || 0) + matchQty.toNumber();
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'SAME_DAY' });
            
            const buyIndex = txns.indexOf(buy);
            if (buyIndex < i) {
              pool.shares = pool.shares.minus(matchQty);
              pool.totalCost = pool.totalCost.minus(matchCost);
            }
          }

          // bb 
          const txnDateParsed = parseISO(txn.date);
          const thirtyDayEnd = addDays(txnDateParsed, 30);
          const bbBuys = txns.filter(t => {
            if (t.type !== 'BUY' || t.ticker !== ticker) return false;
            const tDate = parseISO(t.date);
            return isAfter(tDate, txnDateParsed) && (isBefore(tDate, thirtyDayEnd) || isEqual(tDate, thirtyDayEnd)) && !(t.matched && new Decimal(t.matched).gte(t.quantity));
          }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          for (const buy of bbBuys) {
            if (remainingQty.lte(0)) break;
            const availableQty = new Decimal(buy.quantity).minus(buy.matched || 0);
            const matchQty = Decimal.min(remainingQty, availableQty);
            const matchCost = matchQty.div(buy.quantity).times(new Decimal(buy.totalGBP).plus(buy.feesGBP || 0));
            remainingQty = remainingQty.minus(matchQty);
            totalAllowableCost = totalAllowableCost.plus(matchCost);
            buy.matched = (buy.matched || 0) + matchQty.toNumber();
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'BED_AND_BREAKFAST' });
          }

          // s104
          if (remainingQty.gt(0) && pool.shares.gt(0)) {
            const matchQty = Decimal.min(remainingQty, pool.shares);
            const poolCostPerShare = pool.totalCost.div(pool.shares);
            const matchCost = matchQty.times(poolCostPerShare);
            remainingQty = remainingQty.minus(matchQty);
            totalAllowableCost = totalAllowableCost.plus(matchCost);
            pool.shares = pool.shares.minus(matchQty);
            pool.totalCost = pool.totalCost.minus(matchCost);
            disposalParts.push({ qty: matchQty.toNumber(), cost: matchCost.toNumber(), rule: 'SECTION_104' });
          }

          const proceeds = Decimal.max(0, new Decimal(txn.totalGBP).minus(txn.feesGBP || 0));
          const gain = proceeds.minus(totalAllowableCost);

          allDisposals.push({
            date: txn.date,
            ticker,
            quantity: txn.quantity,
            proceedsGBP: Number(proceeds.toFixed(2)),
            allowableCostGBP: Number(totalAllowableCost.toFixed(2)),
            gainGBP: Number(gain.toFixed(2)),
            parts: disposalParts
          });
        
        i++;
        continue;
      }
      i++;
    }

    poolsByTicker[ticker] = {
      ticker,
      shares: pool.shares.toNumber(),
      totalCost: Number(pool.totalCost.toFixed(2))
    };
  }

  return { disposals: allDisposals, pools: Object.values(poolsByTicker) };
}

const mockTxns = [
  // User Case 1: LLOY
  { date: '2023-12-10', type: 'SELL', ticker: 'LLOY', quantity: 1000, priceGBP: 0.43, totalGBP: 430.05, feesGBP: 0 },
  { date: '2023-12-22', type: 'BUY', ticker: 'LLOY', quantity: 1000, priceGBP: 0.438, totalGBP: 438.00, feesGBP: 11.95 },
  
  // User Case 2: AAPL B&B
  { date: '2024-02-28', type: 'SELL', ticker: 'AAPL', quantity: 30, priceGBP: 168.50, totalGBP: 5055.05, feesGBP: 0 },
  { date: '2024-03-15', type: 'BUY', ticker: 'AAPL', quantity: 30, priceGBP: 168.90, totalGBP: 5067.00, feesGBP: 11.95 },

  // User Case 3: AAPL Same-Day
  { date: '2024-07-18', type: 'SELL', ticker: 'AAPL', quantity: 20, priceGBP: 197.80, totalGBP: 3956.05, feesGBP: 0 },
  { date: '2024-07-18', type: 'BUY', ticker: 'AAPL', quantity: 20, priceGBP: 198.40, totalGBP: 3968.00, feesGBP: 11.95 }
];

console.log(JSON.stringify(runCGTEngineCalculations(mockTxns, '2023-24'), null, 2));
console.log(JSON.stringify(runCGTEngineCalculations(mockTxns, '2024-25'), null, 2));
