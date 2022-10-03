import { cosmosAssetId, osmosisAssetId } from '@shapeshiftoss/caip'
import type { EarnOpportunityType } from 'features/defi/helpers/normalizeOpportunity'
import { useNormalizeOpportunities } from 'features/defi/helpers/normalizeOpportunity'
import { useMemo } from 'react'
import { bnOrZero } from 'lib/bignumber/bignumber'
import { useCosmosSdkStakingBalances } from 'pages/Defi/hooks/useCosmosSdkStakingBalances'
import {
  selectFarmContractsFiatBalance,
  selectFeatureFlags,
  selectFoxEthLpFiatBalance,
  selectFoxEthLpOpportunityByAccountAddress,
  selectVisibleFoxFarmingOpportunities,
} from 'state/slices/selectors'
import { useAppSelector } from 'state/store'

import { useFoxyBalances } from './useFoxyBalances'
import type { MergedEarnVault } from './useVaultBalances'
import { useVaultBalances } from './useVaultBalances'

export type UseEarnBalancesReturn = {
  opportunities: EarnOpportunityType[]
  totalEarningBalance: string
  loading: boolean
}

export type SerializableOpportunity = MergedEarnVault

export function useEarnBalances(): UseEarnBalancesReturn {
  const accountAddress = '' // TODO
  const { isLoading: isFoxyBalancesLoading, data: foxyBalancesData } = useFoxyBalances({
    accountNumber: 0,
  })
  const { vaults, totalBalance: vaultsTotalBalance, loading: vaultsLoading } = useVaultBalances()
  const vaultArray: SerializableOpportunity[] = useMemo(() => Object.values(vaults), [vaults])
  const { cosmosSdkStakingOpportunities, totalBalance: totalCosmosStakingBalance } =
    useCosmosSdkStakingBalances({
      assetId: cosmosAssetId,
    })
  const {
    cosmosSdkStakingOpportunities: osmosisStakingOpportunities,
    totalBalance: totalOsmosisStakingBalance,
  } = useCosmosSdkStakingBalances({
    assetId: osmosisAssetId,
  })
  const visibleFoxFarmingOpportunities = useAppSelector(state =>
    selectVisibleFoxFarmingOpportunities(state, { accountAddress: accountAddress ?? '' }),
  )
  const foxEthLpOpportunity = useAppSelector(state =>
    selectFoxEthLpOpportunityByAccountAddress(state, {
      accountAddress: accountAddress ?? '',
    }),
  )
  const farmContractsFiatBalance = useAppSelector(state =>
    selectFarmContractsFiatBalance(state, { accountAddress: accountAddress ?? '' }),
  )
  const foxEthLpFiatBalance = useAppSelector(state =>
    selectFoxEthLpFiatBalance(state, { accountAddress: accountAddress ?? '' }),
  )
  const featureFlags = useAppSelector(selectFeatureFlags)

  const opportunities = useNormalizeOpportunities({
    vaultArray,
    foxyArray: foxyBalancesData?.opportunities || [],
    cosmosSdkStakingOpportunities: cosmosSdkStakingOpportunities.concat(
      osmosisStakingOpportunities,
    ),
    foxEthLpOpportunity: featureFlags.FoxLP ? foxEthLpOpportunity : undefined,
    foxFarmingOpportunities: featureFlags.FoxFarming ? visibleFoxFarmingOpportunities : undefined,
  })
  // When staking, farming, lp, etc are added sum up the balances here
  const totalEarningBalance = bnOrZero(vaultsTotalBalance)
    .plus(foxyBalancesData?.totalBalance ?? '0')
    .plus(totalCosmosStakingBalance)
    .plus(totalOsmosisStakingBalance)
    .plus(farmContractsFiatBalance)
    .plus(foxEthLpFiatBalance)
    .toString()

  return {
    opportunities,
    totalEarningBalance,
    loading: vaultsLoading || isFoxyBalancesLoading,
  }
}
