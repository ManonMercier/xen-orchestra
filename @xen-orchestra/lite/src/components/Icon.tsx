import PropTypes from 'prop-types'
import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { IconName as _IconName, library, SizeProp } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'

library.add(fas)

const Icon = ({ icon, size }: { icon: _IconName, size?: SizeProp }): JSX.Element => (
  <FontAwesomeIcon icon={icon} size={size} />
)

Icon.propTypes = {
  icon: PropTypes.string.isRequired
}

export default Icon
export type IconName = _IconName