import { runCGTEngineCalculations, RawTransaction } from './cgt-engine'

function evaluateAssertion(name: string, expected: number, actual: number) {
  // float comparison
  if (Math.abs(expected - actual) > 0.001) {
    console.error(`❌ [FAIL] ${name}: Expected £${expected}, got £${actual}`)
    return false
  }
  console.log(`✅ [PASS] ${name}`)
  return true
}

function runTests() {
  let passed = 0
  let failed = 0

  const assert = (name: string, expected: number, actual: number) => {
    if (evaluateAssertion(name, expected, actual)) passed++
    else failed++
  }

  // TEST 1: Simple buy and sell (S104 only)
  console.log('\n--- Test 1: Simple buy and sell (S104 only) ---')
  let txns1: RawTransaction[] = [
    { id: '1', date: '2024-06-01', type: 'BUY', ticker: 'AAPL', quantity: 100, priceGBP: 100, totalGBP: 10000, feesGBP: 0, securityName: 'Apple' },
    { id: '2', date: '2024-09-01', type: 'SELL', ticker: 'AAPL', quantity: 50, priceGBP: 120, totalGBP: 6000, feesGBP: 0, securityName: 'Apple' },
  ]
  let res1 = runCGTEngineCalculations(txns1, '2024-25')
  let disposal1 = res1.disposals[0]
  assert('T1. Allowable Cost', 5000, disposal1.allowableCostGBP)
  assert('T1. Gain', 1000, disposal1.gainGBP)
  assert('T1. Matching Rule', 1, disposal1.parts.length)
  assert('T1. Correct Rule Applied', 1, disposal1.parts[0].rule === 'SECTION_104' ? 1 : 0)
  assert('T1. S104 Pool Remaining Shares', 50, res1.pools.find(p => p.ticker === 'AAPL')?.shares || 0)
  assert('T1. S104 Pool Remaining Cost', 5000, res1.pools.find(p => p.ticker === 'AAPL')?.totalCost || 0)

  // TEST 2: 30-day rule triggered
  console.log('\n--- Test 2: 30-day rule triggered ---')
  let txns2: RawTransaction[] = [
    { id: '1', date: '2024-06-01', type: 'BUY', ticker: 'AAPL', quantity: 100, priceGBP: 100, totalGBP: 10000, feesGBP: 0, securityName: 'Apple' },
    { id: '2', date: '2024-09-01', type: 'SELL', ticker: 'AAPL', quantity: 100, priceGBP: 80, totalGBP: 8000, feesGBP: 0, securityName: 'Apple' },
    { id: '3', date: '2024-09-15', type: 'BUY', ticker: 'AAPL', quantity: 100, priceGBP: 85, totalGBP: 8500, feesGBP: 0, securityName: 'Apple' },
  ]
  let res2 = runCGTEngineCalculations(txns2, '2024-25')
  let disposal2 = res2.disposals[0]
  assert('T2. Allowable Cost (matched to 15 Sep buy)', 8500, disposal2.allowableCostGBP)
  assert('T2. Loss (proceeds 8000 less 8500 cost)', -500, disposal2.gainGBP)
  assert('T2. Rule Applied', 1, disposal2.parts[0].rule === 'BED_AND_BREAKFAST' ? 1 : 0)
  assert('T2. S104 Pool shares should be from Jun buy', 100, res2.pools.find(p => p.ticker === 'AAPL')?.shares || 0)
  assert('T2. S104 Pool cost should be from Jun buy', 10000, res2.pools.find(p => p.ticker === 'AAPL')?.totalCost || 0)

  // TEST 3: Same-day rule
  console.log('\n--- Test 3: Same-day rule ---')
  let txns3: RawTransaction[] = [
    { id: '1', date: '2024-10-10', type: 'BUY', ticker: 'LLOY', quantity: 50, priceGBP: 5, totalGBP: 250, feesGBP: 0, securityName: 'Lloyds' },
    { id: '2', date: '2024-10-10', type: 'SELL', ticker: 'LLOY', quantity: 50, priceGBP: 5.5, totalGBP: 275, feesGBP: 0, securityName: 'Lloyds' },
  ]
  let res3 = runCGTEngineCalculations(txns3, '2024-25')
  let disposal3 = res3.disposals[0]
  assert('T3. Allowable Cost', 250, disposal3.allowableCostGBP)
  assert('T3. Gain', 25, disposal3.gainGBP)
  assert('T3. Rule Applied', 1, disposal3.parts[0].rule === 'SAME_DAY' ? 1 : 0)
  assert('T3. S104 Pool shares (should be 0)', 0, res3.pools.find(p => p.ticker === 'LLOY')?.shares || 0)

  // TEST 4: Mixed matching
  console.log('\n--- Test 4: Mixed matching ---')
  let txns4: RawTransaction[] = [
    // Pre-existing pool (simplified as a past buy)
    { id: '0', date: '2024-01-01', type: 'BUY', ticker: 'TSCO', quantity: 200, priceGBP: 2, totalGBP: 400, feesGBP: 0, securityName: 'Tesco' },
    { id: '1', date: '2025-04-05', type: 'BUY', ticker: 'TSCO', quantity: 50, priceGBP: 3, totalGBP: 150, feesGBP: 0, securityName: 'Tesco' },
    { id: '2', date: '2025-04-05', type: 'SELL', ticker: 'TSCO', quantity: 100, priceGBP: 3.5, totalGBP: 350, feesGBP: 0, securityName: 'Tesco' },
  ]
  let res4 = runCGTEngineCalculations(txns4, '2024-25')
  let disposal4 = res4.disposals[0]
  assert('T4. Proceeds matches', 350, disposal4.proceedsGBP)
  assert('T4. Allowable Cost (150 same day + 100 S104)', 250, disposal4.allowableCostGBP)
  assert('T4. Gain (350 - 250)', 100, disposal4.gainGBP)
  
  const sameDayPart = disposal4.parts.find(p => p.rule === 'SAME_DAY')
  assert('T4. Same Day Part Qty', 50, sameDayPart?.qty || 0)
  assert('T4. Same Day Part Cost', 150, sameDayPart?.cost || 0)

  const s104Part = disposal4.parts.find(p => p.rule === 'SECTION_104')
  assert('T4. S104 Part Qty', 50, s104Part?.qty || 0)
  assert('T4. S104 Part Cost', 100, s104Part?.cost || 0)

  // TEST 5: Partial 30-Day Matches (Advanced scenario)
  console.log('\n--- Test 5: Partial B&B rule and remaining to S104 ---')
  let txns5: RawTransaction[] = [
    // Build initial pool of 100 shares @ £10/share = £1000
    { id: '1', date: '2024-01-01', type: 'BUY', ticker: 'TSLA', quantity: 100, priceGBP: 10, totalGBP: 1000, feesGBP: 0, securityName: 'Tesla' },
    // Sell all 100 shares at a loss @ £5/share = £500 proceeds
    { id: '2', date: '2024-05-01', type: 'SELL', ticker: 'TSLA', quantity: 100, priceGBP: 5, totalGBP: 500, feesGBP: 0, securityName: 'Tesla' },
    // Rebuy only 40 shares within 30 days @ £6/share = £240
    { id: '3', date: '2024-05-15', type: 'BUY', ticker: 'TSLA', quantity: 40, priceGBP: 6, totalGBP: 240, feesGBP: 0, securityName: 'Tesla' },
  ]
  let res5 = runCGTEngineCalculations(txns5, '2024-25')
  let disposal5 = res5.disposals[0]
  // According to rules:
  // First match 40 shares to B&B rule (the 15 May buy at £240)
  // Remaining 60 matches to S104 pool (60/100 * 1000 = £600)
  // Total Allowable Cost = 240 + 600 = 840
  // Proceeds = 500
  // Gain = -340 loss
  assert('T5. Total Allowable Cost', 840, disposal5.allowableCostGBP)
  assert('T5. Net Loss', -340, disposal5.gainGBP)
  
  const bbPart5 = disposal5.parts.find(p => p.rule === 'BED_AND_BREAKFAST')
  assert('T5. B&B Part Qty', 40, bbPart5?.qty || 0)
  assert('T5. B&B Part Cost', 240, bbPart5?.cost || 0)

  const s104Part5 = disposal5.parts.find(p => p.rule === 'SECTION_104')
  assert('T5. S104 Part Qty', 60, s104Part5?.qty || 0)
  assert('T5. S104 Part Cost', 600, s104Part5?.cost || 0)

  // Verify pool state after: 
  // Initial pool had 100, we used 60, so 40 remain. But wait...
  // The 15 May buy of 40 does NOT go into the pool because it was matched to the B&B!
  // So the pool should ONLY contain the remaining 40 original shares.
  const pool5 = res5.pools.find(p => p.ticker === 'TSLA')
  assert('T5. Pool Remaining Shares', 40, pool5?.shares || 0)
  assert('T5. Pool Remaining Cost', 400, pool5?.totalCost || 0)

  console.log(`\n==============\nRESULTS\nPassed: ${passed}\nFailed: ${failed}\n==============`)
}

runTests()
