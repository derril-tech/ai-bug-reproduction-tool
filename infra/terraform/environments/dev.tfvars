# Development Environment Variables

environment = "dev"

# Smaller instance sizes for dev
db_instance_class    = "db.t3.micro"
db_allocated_storage = 20

redis_node_type = "cache.t3.micro"

# Single AZ for dev
availability_zones = ["us-east-1a"]

# Minimal scaling for dev
api_desired_count    = 1
worker_desired_count = 1

tags = {
  Project     = "ai-bug-repro"
  Environment = "dev"
  ManagedBy   = "terraform"
}
