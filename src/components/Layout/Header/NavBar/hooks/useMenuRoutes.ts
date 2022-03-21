import { useCallback } from 'react'
import { useHistory } from 'react-router-dom'

export enum WalletConnectedRoutes {
  Connected = '/connected',
  KeepKey = '/connected/keepkey',
  KeepKeyPin = '/connected/keepkey/pin',
  KeepKeyLabel = '/connected/keepkey/label'
}

export const useMenuRoutes = () => {
  const history = useHistory()
  const handleBackClick = useCallback(() => history.goBack(), [history])
  const handleKeepKeyClick = useCallback(
    () => history.push(WalletConnectedRoutes.KeepKey),
    [history]
  )
  const handleChangePinClick = useCallback(
    () => history.push(WalletConnectedRoutes.KeepKeyPin),
    [history]
  )

  const handleChangeLabelClick = useCallback(
    () => history.push(WalletConnectedRoutes.KeepKeyLabel),
    [history]
  )

  return { handleKeepKeyClick, handleBackClick, handleChangePinClick, handleChangeLabelClick }
}