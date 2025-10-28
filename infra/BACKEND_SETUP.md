# Configuração do Backend Remoto do Terraform

Para evitar que recursos sejam criados duplicadamente a cada execução do pipeline, o Terraform precisa armazenar seu estado em um local persistente (backend S3).

## Recursos necessários (criar UMA VEZ, manualmente ou via console AWS)

### 1. Bucket S3 para armazenar o estado do Terraform

```bash
aws s3 mb s3://unasp-workshop-terraform-state --region us-east-1
aws s3api put-bucket-versioning \
  --bucket unasp-workshop-terraform-state \
  --versioning-configuration Status=Enabled
```

### 2. Tabela DynamoDB para lock do estado

```bash
aws dynamodb create-table \
  --table-name terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

## Secrets do GitHub a configurar

No repositório GitHub (`Settings > Secrets and variables > Actions > Secrets`), adicione:

- **TF_STATE_BUCKET**: `unasp-workshop-terraform-state`
- **TF_LOCK_TABLE**: `terraform-locks`

(Caso não existam esses secrets, o workflow tentará usar backend local, o que causará duplicação de recursos.)

## Como funciona

- O workflow executa `terraform init -backend-config="bucket=..."` para conectar ao estado remoto.
- Antes do `terraform apply`, um step importa recursos AWS já existentes (DynamoDB, S3, Lambda, API Gateway) para o estado do Terraform, evitando conflitos de "recurso já existe".
- Após o primeiro apply bem-sucedido, o estado fica salvo no S3 e runs subsequentes reutilizam os mesmos recursos.

## Limpeza (opcional)

Se precisar destruir toda a infraestrutura:

```bash
cd infra
terraform init \
  -backend-config="bucket=unasp-workshop-terraform-state" \
  -backend-config="key=unasp-workshop/terraform.tfstate" \
  -backend-config="region=us-east-1" \
  -backend-config="dynamodb_table=terraform-locks"
terraform destroy -auto-approve
```

Para remover o backend S3 e a tabela de locks (após destruir a infra):

```bash
aws s3 rb s3://unasp-workshop-terraform-state --force
aws dynamodb delete-table --table-name terraform-locks --region us-east-1
```
