interface IPermission {
  name: string;
  translation: string;
}

export const permissions: Array<IPermission> = [
  { name: 'VIEW_USER', translation: 'permissions.viewUser' },
  { name: 'ADD_USER', translation: 'permissions.addUser' },
  { name: 'UPDATE_USER', translation: 'permissions.updateUser' },
  { name: 'DELETE_USER', translation: 'permissions.deleteUser' },
  { name: 'VIEW_ROLE', translation: 'permissions.viewRole' },
  { name: 'ADD_ROLE', translation: 'permissions.addRole' },
  { name: 'UPDATE_ROLE', translation: 'permissions.updateRole' },
  { name: 'DELETE_ROLE', translation: 'permissions.deleteRole' },
  { name: 'VIEW_SESSION', translation: 'permissions.viewSession' },
  { name: 'UPDATE_SESSION', translation: 'permissions.updateSession' },
  { name: 'VIEW_AUDIT_LOG', translation: 'permissions.viewAuditLog' },
  { name: 'VIEW_USER_ACCESS_HISTORY', translation: 'permissions.viewUserAccessHistory' },
  { name: 'VIEW_MAILBOX', translation: 'permissions.viewMailbox' },
  { name: 'ADD_MAILBOX', translation: 'permissions.addMailbox' },
  { name: 'UPDATE_MAILBOX', translation: 'permissions.updateMailbox' },
  { name: 'DELETE_MAILBOX', translation: 'permissions.deleteMailbox' },
  { name: 'VIEW_EMAIL', translation: 'permissions.viewEmail' },
];
