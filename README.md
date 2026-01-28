# AWS Elastic Beanstalk Deploy Action

A GitHub Action for deploying applications to AWS Elastic Beanstalk with automatic version management, environment creation, health monitoring, and intelligent retry logic.

## Table of Contents

- [Usage](#usage)
  - [Basic Deployment](#basic-deployment)
  - [Deploy with Custom Configuration](#deploy-with-custom-configuration)
  - [Deploy Pre-built Package](#deploy-pre-built-package)
  - [Multi-Environment Deployment](#multi-environment-deployment)
  - [Reuse Existing Versions](#reuse-existing-versions)
- [Inputs](#inputs)
  - [Required Inputs](#required-inputs)
  - [Optional Inputs](#optional-inputs)
- [Outputs](#outputs)
- [Credentials and Region](#credentials-and-region)
- [Permissions](#permissions)
- [Advanced Configuration](#advanced-configuration)
  - [Option Settings](#option-settings)
  - [Exclude Patterns](#exclude-patterns)
  - [Deployment Strategies](#deployment-strategies)
- [Examples](#examples)
- [Example Output](#example-output)
  - [Successful Deployment (Happy Path)](#successful-deployment-happy-path)
  - [Failed Deployment (Unhappy Path)](#failed-deployment-unhappy-path)
- [Finding Solution Stack Names](#finding-solution-stack-names)
- [Troubleshooting](#troubleshooting)
- [License](#license)

## Usage

### Basic Deployment

Deploy your application to Elastic Beanstalk with minimal configuration:

```yaml
name: Deploy to Elastic Beanstalk

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1

      - name: Deploy to Elastic Beanstalk
        uses: aws-actions/aws-elasticbeanstalk-deploy@v1
        with:
          aws-region: us-east-1
          application-name: my-app
          environment-name: my-app-prod
          solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
          option-settings: |
            [
              {
                "Namespace": "aws:autoscaling:launchconfiguration",
                "OptionName": "IamInstanceProfile",
                "Value": "aws-elasticbeanstalk-ec2-role"
              },
              {
                "Namespace": "aws:elasticbeanstalk:environment",
                "OptionName": "ServiceRole",
                "Value": "aws-elasticbeanstalk-service-role"
              }
            ]
```

### Deploy with Custom Configuration

Configure Elastic Beanstalk option settings for your deployment:

```yaml
- name: Deploy with Custom Settings
  uses: aws-actions/aws-elasticbeanstalk-deploy@v1
  with:
    aws-region: us-east-1
    application-name: my-app
    environment-name: my-app-prod
    solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
    create-application-if-not-exists: true
    option-settings: |
      [
        {
          "Namespace": "aws:autoscaling:launchconfiguration",
          "OptionName": "IamInstanceProfile",
          "Value": "aws-elasticbeanstalk-ec2-role"
        },
        {
          "Namespace": "aws:elasticbeanstalk:environment",
          "OptionName": "ServiceRole",
          "Value": "aws-elasticbeanstalk-service-role"
        },
        {
          "Namespace": "aws:ec2:instances",
          "OptionName": "InstanceTypes",
          "Value": "t3.medium"
        },
        {
          "Namespace": "aws:autoscaling:asg",
          "OptionName": "MinSize",
          "Value": "2"
        },
        {
          "Namespace": "aws:autoscaling:asg",
          "OptionName": "MaxSize",
          "Value": "4"
        },
        {
          "Namespace": "aws:elasticbeanstalk:cloudwatch:logs",
          "OptionName": "StreamLogs",
          "Value": "true"
        }
      ]
```

### Deploy Pre-built Package

Deploy a pre-built deployment package (useful for compiled applications):

```yaml
- name: Build Java Application
  run: mvn clean package

- name: Deploy to Elastic Beanstalk
  uses: aws-actions/aws-elasticbeanstalk-deploy@v1
  with:
    aws-region: us-east-1
    application-name: my-java-app
    environment-name: my-java-app-prod
    solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Corretto 21'
    deployment-package-path: target/my-app.zip
    option-settings: |
      [
        {
          "Namespace": "aws:autoscaling:launchconfiguration",
          "OptionName": "IamInstanceProfile",
          "Value": "aws-elasticbeanstalk-ec2-role"
        },
        {
          "Namespace": "aws:elasticbeanstalk:environment",
          "OptionName": "ServiceRole",
          "Value": "aws-elasticbeanstalk-service-role"
        }
      ]
```

### Reuse Existing Versions

Skip S3 upload and version creation if the version already exists:

```yaml
- name: Deploy Existing Version
  uses: aws-actions/aws-elasticbeanstalk-deploy@v1
  with:
    aws-region: us-east-1
    application-name: my-app
    environment-name: my-app-prod
    solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
    version-label: v1.2.3
    use-existing-application-version-if-available: true  # Default is true
    option-settings: |
      [
        {
          "Namespace": "aws:autoscaling:launchconfiguration",
          "OptionName": "IamInstanceProfile",
          "Value": "aws-elasticbeanstalk-ec2-role"
        },
        {
          "Namespace": "aws:elasticbeanstalk:environment",
          "OptionName": "ServiceRole",
          "Value": "aws-elasticbeanstalk-service-role"
        }
      ]
```

## Inputs

### Required Inputs

| Name | Description | Example |
|------|-------------|---------|
| `aws-region` | AWS region where your Elastic Beanstalk application is deployed | `us-east-1` |
| `application-name` | Name of your Elastic Beanstalk application (1-100 characters) | `my-app` |
| `environment-name` | Name of your Elastic Beanstalk environment (4-40 characters, alphanumeric and hyphens only) | `my-app-prod` |
| `solution-stack-name` | Platform version to use for the environment | `64bit Amazon Linux 2023 v4.3.0 running Python 3.11` |
| `option-settings` | JSON array of Elastic Beanstalk option settings to apply during deployment or environment creation. Must include IAM Instance Profile and Service Role settings | See examples above |

### Optional Inputs

| Name | Description | Default |
|------|-------------|---------|
| `version-label` | Version label for the application version. Must be unique within the application (1-100 characters) | Git SHA or `v{timestamp}` |
| `deployment-package-path` | Path to a pre-built deployment package (`.zip`, `.war`, `.jar`). If not provided, a package will be auto-created from the repository | Auto-created |
| `create-environment-if-not-exists` | Create the environment if it doesn't exist | `true` |
| `create-application-if-not-exists` | Create the application if it doesn't exist. **Note:** If `true`, ensure `create-environment-if-not-exists` is also `true` | `true` |
| `wait-for-deployment` | Wait for the deployment to complete before finishing the action | `true` |
| `wait-for-environment-recovery` | Wait for environment health to become Green or Yellow. | `true` |
| `deployment-timeout` | Maximum time to wait for deployment completion (in seconds, 60-3600) | `900` (15 minutes) |
| `max-retries` | Maximum number of retry attempts for failed API calls (0-10) | `3` |
| `retry-delay` | Initial delay between retries in seconds (1-60). Uses exponential backoff | `5` |
| `use-existing-application-version-if-available` | Reuse existing application version if it exists (skips S3 upload and version creation) | `true` |
| `create-s3-bucket-if-not-exists` | Automatically create the S3 bucket if it doesn't exist. Bucket name: `elasticbeanstalk-{region}-{account-id}` | `true` |
| `exclude-patterns` | Comma-separated list of glob patterns to exclude from the deployment package (only used when auto-creating packages) | None (all files included) |


## Outputs

| Name | Description |
|------|-------------|
| `environment-url` | The CNAME/URL of the deployed environment |
| `environment-id` | The environment ID (e.g., `e-abc123def4`) |
| `environment-status` | Current status of the environment |
| `environment-health` | Current health of the environment |
| `deployment-action-type` | Whether the environment was `create`d or `update`d |
| `version-label` | The version label that was deployed |

## Credentials and Region

Configure AWS credentials using the [`aws-actions/configure-aws-credentials`](https://github.com/aws-actions/configure-aws-credentials) action:

```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: us-east-1
```

## Permissions

### IAM Roles Required

Two IAM roles must exist in your AWS account and passed in as part of the option-settings Input Parameter:

1. **Instance Profile** (default: `aws-elasticbeanstalk-ec2-role`)
   - Allows EC2 instances to interact with AWS services (S3, CloudWatch, etc.)
   - https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/iam-instanceprofile.html

2. **Service Role** (default: `aws-elasticbeanstalk-service-role`)
   - Allows Elastic Beanstalk to manage AWS resources on your behalf
   - https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/iam-servicerole.html

You can create these roles using the [AWS Console setup wizard](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/iam-instanceprofile.html#iam-instanceprofile-create).

## Advanced Configuration

### Option Settings

Elastic Beanstalk option settings allow you to configure environment properties, instance settings, monitoring, and more. Provide them as a JSON array. **The IAM Instance Profile and Service Role settings are required:**

```yaml
option-settings: |
  [
    {
      "Namespace": "aws:autoscaling:launchconfiguration",
      "OptionName": "IamInstanceProfile",
      "Value": "aws-elasticbeanstalk-ec2-role"
    },
    {
      "Namespace": "aws:elasticbeanstalk:environment",
      "OptionName": "ServiceRole",
      "Value": "aws-elasticbeanstalk-service-role"
    },
    {
      "Namespace": "aws:ec2:instances",
      "OptionName": "InstanceTypes",
      "Value": "t3.medium"
    },
    {
      "Namespace": "aws:elasticbeanstalk:environment",
      "OptionName": "EnvironmentType",
      "Value": "LoadBalanced"
    },
    {
      "Namespace": "aws:elasticbeanstalk:application:environment",
      "OptionName": "NODE_ENV",
      "Value": "production"
    },
    {
      "Namespace": "aws:elasticbeanstalk:cloudwatch:logs",
      "OptionName": "StreamLogs",
      "Value": "true"
    },
    {
      "Namespace": "aws:elasticbeanstalk:cloudwatch:logs",
      "OptionName": "RetentionInDays",
      "Value": "7"
    }
  ]
```

See the [complete list of configuration options](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/command-options-general.html) in AWS documentation.

### Exclude Patterns

When auto-creating deployment packages, exclude unnecessary files to reduce package size:

```yaml
exclude-patterns: '*.git*,*node_modules*,*.env*,*__pycache__*,*.pytest_cache*,*test*,*.log'
```

Patterns use glob syntax:
- `*.git*` - Excludes `.git` directory and `.gitignore`
- `*node_modules*` - Excludes `node_modules` directory
- `*.env*` - Excludes `.env` files

**Note:** `exclude-patterns` is only used when `deployment-package-path` is NOT specified. If you provide a pre-built package path, exclusions are ignored.

### Deployment Strategies

#### Fast Deployments with Version Reuse

For deployments where the code hasn't changed (configuration updates only):

```yaml
- name: Update Configuration Only
  uses: aws-actions/aws-elasticbeanstalk-deploy@v1
  with:
    aws-region: us-east-1
    application-name: my-app
    environment-name: my-app-prod
    solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
    version-label: v1.0.0  # Existing version
    use-existing-application-version-if-available: true
    option-settings: |
      [
        {
          "Namespace": "aws:autoscaling:launchconfiguration",
          "OptionName": "IamInstanceProfile",
          "Value": "aws-elasticbeanstalk-ec2-role"
        },
        {
          "Namespace": "aws:elasticbeanstalk:environment",
          "OptionName": "ServiceRole",
          "Value": "aws-elasticbeanstalk-service-role"
        },
        {
          "Namespace": "aws:autoscaling:asg",
          "OptionName": "MinSize",
          "Value": "3"
        }
      ]
```

#### Rolling Deployments

Control deployment behavior through option settings:

```yaml
option-settings: |
  [
    {
      "Namespace": "aws:autoscaling:launchconfiguration",
      "OptionName": "IamInstanceProfile",
      "Value": "aws-elasticbeanstalk-ec2-role"
    },
    {
      "Namespace": "aws:elasticbeanstalk:environment",
      "OptionName": "ServiceRole",
      "Value": "aws-elasticbeanstalk-service-role"
    },
    {
      "Namespace": "aws:elasticbeanstalk:command",
      "OptionName": "DeploymentPolicy",
      "Value": "Rolling"
    },
    {
      "Namespace": "aws:elasticbeanstalk:command",
      "OptionName": "BatchSizeType",
      "Value": "Percentage"
    },
    {
      "Namespace": "aws:elasticbeanstalk:command",
      "OptionName": "BatchSize",
      "Value": "50"
    }
  ]
```

#### Disable Health Recovery Wait

For faster deployments in non-production environments:

```yaml
- name: Deploy to Dev (No Health Wait)
  uses: aws-actions/aws-elasticbeanstalk-deploy@v1
  with:
    aws-region: us-east-1
    application-name: my-app
    environment-name: my-app-dev
    solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
    wait-for-environment-recovery: false  # Deploy completes faster
    option-settings: |
      [
        {
          "Namespace": "aws:autoscaling:launchconfiguration",
          "OptionName": "IamInstanceProfile",
          "Value": "aws-elasticbeanstalk-ec2-role"
        },
        {
          "Namespace": "aws:elasticbeanstalk:environment",
          "OptionName": "ServiceRole",
          "Value": "aws-elasticbeanstalk-service-role"
        }
      ]
```

## Examples

Workflow examples are available in the [`examples/`](examples/) directory:

- [**python.yml**](examples/python.yml) - Python/Flask application deployment
- [**nodejs.yml**](examples/nodejs.yml) - Node.js/Express application deployment
- [**java.yml**](examples/java.yml) - Java/Spring Boot application deployment
- [**docker.yml**](examples/docker.yml) - Docker-based application deployment

## Example Output

Below are examples of what you'll see in your GitHub Actions logs during deployment.

### Successful Deployment (Happy Path)

When a deployment succeeds with the environment reaching a healthy state:

```
Run aws-actions/aws-elasticbeanstalk-deploy@v1
🔍 Validating inputs...
✅ All inputs are valid

🔐 Verifying AWS credentials...
✅ Successfully authenticated as account 123456789012

🏥 Checking IAM roles...
✅ Instance profile 'aws-elasticbeanstalk-ec2-role' exists
✅ Service role 'aws-elasticbeanstalk-service-role' exists

📦 Creating deployment package...
  Packaging files from: /home/runner/work/my-app/my-app
  Excluding patterns: *.git*,*node_modules*,*.env*,*test*
  Package size: 2.4 MB
✅ Package created: /tmp/deploy-1234567890.zip

📤 Uploading to S3...
  Bucket: elasticbeanstalk-us-east-1-123456789012
  Key: my-app/v1.2.3.zip
✅ Upload complete

🎯 Creating application version...
  Application: my-app
  Version: v1.2.3
✅ Application version created

🚀 Updating environment...
  Environment: my-app-prod
  Version: v1.2.3
✅ Environment update initiated

⏳ Waiting for deployment to complete...
✅ Deployment complete

🏥 Waiting for environment health to recover...
  Current status: Updating, health: Grey
  Current status: Ready, health: Yellow
  Current status: Ready, health: Green
✅ Environment is healthy!

✅ Deployment successful!
  Environment URL: my-app-prod.us-east-1.elasticbeanstalk.com
  Environment ID: e-abc123def4
  Version: v1.2.3
  Action: update
```

### Failed Deployment (Unhappy Path)

When a deployment completes but the environment health remains Red, the action displays recent events to help diagnose the issue:

```
Run aws-actions/aws-elasticbeanstalk-deploy@v1
🔍 Validating inputs...
✅ All inputs are valid

🔐 Verifying AWS credentials...
✅ Successfully authenticated as account 123456789012

🏥 Checking IAM roles...
✅ Instance profile 'aws-elasticbeanstalk-ec2-role' exists
✅ Service role 'aws-elasticbeanstalk-service-role' exists

📦 Creating deployment package...
  Packaging files from: /home/runner/work/my-app/my-app
  Excluding patterns: *.git*,*node_modules*,*.env*,*test*
  Package size: 2.4 MB
✅ Package created: /tmp/deploy-1234567890.zip

📤 Uploading to S3...
  Bucket: elasticbeanstalk-us-east-1-123456789012
  Key: my-app/v1.2.3.zip
✅ Upload complete

🎯 Creating application version...
  Application: my-app
  Version: v1.2.3
✅ Application version created

🚀 Updating environment...
  Environment: my-app-prod
  Version: v1.2.3
✅ Environment update initiated

⏳ Waiting for deployment to complete...
✅ Deployment complete

🏥 Waiting for environment health to recover...
  Current status: Updating, health: Grey
  Current status: Ready, health: Yellow
  Current status: Ready, health: Red

🔍 Fetching recent events for debugging...
📋 Recent events:
  [2025-12-18T10:32:45.000Z] ERROR: Environment health has transitioned from Yellow to Red
  [2025-12-18T10:32:30.000Z] ERROR: Instance i-0123456789abcdef0 failed health checks. Application is not responding on port 5000
  [2025-12-18T10:32:15.000Z] WARN: Instance i-0123456789abcdef0 is not responding to health check requests
  [2025-12-18T10:31:45.000Z] INFO: Successfully launched instance i-0123456789abcdef0
  [2025-12-18T10:31:30.000Z] INFO: Environment update is starting
  [2025-12-18T10:31:15.000Z] INFO: Application version v1.2.3 was deployed to environment my-app-prod

Error: Environment deployment failed - health is Red
```

The event debugging feature automatically displays the last 10 environment events when a deployment fails, helping you quickly identify the cause. This diagnostic information eliminates the need to manually check the AWS Console for deployment failure causes.

## Finding Solution Stack Names

Solution stacks define the platform version (operating system, runtime, application server) for your environment.

### List All Available Stacks

```bash
aws elasticbeanstalk list-available-solution-stacks --region us-east-1
```

### Find Platform-Specific Stacks

**Python:**
```bash
aws elasticbeanstalk list-available-solution-stacks --region us-east-1 | grep -i python
```

**Node.js:**
```bash
aws elasticbeanstalk list-available-solution-stacks --region us-east-1 | grep -i node
```

**Java (Corretto):**
```bash
aws elasticbeanstalk list-available-solution-stacks --region us-east-1 | grep -i corretto
```

**Note:** Solution stack names change as AWS releases new platform versions. Always verify the latest available version for your region.

## Troubleshooting

### Deployment Timeout

If deployments consistently timeout, increase the `deployment-timeout`:

```yaml
deployment-timeout: 1800  # 30 minutes
```

Or check environment events in the AWS Console to identify issues causing slow deployments.

### Environment Name Validation Errors

Environment names must:
- Be 4-40 characters long
- Contain only alphanumeric characters and hyphens
- Not start or end with a hyphen

```yaml
environment-name: my-app-prod  # Valid
environment-name: my_app       # Invalid (underscores not allowed)
environment-name: env          # Invalid (too short, minimum 4 characters)
```

### IAM Role Not Found Errors

Ensure the IAM roles exist before deployment:

```bash
# Verify instance profile
aws iam get-instance-profile --instance-profile-name aws-elasticbeanstalk-ec2-role

# Verify service role
aws iam get-role --role-name aws-elasticbeanstalk-service-role
```

Create them using the [AWS Console](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/iam-instanceprofile.html#iam-instanceprofile-create) or CLI.

### Red Health Status After Deployment

The action fails if environment health is Red after deployment completes. Common causes:

1. **Application errors** - Check CloudWatch Logs or `/var/log/` on instances
2. **Port mismatch** - Ensure your application listens on the correct port (usually 5000 or 8080)
3. **Health check failures** - Verify your application responds to health check requests

Set `wait-for-environment-recovery: false` to skip health checks if investigating deployment issues.

### S3 Bucket Permissions

The action uploads deployment packages to `elasticbeanstalk-{region}-{account-id}`. If you encounter S3 permission errors:

1. Verify the IAM policy includes S3 permissions (see [Permissions](#permissions))
2. Check if the bucket exists and is accessible
3. Set `create-s3-bucket-if-not-exists: true` to auto-create the bucket

### Input Conflict Warnings

The action detects common misconfigurations:

- **`deployment-package-path` with `exclude-patterns`**: Exclusions are ignored when using pre-built packages
- **`create-application-if-not-exists: true` but `create-environment-if-not-exists: false`**: Application will be created but environment won't be
- **`wait-for-environment-recovery: true` but `wait-for-deployment: false`**: Health waiting is skipped because deployment waiting is disabled
- **`max-retries: 0`**: API calls won't retry on failure, increasing risk of transient errors causing deployment failure

These are warnings, not errors, but indicate potential misconfigurations.

### Preventing Unnecessary Deployments

To avoid deploying when only non-application files change (e.g., documentation, tests), configure your workflow to trigger only on specific file changes:

```yaml
name: Deploy to Elastic Beanstalk

on:
  push:
    branches: [main]
    paths:
      - 'src/**'           # Application source code
      - 'requirements.txt' # Python dependencies
      - 'package.json'     # Node.js dependencies
      - 'pom.xml'          # Java dependencies
      - 'Procfile'         # EB process configuration
      - '.ebextensions/**' # EB configuration files
      # Exclude documentation, tests, CI files
      - '!**.md'
      - '!.github/**'
      - '!tests/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Elastic Beanstalk
        uses: aws-actions/aws-elasticbeanstalk-deploy@v1
        with:
          aws-region: us-east-1
          application-name: my-app
          environment-name: my-app-prod
          solution-stack-name: '64bit Amazon Linux 2023 v4.3.0 running Python 3.11'
          option-settings: |
            [
              {
                "Namespace": "aws:autoscaling:launchconfiguration",
                "OptionName": "IamInstanceProfile",
                "Value": "aws-elasticbeanstalk-ec2-role"
              },
              {
                "Namespace": "aws:elasticbeanstalk:environment",
                "OptionName": "ServiceRole",
                "Value": "aws-elasticbeanstalk-service-role"
              }
            ]
```

This prevents deployments when only README.md, test files, or CI configuration changes, reducing unnecessary deployments and costs.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

---

**Related AWS Actions:**
- [configure-aws-credentials](https://github.com/aws-actions/configure-aws-credentials) - Configure AWS credentials and region

**AWS Documentation:**
- [Elastic Beanstalk Developer Guide](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/)
- [Configuration Options](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/command-options-general.html)
- [Platform Versions](https://docs.aws.amazon.com/elasticbeanstalk/latest/platforms/)
