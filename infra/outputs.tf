# Output the API Gateway URL
output "api_gateway_url" {
  description = "API Gateway endpoint URL"
  value       = "${aws_apigatewayv2_api.workshop_api.api_endpoint}/items"
}

output "api_gateway_invoke_url" {
  description = "API Gateway stage invoke URL"
  value       = aws_apigatewayv2_stage.workshop_stage.invoke_url
}


output "dynamodb_table_name" {
  description = "DynamoDB table name used by the app"
  value       = aws_dynamodb_table.workshop_table.name
}


output "bucket_name" {
  value       = aws_s3_bucket.example.bucket
  description = "Name of the S3 bucket created for the Angular app"
}

output "website_endpoint" {
  value       = aws_s3_bucket.example.website_endpoint
  description = "S3 website endpoint (useful to access the hosted index.html)"
}