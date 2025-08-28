# AI Bug Reproduction Tool Infrastructure
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    postgresql = {
      source  = "cyrilgdn/postgresql"
      version = "~> 1.21"
    }
  }

  backend "s3" {
    bucket = "ai-bug-repro-terraform-state"
    key    = "terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC and Networking
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  azs         = var.availability_zones
}

# RDS PostgreSQL with pgvector
module "database" {
  source = "./modules/database"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.vpc.database_security_group_id]

  instance_class = var.db_instance_class
  allocated_storage = var.db_allocated_storage
}

# ElastiCache Redis
module "redis" {
  source = "./modules/redis"

  environment         = var.environment
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [module.vpc.redis_security_group_id]

  node_type      = var.redis_node_type
  num_cache_nodes = var.redis_num_cache_nodes
}

# S3 Bucket for artifacts
module "s3" {
  source = "./modules/s3"

  environment = var.environment
  bucket_name = var.s3_bucket_name
}

# ECS Cluster and Services
module "ecs" {
  source = "./modules/ecs"

  environment = var.environment
  vpc_id      = module.vpc.vpc_id
  subnet_ids  = module.vpc.private_subnet_ids

  api_desired_count    = var.api_desired_count
  worker_desired_count = var.worker_desired_count
}

# API Gateway
module "api_gateway" {
  source = "./modules/api_gateway"

  environment = var.environment
  api_name    = "ai-bug-repro-api"
}

# CloudFront for frontend
module "cloudfront" {
  source = "./modules/cloudfront"

  environment       = var.environment
  s3_bucket_id      = module.s3.bucket_id
  s3_bucket_domain  = module.s3.bucket_domain_name
  certificate_arn   = var.certificate_arn
}

# Outputs
output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.database.endpoint
  sensitive   = true
}

output "redis_endpoint" {
  description = "ElastiCache Redis endpoint"
  value       = module.redis.endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket for artifacts"
  value       = module.s3.bucket_name
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = module.api_gateway.api_url
}

output "cloudfront_url" {
  description = "CloudFront distribution URL"
  value       = module.cloudfront.distribution_url
}
