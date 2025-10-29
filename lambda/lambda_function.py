import boto3
import json
import base64  # Importado para decodificar base64
import os

print('Loading function')
dynamo = boto3.client('dynamodb')
TABLE_NAME = os.getenv('DYNAMODB_TABLE')


def respond(err, res=None):
    """
    Função helper para formatar a resposta do API Gateway.
    Usa str(err) em vez de err.message para compatibilidade.
    """
    
    # Cria o corpo da resposta
    response_payload = {
        'statusCode': 400 if err else 200,
        'body': str(err) if err else json.dumps(res),
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', # Adicionado para CORS, se necessário
            'Access-Control-Allow-Headers':'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Credentials' : True,
            'Content-Type': 'application/json', 
            'Access-Control-Allow-Methods': '*'
            
        },
    }
    
    # **NOVA LINHA: Loga a resposta que será enviada**
    print(f"Sending response: {json.dumps(response_payload)}")
    
    return response_payload


def lambda_handler(event, context):
    '''
    Processa requisições do API Gateway para interagir com o DynamoDB.
    '''
    print("Received event: " + json.dumps(event, indent=2))

    operations = {
        'DELETE': lambda dynamo, x: dynamo.delete_item(**x),
        'GET':    lambda dynamo, x: dynamo.scan(**x),
        'POST':   lambda dynamo, x: dynamo.put_item(**x),
        'PUT':    lambda dynamo, x: dynamo.update_item(**x),
    }

    print("Determining operation...")
    
    # Primeiro, tentamos o formato v2.0
    operation = event.get('requestContext', {}).get('http', {}).get('method')
    
    # Se não achar (for None), tentamos o formato v1.0 (legado)
    if not operation:
        operation = event.get('httpMethod')
    
    # **FIM DA CORREÇÃO**
    
    if not operation or operation not in operations:
        return respond(None, {'message': 'OK'})

    try:

        # Para GET, não exigimos mais query params; usamos a tabela do env
        if operation == 'GET':
            params = { 'TableName': TABLE_NAME }
        else:
            # Lógica para POST, PUT, DELETE
            body_str = event.get('body')
            if not body_str:
                return respond(ValueError('Request body is missing or empty'))

            # Checa se o body veio em base64
            if event.get('isBase64Encoded', False):
                print("Body está em base64, decodificando...")
                body_str = base64.b64decode(body_str).decode('utf-8')

            # Esperamos o payload no formato dos métodos do DynamoDB (Item, Key, UpdateExpression, etc.)
            params = json.loads(body_str)
            # Se o cliente não informou a tabela, usamos a do ambiente
            if 'TableName' not in params:
                params['TableName'] = TABLE_NAME

        # Executa a operação do DynamoDB
        result = operations[operation](dynamo, params)
        
        # Scan e GetItem podem retornar 'Items' ou 'Item' que não são serializáveis
        # Esta é uma boa prática, embora não estritamente necessária para put/delete
        if 'Items' in result:
             # O boto3 pode retornar tipos Decimal que json.dumps não entende
             # Esta é uma forma simples de contornar isso, mas para produção
             # seria melhor usar um JSON encoder customizado.
            result['Items'] = json.loads(json.dumps(result['Items'], default=str))
        
        return respond(None, result)

    except Exception as e:
        print(f"Erro ao processar a requisição: {e}")
        # Retorna o erro específico do Boto3 ou do JSON
        return respond(e)


