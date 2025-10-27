terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
  access_key = ""  
  secret_key = ""
}

# DynamoDB Table
resource "aws_dynamodb_table" "workshop_table" {
  name           = "unasp-workshop-table"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# Lambda Function
resource "aws_lambda_function" "workshop_lambda" {
  filename      = "../lambda_function.zip"
  function_name = "unasp-workshop-lambda"
  role          = "arn:aws:iam::528757791784:role/unasp_workshop"
  handler       = "lambda_function.lambda_handler"
  runtime       = "python3.9"

  environment {
    variables = {
      DYNAMODB_TABLE = aws_dynamodb_table.workshop_table.name
    }
  }
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${aws_lambda_function.workshop_lambda.function_name}"
  retention_in_days = 30  # Logs will be kept for 30 days

  tags = {
    Environment = "workshop"
    Function    = "unasp-workshop-lambda"
  }
}

# API Gateway
resource "aws_apigatewayv2_api" "workshop_api" {
  name          = "unasp-workshop-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins     = ["http://*", "https://*"]
    allow_methods     = ["*"]
    allow_headers     = ["*"]
    expose_headers    = ["*"]
    max_age          = 300
    allow_credentials = true
  }
}

resource "aws_apigatewayv2_stage" "workshop_stage" {
  api_id      = aws_apigatewayv2_api.workshop_api.id
  name        = "$default"
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "workshop_integration" {
  api_id           = aws_apigatewayv2_api.workshop_api.id
  integration_type = "AWS_PROXY"

  connection_type    = "INTERNET"
  description        = "Lambda integration"
  integration_method = "POST"
  integration_uri    = aws_lambda_function.workshop_lambda.invoke_arn
}

# Add OPTIONS route for CORS preflight requests
resource "aws_apigatewayv2_route" "options_route" {
  api_id    = aws_apigatewayv2_api.workshop_api.id
  route_key = "OPTIONS /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.workshop_integration.id}"
}

resource "aws_apigatewayv2_route" "workshop_route" {
  api_id    = aws_apigatewayv2_api.workshop_api.id
  route_key = "POST /items"
  target    = "integrations/${aws_apigatewayv2_integration.workshop_integration.id}"
}

# Lambda permission to allow API Gateway
resource "aws_lambda_permission" "api_gw" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.workshop_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.workshop_api.execution_arn}/*/*"
}

# Output the API Gateway URL
output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.workshop_api.api_endpoint}/items"
}

output "api_gateway_invoke_url" {
  description = "API Gateway stage invoke URL"
  value       = aws_apigatewayv2_stage.workshop_stage.invoke_url
}
