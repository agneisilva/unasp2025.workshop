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
}

provider "aws" {
  region = "us-east-1"
}
