# Production Environment Variables

environment = "prod"

# Production-grade instance sizes
db_instance_class    = "db.r6g.2xlarge"
db_allocated_storage = 100

redis_node_type      = "cache.r6g.large"
redis_num_cache_nodes = 2

# Multi-AZ for high availability
availability_zones = ["us-east-1a", "us-east-1b", "us-east-1c"]

# Production scaling
api_desired_count    = 6
worker_desired_count = 10

# Production tags
tags = {
  Project      = "ai-bug-repro"
  Environment  = "prod"
  ManagedBy    = "terraform"
  Backup       = "daily"
  Monitoring   = "enabled"
}
