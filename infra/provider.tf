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
  
  # Backend S3 para persistir estado entre execuções do CI/CD
  # Configuração passada via -backend-config no workflow
  backend "s3" {
    # bucket, key, region, dynamodb_table serão fornecidos no terraform init
  }
}

provider "aws" {
  region = "us-east-1"
}
