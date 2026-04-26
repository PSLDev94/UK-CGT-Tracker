import { runCGTEngineCalculations } from './src/lib/cgt-engine'

const mockTxns = [
  {
    date: '2024-05-01',
    type: 'BUY',
    ticker: 'AAPL',
    quantity: 100,
    priceGBP: 10,
    totalGBP: 1000,
    feesGBP: 10
  },
  {
    date: '2024-05-05',
    type: 'SELL',
    ticker: 'AAPL',
    quantity: 10,
    priceGBP: 20,
    totalGBP: 200,
    feesGBP: 5
  },
  {
    date: '2024-05-15',
    type: 'BUY',
    ticker: 'AAPL',
    quantity: 10,
    priceGBP: 5,
    totalGBP: 50,
    feesGBP: 2
  }
]

const result = runCGTEngineCalculations(mockTxns, '2024-25')
console.log(JSON.stringify(result.disposals, null, 2))
console.log(JSON.stringify(result.pools, null, 2))
