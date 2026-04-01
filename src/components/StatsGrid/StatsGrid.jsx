import React from 'react'

import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import useSWR from 'swr'
import { VerusdRpcInterface } from 'verusd-rpc-ts-client'

import { GLOBAL_IADDRESS } from 'constants/contractAddress'

const verusd = new VerusdRpcInterface(GLOBAL_IADDRESS.VRSC, process.env.REACT_APP_VERUS_RPC_URL)
const blockNumber = process.env.REACT_APP_VERUS_END_BLOCK || '0'

const getCurrencyState = (currencyResult) => (
  currencyResult?.result?.bestcurrencystate
  || currencyResult?.result?.lastconfirmedcurrencystate
  || null
)

const getReserveEntries = (currencyResult) => {
  const state = getCurrencyState(currencyResult)
  const currencyNames = currencyResult?.result?.currencynames || {}
  const reserves = Array.isArray(state?.reservecurrencies) ? state.reservecurrencies : []

  return reserves.map((entry) => ({
    ...entry,
    name: currencyNames[entry.currencyid] || entry.currencyid
  }))
}

const calculateBridgeDaiPrice = (currencyResult) => {
  const state = getCurrencyState(currencyResult)
  const reserveEntries = getReserveEntries(currencyResult)
  const daiReserve = reserveEntries.find((entry) => entry.name === 'DAI.vETH')
  const supply = Number(state?.supply)
  const daiReserves = Number(daiReserve?.reserves)
  const daiWeight = Number(daiReserve?.weight)

  if (!Number.isFinite(supply) || !Number.isFinite(daiReserves) || !Number.isFinite(daiWeight) || supply <= 0 || daiWeight <= 0) {
    return 0
  }

  return daiReserves / daiWeight / supply
}

const calculateReserveDaiPrice = (reserveEntry, daiReserve) => {
  const reservePrice = Number(reserveEntry?.priceinreserve)
  const daiPrice = Number(daiReserve?.priceinreserve)

  if (!Number.isFinite(reservePrice) || !Number.isFinite(daiPrice) || reservePrice <= 0) {
    return 0
  }

  return daiPrice / reservePrice
}

export const fetchBridgeStats = async () => {
  const [currencyResult, infoResult] = await Promise.all([
    verusd.getCurrency('bridge.veth'),
    verusd.getInfo()
  ])

  const state = getCurrencyState(currencyResult)
  const reserveEntries = getReserveEntries(currencyResult)
  const daiReserve = reserveEntries.find((entry) => entry.name === 'DAI.vETH')
  const block = Number(infoResult?.result?.longestchain)
  const configuredEndBlock = Number(blockNumber)

  return {
    blockdiff: Number.isFinite(block) && Number.isFinite(configuredEndBlock) ? configuredEndBlock - block : 0,
    bridge: {
      amount: Number(state?.supply) || 0,
      daiPrice: calculateBridgeDaiPrice(currencyResult),
      name: 'Bridge.vETH'
    },
    currencies: reserveEntries,
    list: reserveEntries.map((entry) => ({
      amount: Number(entry?.reserves) || 0,
      daiPrice: calculateReserveDaiPrice(entry, daiReserve),
      name: entry.name
    }))
  }
}

const StatsGrid = () => {
  const { data: conversionList } = useSWR('fetchBridgeStats', fetchBridgeStats, {
    refreshInterval: 60_000
  })

  if (!conversionList) return null

  return (
    <>
      <Grid container className="blueRowTitle" >
        <Grid item xs={4}><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>Liquidity pool</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>Supply</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>Price in DAI</Typography></Grid>
      </Grid>

      <Grid container className='blueRow' mb={5}>
        <Grid item xs={4}><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>{conversionList.bridge.name}</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}> {Intl.NumberFormat('en-US', {
          style: 'decimal',
          maximumFractionDigits: 0
        }).format(conversionList.bridge.amount)}</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>{Intl.NumberFormat('en-US', {
          style: 'decimal',
          maximumFractionDigits: 3,
          minimumFractionDigits: 3
        }).format(conversionList.bridge.daiPrice)}</Typography></Grid>
      </Grid>

      <Grid container className="blueRowTitle" >
        <Grid item xs={4}><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>Bridge.vETH reserve currencies</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>In reserves</Typography></Grid>
        <Grid item xs={4} textAlign="right"><Typography sx={{ fontSize: '12px', fontWeight: 'bold' }}>Price in DAI</Typography></Grid>
      </Grid>
      {conversionList.list && conversionList.list.map((token) => (
        <Grid container className="blueRow" key={token.name}>
          <Grid item xs={4}><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>{token.name}</Typography></Grid>
          <Grid item xs={4} textAlign="right">
            <Typography sx={{ color: 'rgba(49, 101, 212, 0.59)', fontWeight: 'bold' }}>
              {Intl.NumberFormat('en-US', {
                style: 'decimal',
                maximumFractionDigits: 3,
                minimumFractionDigits: 3
              }).format(token.amount)}
            </Typography>
          </Grid>
          <Grid item xs={4} textAlign="right">
            <Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>
              {Intl.NumberFormat('en-US', {
                style: 'decimal',
                maximumFractionDigits: 2,
                minimumFractionDigits: 2
              }).format(token.daiPrice)}
            </Typography>
          </Grid>
        </Grid >
      ))}
      <Grid container className='white' mb={5}> </Grid>
      <Grid container className='blueRow' mb={5}>
        <Grid item xs={6}><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>Total Value of Liquidity</Typography></Grid>
        <Grid item xs={6} textAlign="right"><Typography sx={{ color: '#3165d4', fontWeight: 'bold' }}>{Intl.NumberFormat('en-US', {
          style: 'decimal',
          maximumFractionDigits: 3,
          minimumFractionDigits: 3
        }).format(conversionList.bridge.daiPrice * conversionList.bridge.amount)} DAI</Typography></Grid>
      </Grid>
    </>
  )
}

export default StatsGrid
