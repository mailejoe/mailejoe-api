# Migrations

## Running Locally

Edit the config/dev/ormconfig.json file as needed, in most cases it can be left as is.

Run the following command to execute the migrations:

```
npm run migration:run
```

Run the following command to revert all or some migrations:

```
npm run migration:revert
```

Run the following command to execute the seeds:

```
npm run
```

## Testing Production

Production migrations are executed during the deployment process.
They use environment variables setup in the CI/CD project and the
migrations script.

### Creating a Migration

New migrations can be created by running the following command:

```
npm run migration:create MIGRATION_NAME
```

Where MIGRATION_NAME is the name of the migration. Please use the following syntax when creating migrations. Only use hyphens and lowercase letters in names.

- New tables should be: 'create-<tablename>'
- Table modifications should be: 'update-<tablename>'
- Only applying index creations/modifications should be: 'index-<tablename>'
- Only adding data should be: 'add-<tablename>'

### Creating a Seed
