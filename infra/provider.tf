terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
      # version can be pinned if needed, e.g.: version = "~> 5.0"
    }
    archive = {
      source = "hashicorp/archive"
      # version = "~> 2.4"
    }
  }
  
  # Backend local - estado salvo como artifact do GitHub Actions
  # Para produção, configure backend S3 conforme BACKEND_SETUP.md
}

provider "aws" {
  region = "us-east-1"
}
