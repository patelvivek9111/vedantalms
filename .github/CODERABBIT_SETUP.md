# CodeRabbit Setup Guide

This guide will help you set up CodeRabbit to automatically review your code on pull requests.

## Step 1: Install CodeRabbit GitHub App

1. Go to [CodeRabbit on GitHub Marketplace](https://github.com/marketplace/coderabbitai)
2. Click "Set up a plan" or "Install it for free"
3. Choose your installation option:
   - **All repositories**: CodeRabbit will review all repos in your account
   - **Only select repositories**: Choose specific repos (recommended for private repos)
4. Complete the installation

## Step 2: Configure CodeRabbit

The repository already includes a `.coderabbit.yaml` configuration file that:
- Enables automatic code reviews on pull requests
- Focuses on security, performance, and best practices
- Excludes build artifacts and dependencies
- Provides custom instructions for your LMS codebase

## Step 3: Test CodeRabbit

1. Create a new branch:
   ```bash
   git checkout -b test-coderabbit
   ```

2. Make a small change and commit:
   ```bash
   git add .
   git commit -m "Test CodeRabbit integration"
   ```

3. Push and create a pull request:
   ```bash
   git push origin test-coderabbit
   ```

4. CodeRabbit will automatically review your PR once it's opened!

## Manual Review Triggers

You can also manually trigger CodeRabbit reviews by commenting on a PR:
- `@coderabbitai review` - Standard review
- `@coderabbitai full review` - Comprehensive review

## Configuration

The `.coderabbit.yaml` file in the root directory controls CodeRabbit's behavior. You can customize:
- Which files to include/exclude
- Review depth (full, brief, or diff)
- Quality checks (security, performance, best practices)
- PR summary generation

## Pricing

- **Public repositories**: Free (Pro tier features)
- **Private repositories**: Free tier available with unlimited summaries

For more information, visit [CodeRabbit Documentation](https://docs.coderabbit.ai/)


