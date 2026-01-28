# Deployment Examples

This directory contains example workflows for deploying different types of applications to AWS Elastic Beanstalk using this action.

## Available Examples

### Platform-Specific Examples
- [python.yml](python.yml) - Deploy a Python/Flask application
- [nodejs.yml](nodejs.yml) - Deploy a Node.js/Express application
- [java.yml](java.yml) - Deploy a Java/Spring Boot application

## Usage

1. Choose an example that matches your application type
2. Copy the workflow to your repository's `.github/workflows/` directory
3. Customize the configuration for your application
4. Add required secrets to your GitHub repository settings
5. Push to trigger the workflow

## Required Secrets

All examples require these GitHub secrets to be configured:

- `AWS_ACCESS_KEY_ID` - Your AWS access key
- `AWS_SECRET_ACCESS_KEY` - Your AWS secret key

## Common Customizations

### Application Name
```yaml
application-name: my-app  # Change this to your app name
```

### Environment Name
```yaml
environment-name: my-app-prod  # Change this to your environment name
```

### AWS Region
```yaml
aws-region: us-east-1  # Change to your preferred region
```

### Solution Stack
Find the latest solution stack for your platform:
```bash
aws elasticbeanstalk list-available-solution-stacks --region us-east-1 | grep -i <platform>
```

Replace `<platform>` with: python, node, java, docker, dotnet, ruby, go, or php
