# Agent-Arms CDK Deployment

使用 AWS CDK 一键部署 Agent-Arms 完整平台到 AWS，包含 AgentCore 集成。

## 架构

部署以下 5 个 Stack：

| Stack | 资源 |
|-------|------|
| `network` | VPC + Subnets + NAT Gateway |
| `database` | Aurora PostgreSQL Serverless v2 + ElastiCache Redis |
| `agentcore` | AgentCore Gateway + Runtime + Memory + Identity |
| `backend` | ECS Fargate (FastAPI) + ALB + Auto Scaling |
| `frontend` | ECS Fargate (Next.js) + ALB + CloudFront CDN |

## 前置条件

- AWS CLI 已配置 (`aws configure`)
- Node.js >= 18
- Docker (用于构建容器镜像)
- CDK Bootstrap 已执行

## 快速部署

```bash
cd cdk

# 安装依赖
npm install

# Bootstrap CDK (首次使用需要)
npx cdk bootstrap

# 查看将要创建的资源
npx cdk diff

# 部署所有 Stack
npx cdk deploy --all

# 仅部署特定 Stack
npx cdk deploy agent-arms-agentcore-dev
```

## 配置

通过 CDK Context 或环境变量控制：

```bash
# 指定环境
npx cdk deploy --all -c environment=prod

# 指定 AWS 账户和区域
export AWS_ACCOUNT_ID=123456789012
export AWS_REGION=ap-southeast-1
npx cdk deploy --all
```

## 部署后

部署完成后，CDK 会输出各服务的 endpoint：

- `BackendUrl` - 后端 API 地址
- `FrontendUrl` - 前端访问地址
- `CloudFrontUrl` - CDN 加速地址
- `GatewayEndpoint` - AgentCore Gateway 端点
- `RuntimeEndpoint` - AgentCore Runtime 端点

将 `GatewayEndpoint` 配置到后端的 `AGENTCORE_GATEWAY_ENDPOINT` 环境变量中。

## 销毁

```bash
npx cdk destroy --all
```

注意：生产环境中 Aurora 数据库设置了 RETAIN 策略，不会被自动删除。
