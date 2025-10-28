
# DynamoDB Table
resource "aws_dynamodb_table" "workshop_table" {
  name           = var.dynamodb_table_name
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# Empacota a Lambda automaticamente em tempo de apply
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda"
  output_path = "${path.module}/../lambda_function.zip"
}

# Lambda Function
resource "aws_lambda_function" "workshop_lambda" {
  filename      = data.archive_file.lambda_zip.output_path
  # Garante atualização do código quando o ZIP mudar
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  function_name = var.lambda_function_name
  role          = var.lambda_execution_role_arn
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
  name          = var.api_gateway_name
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

