import { ArrowForwardIcon } from '@chakra-ui/icons'
import { Box, Button, HStack } from '@chakra-ui/react'
import { AssetId, ethAssetId, foxAssetId, fromAccountId, fromAssetId } from '@shapeshiftoss/caip'
import { Card } from 'components/Card/Card'
import { Text } from 'components/Text'
import { useFoxEth } from 'context/FoxEthProvider/FoxEthProvider'
import { WalletActions } from 'context/WalletProvider/actions'
import type { EarnOpportunityType } from 'features/defi/helpers/normalizeOpportunity'
import { useNormalizeOpportunities } from 'features/defi/helpers/normalizeOpportunity'
import { foxEthLpAssetId } from 'features/defi/providers/fox-eth-lp/constants'
import { useWallet } from 'hooks/useWallet/useWallet'
import { useFoxyBalances } from 'pages/Defi/hooks/useFoxyBalances'
import { useVaultBalances } from 'pages/Defi/hooks/useVaultBalances'
import qs from 'qs'
import { useEffect, useMemo } from 'react'
import { NavLink, useHistory, useLocation } from 'react-router-dom'
import type { AccountSpecifier } from 'state/slices/portfolioSlice/portfolioSliceCommon'
import {
    selectAssetById,
    selectFoxEthLpOpportunityByAccountAddress,
    selectVisibleFoxFarmingOpportunities
} from 'state/slices/selectors'
import { useAppSelector } from 'state/store'

import { StakingTable } from './StakingTable'

type EarnOpportunitiesProps = {
  tokenId?: string
  assetId: AssetId
  accountId?: AccountSpecifier
  isLoaded?: boolean
}

export const EarnOpportunities = ({ assetId, accountId }: EarnOpportunitiesProps) => {
  const history = useHistory()
  const location = useLocation()
  const {
    state: { isConnected },
    dispatch,
  } = useWallet()
  const asset = useAppSelector(state => selectAssetById(state, assetId))
  const { vaults } = useVaultBalances()
  const { data: foxyBalancesData } = useFoxyBalances({ accountNumber: 0 })

  const accountAddress = useMemo(
    () => (accountId ? fromAccountId(accountId).account : null),
    [accountId],
  )

  const visibleFoxFarmingOpportunities = useAppSelector(state =>
    selectVisibleFoxFarmingOpportunities(state, { accountAddress: accountAddress ?? '' }),
  )
  const foxEthLpOpportunity = useAppSelector(state =>
    selectFoxEthLpOpportunityByAccountAddress(state, { accountAddress: accountAddress ?? '' }),
  )

  const { setAccountId } = useFoxEth()

  useEffect(() => {
    if (accountId) setAccountId(accountId)
  }, [setAccountId, accountId])

  const allRows = useNormalizeOpportunities({
    vaultArray: Object.values(vaults),
    foxyArray: foxyBalancesData?.opportunities ?? [],
    cosmosSdkStakingOpportunities: [],
    foxEthLpOpportunity,
    foxFarmingOpportunities: visibleFoxFarmingOpportunities,
  }).filter(
    row =>
      row.assetId.toLowerCase() === asset.assetId.toLowerCase() ||
      // show FOX_ETH LP token on FOX and ETH pages
      (row.assetId === foxEthLpAssetId && [ethAssetId, foxAssetId].includes(asset.assetId)),
  )

  const handleClick = (opportunity: EarnOpportunityType) => {
    const { provider, contractAddress, chainId, assetId, rewardAddress } = opportunity
    const { assetReference } = fromAssetId(assetId)
    if (!isConnected) {
      dispatch({ type: WalletActions.SET_WALLET_MODAL, payload: true })
      return
    }

    history.push({
      pathname: location.pathname,
      search: qs.stringify({
        chainId,
        contractAddress,
        assetReference,
        rewardId: rewardAddress,
        provider,
        modal: 'overview',
      }),
      state: { background: location },
    })
  }

  if (allRows.length === 0) return null

  return (
    <Card>
      <Card.Header flexDir='row' display='flex'>
        <HStack gap={6} width='full'>
          <Box>
            <Card.Heading>
              <Text translation='defi.earn' />
            </Card.Heading>
            <Text color='gray.500' translation='defi.earnBody' />
          </Box>
          <Box flex={1} textAlign='right'>
            <Button
              size='sm'
              variant='link'
              colorScheme='blue'
              ml='auto'
              as={NavLink}
              to='/defi/earn'
            >
              <Text translation='common.seeAll' /> <ArrowForwardIcon />
            </Button>
          </Box>
        </HStack>
      </Card.Header>
      {Boolean(allRows?.length) && (
        <Card.Body pt={0} px={2}>
          <StakingTable data={allRows} onClick={handleClick} />
        </Card.Body>
      )}
    </Card>
  )
}
