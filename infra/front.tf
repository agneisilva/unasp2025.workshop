

resource "aws_s3_bucket" "example" {
  bucket = "workshop-unasp-${random_id.bucket_suffix.hex}" # Make bucket name unique

  # Allow Terraform to destroy the bucket even if it contains objects (useful for cleanup)
  force_destroy = true

  tags = {
    Name        = "My bucket"
    Environment = "Dev"
  }
}
resource "aws_s3_bucket_website_configuration" "example" {
  bucket = aws_s3_bucket.example.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# Add a random suffix to ensure bucket name uniqueness
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

/* Allow public policies / public access on this bucket (so site can be served publicly).
   NOTE: account-level public access block may still prevent public access. */
resource "aws_s3_bucket_public_access_block" "example" {
  bucket                  = aws_s3_bucket.example.id
  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

/* Public read-only policy for objects in the bucket (static website). */
resource "aws_s3_bucket_policy" "public_read" {
  # Ensure the public access block is applied before we attach the public policy
  bucket = aws_s3_bucket.example.bucket
  depends_on = [aws_s3_bucket_public_access_block.example]

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Sid = "PublicReadGetObject",
        Effect = "Allow",
        Principal = "*",
        Action = [
          "s3:GetObject"
        ],
        Resource = ["${aws_s3_bucket.example.arn}/*"]
      }
    ]
  })
}

/* Upload local index.html (from project) to the bucket so website has content.
   The source path is relative to this infra/ directory. Adjust if your index.html is elsewhere. */
resource "aws_s3_bucket_object" "index" {
  bucket       = aws_s3_bucket.example.bucket
  key          = "index.html"
  source       = "${path.module}/../src/index.html" # adjust path if your index.html lives elsewhere
  content_type = "text/html"
}
