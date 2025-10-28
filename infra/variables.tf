variable "frontend_bucket_name" {
  description = "Nome do bucket S3 para hospedar o frontend (deve ser globalmente único)"
  type        = string
  default     = "unasp-workshop-2025-front"
}

variable "dynamodb_table_name" {
  description = "Nome da tabela DynamoDB"
  type        = string
  default     = "unasp-workshop-table"
}

variable "lambda_function_name" {
  description = "Nome da função Lambda"
  type        = string
  default     = "unasp-workshop-lambda"
}

variable "api_gateway_name" {
  description = "Nome da API Gateway"
  type        = string
  default     = "unasp-workshop-api"
}

variable "lambda_execution_role_arn" {
  description = "ARN da role IAM para execução da função Lambda"
  type        = string
  default     = "arn:aws:iam::528757791784:role/unasp_workshop"
}
