# AWS

## Configure the AWS CLI

https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html

### Default Configuration

```
$ aws configure
AWS Access Key ID [None]: [Put your AWS Access Key ID here]
AWS Secret Access Key [None]: [Put your AWS Secret Access Key here]
Default region name [None]: us-east-1
Default output format [None]: json
```

### Named Configuration

https://docs.aws.amazon.com/cli/latest/userguide/cli-multiple-profiles.html
Allows configurations to be toggled for different accounts

```
$ aws configure --profile ev-dev
```

To set the named configuration:

```
Mac/Linux:
$ export AWS_PROFILE=ev-dev

Windows:
> set AWS_PROFILE=ev-dev
```

## Architecture

![architecture](https://github.com/mailejoe/mailejoe-api/blob/master/image.jpg?raw=true)
