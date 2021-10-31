# Deployments

All deployments are done via CircleCI integration.

The configuration setup for CircleCI sends all commits to `master` to be deployed into the AWS environment.

The docker container used in the build steps can be built and deployed using the following commands:

```
cd .circleci
aws ecr get-login-password --region us-east-1
docker login -u AWS -p <encrypted-password> <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/mailejoe/mailejoe-api
docker build -t mailejoe/mailejoe-api .
docker tag <image_id> <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/mailejoe/mailejoe-api:<tag>
docker push <aws_account_id>.dkr.ecr.us-east-1.amazonaws.com/mailejoe/mailejoe-api:<tag>
```

The following environment variables need to be setup in CircleCI for the infrastructure project.

- REGION
  Region in the dev account the deployment is taking place in.
- AWS_ACCESS_KEY_ID=\*\*\*
  The AWS Access Key ID for the dev account, requires super user privileges.
- AWS_SECRET_ACCESS_KEY
  The AWS Secret Access Key for the dev account that pairs with the access key id provided.

NOTE: For security purposes the Access Keys/Secrets above should be manually rotated on a 30 day
interval by an administrator.

## Lambda Layers

Note that during deployments the package-lock.json file is compared against the previous lock file
that was deployed, if found different a new docker layer with the node_modules
will be created and associated with the function for that stage.

Because of this is very important to keep dev dependencies out of the core dependencies
section of the package.json file. Also make sure to always checkin the package-lock.json
file on every commit.
