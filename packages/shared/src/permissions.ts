export type PanelRole = 'ADMIN' | 'DIRECTION' | 'RESPONSABLE' | 'MODERATEUR' | 'MEMBRE'

export type Permission =
  | '*'
  | 'members.view'
  | 'members.edit'
  | 'members.grade.assign'
  | 'presences.view'
  | 'presences.validate'
  | 'absences.view'
  | 'absences.approve'
  | 'warnings.view'
  | 'warnings.issue'
  | 'warnings.revoke'
  | 'contributions.view'
  | 'contributions.add'
  | 'contributions.delete'
  | 'accounting.view'
  | 'accounting.edit'
  | 'accounting.export'
  | 'vda.view'
  | 'vda.edit'
  | 'vda.archive'
  | 'settings.view'
  | 'settings.edit'
  | 'settings.discord'
  | 'superadmin'

export const ROLE_PERMISSIONS: Record<PanelRole, Permission[]> = {
  ADMIN: ['*'],
  DIRECTION: [
    'members.view', 'members.edit', 'members.grade.assign',
    'presences.view', 'presences.validate',
    'absences.view', 'absences.approve',
    'warnings.view', 'warnings.issue', 'warnings.revoke',
    'contributions.view', 'contributions.add', 'contributions.delete',
    'accounting.view', 'accounting.edit', 'accounting.export',
    'vda.view', 'vda.edit', 'vda.archive',
    'settings.view', 'settings.edit', 'settings.discord',
  ],
  RESPONSABLE: [
    'members.view',
    'presences.view', 'presences.validate',
    'absences.view', 'absences.approve',
    'warnings.view', 'warnings.issue',
    'contributions.view', 'contributions.add',
    'accounting.view',
    'vda.view', 'vda.edit',
  ],
  MODERATEUR: [
    'members.view',
    'presences.view',
    'absences.view',
    'warnings.view', 'warnings.issue',
    'contributions.view',
    'vda.view',
  ],
  MEMBRE: [],
}

export function hasPermission(role: PanelRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role]
  return perms.includes('*') || perms.includes(permission)
}
