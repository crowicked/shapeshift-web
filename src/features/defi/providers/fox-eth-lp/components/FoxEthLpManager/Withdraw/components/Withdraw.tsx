import { ethAssetId } from '@shapeshiftoss/caip'
import {
  Field,
  Withdraw as ReusableWithdraw,
  WithdrawValues,
} from 'features/defi/components/Withdraw/Withdraw'
import {
  DefiParams,
  DefiQueryParams,
  DefiStep,
} from 'features/defi/contexts/DefiManagerProvider/DefiCommon'
import { foxAssetId } from 'features/defi/providers/fox-eth-lp/constants'
import { useFoxEthLiquidityPool } from 'features/defi/providers/fox-eth-lp/hooks/useFoxEthLiquidityPool'
import { useContext, useState } from 'react'
import { FormProvider, useForm } from 'react-hook-form'
import { AssetInput } from 'components/DeFi/components/AssetInput'
import { StepComponentProps } from 'components/DeFi/components/Steps'
import { Text } from 'components/Text'
import { useBrowserRouter } from 'hooks/useBrowserRouter/useBrowserRouter'
import { bn, bnOrZero } from 'lib/bignumber/bignumber'
import { logger } from 'lib/logger'
import {
  selectAssetById,
  selectFoxEthLpOpportunity,
  selectMarketDataById,
  selectPortfolioCryptoBalanceByAssetId,
} from 'state/slices/selectors'
import { useAppSelector } from 'state/store'

import { FoxEthLpWithdrawActionType } from '../WithdrawCommon'
import { WithdrawContext } from '../WithdrawContext'
const moduleLogger = logger.child({ namespace: ['Withdraw'] })

export const Withdraw: React.FC<StepComponentProps> = ({ onNext }) => {
  const { state, dispatch } = useContext(WithdrawContext)
  const { history: browserHistory } = useBrowserRouter<DefiQueryParams, DefiParams>()
  const opportunity = useAppSelector(selectFoxEthLpOpportunity)
  const { underlyingFoxAmount, underlyingEthAmount } = opportunity

  const { allowance, getApproveGasData, getWithdrawGasData } = useFoxEthLiquidityPool()
  const [foxAmount, setFoxAmount] = useState('0')
  const [ethAmount, setEthAmount] = useState('0')

  const methods = useForm<WithdrawValues>({ mode: 'onChange' })
  const { setValue } = methods

  const asset = useAppSelector(state => selectAssetById(state, opportunity.assetId))
  const assetMarketData = useAppSelector(state => selectMarketDataById(state, asset.assetId))
  const foxAsset = useAppSelector(state => selectAssetById(state, foxAssetId))
  const foxMarketData = useAppSelector(state => selectMarketDataById(state, foxAssetId))
  const ethAsset = useAppSelector(state => selectAssetById(state, ethAssetId))
  const ethMarketData = useAppSelector(state => selectMarketDataById(state, ethAssetId))

  const totalFiatBalance = bnOrZero(opportunity.underlyingFoxAmount)
    .times(foxMarketData.price)
    .plus(bnOrZero(opportunity.underlyingEthAmount).times(ethMarketData.price))
    .toFixed(2)

  // user info
  const balance = useAppSelector(state =>
    selectPortfolioCryptoBalanceByAssetId(state, { assetId: opportunity.assetId }),
  )
  const cryptoAmountAvailable = bnOrZero(balance).div(bn(10).pow(asset?.precision))

  if (!state || !dispatch) return null

  const getWithdrawGasEstimate = async (withdraw: WithdrawValues) => {
    try {
      const fee = await getWithdrawGasData(withdraw.cryptoAmount, foxAmount, ethAmount)
      if (!fee) return
      return bnOrZero(fee.average.txFee).div(bn(10).pow(ethAsset.precision)).toPrecision()
    } catch (error) {
      // TODO: handle client side errors maybe add a toast?
      moduleLogger.error(error, 'FoxEthLpWithdraw:getWithdrawGasEstimate error:')
    }
  }

  const handleContinue = async (formValues: WithdrawValues) => {
    if (!opportunity) return
    // set withdraw state for future use
    dispatch({ type: FoxEthLpWithdrawActionType.SET_LOADING, payload: true })
    dispatch({
      type: FoxEthLpWithdrawActionType.SET_WITHDRAW,
      payload: { lpAmount: formValues.cryptoAmount, foxAmount, ethAmount },
    })
    const lpAllowance = await allowance(true)
    const allowanceAmount = bnOrZero(lpAllowance).div(`1e+${asset.precision}`)

    // Skip approval step if user allowance is greater than or equal requested deposit amount
    if (allowanceAmount.gte(bnOrZero(formValues.cryptoAmount))) {
      const estimatedGasCrypto = await getWithdrawGasEstimate(formValues)
      if (!estimatedGasCrypto) {
        dispatch({ type: FoxEthLpWithdrawActionType.SET_LOADING, payload: false })
        return
      }
      dispatch({
        type: FoxEthLpWithdrawActionType.SET_WITHDRAW,
        payload: { estimatedGasCrypto },
      })
      onNext(DefiStep.Confirm)
      dispatch({ type: FoxEthLpWithdrawActionType.SET_LOADING, payload: false })
    } else {
      const estimatedGasCrypto = await getApproveGasData(true)
      if (!estimatedGasCrypto) return
      dispatch({
        type: FoxEthLpWithdrawActionType.SET_APPROVE,
        payload: {
          estimatedGasCrypto: bnOrZero(estimatedGasCrypto.average.txFee)
            .div(bn(10).pow(ethAsset.precision))
            .toPrecision(),
        },
      })
      onNext(DefiStep.Approve)
      dispatch({ type: FoxEthLpWithdrawActionType.SET_LOADING, payload: false })
    }
  }

  const handleCancel = () => {
    browserHistory.goBack()
  }

  const handlePercentClick = (percent: number) => {
    const cryptoAmount = bnOrZero(cryptoAmountAvailable).times(percent)
    const fiatAmount = bnOrZero(totalFiatBalance).times(percent).toFixed(2)
    setValue(Field.FiatAmount, fiatAmount.toString(), { shouldValidate: true })
    setValue(Field.CryptoAmount, cryptoAmount.toString(), { shouldValidate: true })
    if (underlyingFoxAmount && underlyingEthAmount) {
      setFoxAmount(bnOrZero(percent).times(underlyingFoxAmount).toFixed(8))
      setEthAmount(bnOrZero(percent).times(underlyingEthAmount).toFixed(8))
    }
  }

  const handleInputChange = (value: string, isFiat?: boolean) => {
    const percentage = bnOrZero(value).div(
      bnOrZero(isFiat ? totalFiatBalance : cryptoAmountAvailable),
    )
    if (underlyingFoxAmount && underlyingEthAmount) {
      setFoxAmount(percentage.times(underlyingFoxAmount).toFixed(8))
      setEthAmount(percentage.times(underlyingEthAmount).toFixed(8))
    }
  }

  const validateCryptoAmount = (value: string) => {
    const crypto = bnOrZero(balance).div(`1e+${asset.precision}`)
    const _value = bnOrZero(value)
    const hasValidBalance = crypto.gt(0) && _value.gt(0) && crypto.gte(value)
    if (_value.isEqualTo(0)) return ''
    return hasValidBalance || 'common.insufficientFunds'
  }

  const validateFiatAmount = (value: string) => {
    const _value = bnOrZero(value)
    const fiat = bnOrZero(totalFiatBalance)
    const hasValidBalance = fiat.gt(0) && _value.gt(0) && fiat.gte(value)
    if (_value.isEqualTo(0)) return ''
    return hasValidBalance || 'common.insufficientFunds'
  }

  return (
    <FormProvider {...methods}>
      <ReusableWithdraw
        asset={asset}
        icons={opportunity.icons}
        cryptoAmountAvailable={cryptoAmountAvailable.toPrecision()}
        cryptoInputValidation={{
          required: true,
          validate: { validateCryptoAmount },
        }}
        fiatAmountAvailable={totalFiatBalance}
        fiatInputValidation={{
          required: true,
          validate: { validateFiatAmount },
        }}
        marketData={assetMarketData}
        onCancel={handleCancel}
        onContinue={handleContinue}
        isLoading={state.loading || !opportunity.isLoaded}
        percentOptions={[0.25, 0.5, 0.75, 1]}
        enableSlippage={false}
        handlePercentClick={handlePercentClick}
        onInputChange={handleInputChange}
      >
        <>
          <Text translation='common.receive' />
          <AssetInput
            cryptoAmount={foxAmount}
            fiatAmount={bnOrZero(foxAmount).times(foxMarketData.price).toFixed(2)}
            showFiatAmount={true}
            assetIcon={foxAsset.icon}
            assetSymbol={foxAsset.symbol}
            balance={underlyingFoxAmount ?? undefined}
            fiatBalance={bnOrZero(underlyingFoxAmount).times(foxMarketData.price).toFixed(2)}
            percentOptions={[]}
            isReadOnly={true}
          />
          <AssetInput
            cryptoAmount={ethAmount}
            fiatAmount={bnOrZero(ethAmount).times(ethMarketData.price).toFixed(2)}
            showFiatAmount={true}
            assetIcon={ethAsset.icon}
            assetSymbol={ethAsset.symbol}
            balance={underlyingEthAmount ?? undefined}
            fiatBalance={bnOrZero(underlyingEthAmount).times(ethMarketData.price).toFixed(2)}
            percentOptions={[]}
            isReadOnly={true}
          />
        </>
      </ReusableWithdraw>
    </FormProvider>
  )
}
