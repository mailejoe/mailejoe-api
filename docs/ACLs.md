# ACLs and Mailejoe Permissioning System

## Entities

- User
  - Permissions: View, Add, Update, Remove
- Group
  - Permissions: View, Add, Update, Remove, AddToGroup, RemoveFromGroup
- Email Address
  - Permissions: View, Add, Remove, AddToGroup, RemoveFromGroup
- API Tokens
  - Permissions: View, Add, Remove

## Roles

A role is a set of ACLs that can be assigned to a user account. Each user
account must have one and only one role assigned to it.

## API Tokens

An account may generate API tokens which assume the role of the account itself. An account
may have no more than 2 API tokens generated and optionally can set an expiration on them.
