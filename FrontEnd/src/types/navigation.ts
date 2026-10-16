import React from 'react'
import type { UserRole } from './auth'

export interface NavItemType {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[]
  badge?: string | number
}
