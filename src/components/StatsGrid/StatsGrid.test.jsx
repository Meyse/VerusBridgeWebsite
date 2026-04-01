const mockVerusd = {
  getCurrency: jest.fn(),
  getInfo: jest.fn()
}

jest.mock('verusd-rpc-ts-client', () => ({
  VerusdRpcInterface: jest.fn(() => mockVerusd)
}))

const createBridgeCurrencyResult = () => ({
  result: {
    bestcurrencystate: {
      reservecurrencies: [
        { currencyid: 'vrsc-id', priceinreserve: 15, reserves: 1500, weight: 0.25 },
        { currencyid: 'dai-id', priceinreserve: 10, reserves: 250, weight: 0.25 },
        { currencyid: 'mkr-id', priceinreserve: 0.005, reserves: 20, weight: 0.25 },
        { currencyid: 'eth-id', priceinreserve: 0.01, reserves: 25, weight: 0.25 }
      ],
      supply: 100
    },
    currencynames: {
      'dai-id': 'DAI.vETH',
      'eth-id': 'vETH',
      'mkr-id': 'MKR.vETH',
      'vrsc-id': 'VRSC'
    }
  }
})

describe('fetchBridgeStats', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
    mockVerusd.getCurrency.mockResolvedValue(createBridgeCurrencyResult())
    mockVerusd.getInfo.mockResolvedValue({
      result: {
        longestchain: 90
      }
    })
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  test('uses internal Bridge data without calling CoinPaprika', async () => {
    const { fetchBridgeStats } = require('./StatsGrid')
    const stats = await fetchBridgeStats()

    expect(global.fetch).not.toHaveBeenCalled()
    expect(mockVerusd.getCurrency).toHaveBeenCalledWith('bridge.veth')
    expect(stats.bridge.daiPrice).toBeCloseTo(10, 6)
    expect(stats.list.find((entry) => entry.name === 'vETH')?.daiPrice).toBeCloseTo(1000, 6)
  })
})
