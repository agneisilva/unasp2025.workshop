import { 
  ChangeDetectionStrategy, 
  Component, 
  inject, 
  signal, 
  OnInit 
} from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, finalize, of, tap } from 'rxjs';

/**
 * Interface para representar a estrutura de um item do DynamoDB
 * como recebido (com tipos de dados)
 */
interface DynamoDBItem {
  id: { S: string };
  dados: { S: string };
}

@Component({
  selector: 'app-root',
  standalone: true, // Componente standalone moderno
  imports: [
    CommonModule,       // Para diretivas como @if, @for
    HttpClientModule,   // Para fazer requisições HTTP
    FormsModule         // Para [(ngModel)] nos formulários
  ],
  changeDetection: ChangeDetectionStrategy.OnPush, // Otimização com Signals
  template: `
    <!-- Container Principal -->
    <div class="bg-gray-900 text-white min-h-screen font-sans">
      <main class="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
        
        <header class="text-center">
          <h1 class="text-3xl font-bold text-cyan-400">
            Gerenciador de Itens - DynamoDB
          </h1>
          <p class="text-gray-400">App Angular + API Gateway + Lambda</p>
        </header>

        <!-- Seção de Loading e Erros -->
        @if (isLoading()) {
          <div class="p-4 bg-yellow-900 border border-yellow-700 text-yellow-300 rounded-md text-center">
            Carregando...
          </div>
        }
        @if (error()) {
          <div class="p-4 bg-red-900 border border-red-700 text-red-300 rounded-md text-center">
            <strong>Erro:</strong> {{ error() }}
          </div>
        }

        <!-- Formulário (Muda entre Cadastrar e Alterar) -->
        <section class="bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
          
          <!-- Formulário de Alteração (aparece quando editItemId() não é null) -->
          @if (editItemId()) {
            <h2 class="text-2xl font-semibold text-white">Alterando Item: <span class="text-cyan-300">{{ editItemId() }}</span></h2>
            <form (ngSubmit)="confirmarAlteracao()">
              <div class="space-y-4">
                <div>
                  <label for="editDados" class="block text-sm font-medium text-gray-300 mb-1">Novos Dados:</label>
                  <input
                    id="editDados"
                    name="editDados"
                    [(ngModel)]="editItemDados"
                    class="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Digite os novos dados..."
                    required
                  />
                </div>
                <div class="flex items-center space-x-3">
                  <button 
                    type="submit" 
                    [disabled]="isLoading()"
                    class="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50">
                    Salvar Alteração
                  </button>
                  <button 
                    type="button" 
                    (click)="cancelarAlteracao()"
                    class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-md transition duration-200">
                    Cancelar
                  </button>
                </div>
              </div>
            </form>
          } @else {
            <!-- Formulário de Cadastro (padrão) -->
            <h2 class="text-2xl font-semibold text-white">Cadastrar Novo Item</h2>
            <form (ngSubmit)="cadastrarItem()">
              <div class="space-y-4">
                <div>
                  <label for="newDados" class="block text-sm font-medium text-gray-300 mb-1">Dados:</label>
                  <input
                    id="newDados"
                    name="newDados"
                    [(ngModel)]="newItemDados"
                    class="w-full p-3 bg-gray-700 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    placeholder="Digite os dados do novo item..."
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  [disabled]="isLoading() || !newItemDados().trim()"
                  class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition duration-200 disabled:opacity-50">
                  Cadastrar Item
                </button>
              </div>
            </form>
          }
        </section>

        <!-- Seção da Lista de Itens -->
        <section class="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 class="text-2xl font-semibold text-white mb-4">Itens na Tabela</h2>
          
          @if (items().length === 0 && !isLoading()) {
            <p class="text-gray-400 text-center">Nenhum item encontrado na tabela.</p>
          }

          <ul class="space-y-3">
            @for (item of items(); track item.id.S) {
              <li class="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-700 p-4 rounded-md shadow">
                <!-- Conteúdo do Item -->
                <div class="flex-1 min-w-0 mb-3 sm:mb-0">
                  <span class="text-sm font-medium text-cyan-300 truncate block" title="ID do Item">{{ item.id.S }}</span>
                  <p class="text-lg text-white">{{ item.dados.S }}</p>
                </div>
                <!-- Botões de Ação -->
                <div class="flex-shrink-0 flex sm:flex-col md:flex-row space-x-2 sm:space-x-0 sm:space-y-2 md:space-y-0 md:space-x-2">
                  <button
                    (click)="selecionarParaAlterar(item)"
                    [disabled]="isLoading()"
                    class="bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-bold py-2 px-3 rounded-md transition duration-200 text-sm disabled:opacity-50">
                    Alterar
                  </button>
                  <button
                    (click)="deletarItem(item.id.S)"
                    [disabled]="isLoading()"
                    class="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded-md transition duration-200 text-sm disabled:opacity-50">
                    Deletar
                  </button>
                </div>
              </li>
            }
          </ul>
        </section>

      </main>
    </div>
  `
})
export class AppComponent implements OnInit {
  // --- Injeção de Dependências ---
  private http = inject(HttpClient);

  // --- Configuração ---
  // !! IMPORTANTE !! Cole a URL da sua API Gateway aqui
  private readonly apiUrl = "https://q1ll9nh41k.execute-api.us-east-1.amazonaws.com/default/lambda_read_write_dynamodb";
  private readonly tableName = "unaspworkshop";

  // --- Estado da Aplicação (Signals) ---
  
  // Lista de itens do DynamoDB
  items = signal<DynamoDBItem[]>([]);
  
  // Flags de controle de UI
  isLoading = signal<boolean>(false);
  error = signal<string | null>(null);

  // Estado para o formulário de NOVO item
  newItemDados = signal<string>("");

  // Estado para o formulário de ALTERAÇÃO
  editItemId = signal<string | null>(null);
  editItemDados = signal<string>("");

  // --- Ciclo de Vida ---
  ngOnInit(): void {
    // Carrega os itens ao iniciar o componente
    this.listarItens();
  }

  // --- Métodos de Leitura (Read) ---
  listarItens(): void {
    this.isLoading.set(true);
    this.error.set(null);

    // O GET (Scan) espera TableName como query string param
    const params = { TableName: this.tableName };

    this.http.get<any>(this.apiUrl, { params }).pipe(
      tap((response) => {
        // Ordena os itens por ID antes de exibi-los
        const sortedItems = response.Items.sort((a: DynamoDBItem, b: DynamoDBItem) => 
          a.id.S.localeCompare(b.id.S)
        );
        this.items.set(sortedItems);
      }),
      catchError((err) => {
        console.error('Erro ao listar:', err);
        this.error.set(`Falha ao carregar itens. (Erro: ${err.message})`);
        return of(null); // Continua o fluxo sem quebrar
      }),
      finalize(() => {
        this.isLoading.set(false);
      })
    ).subscribe();
  }

  // --- Métodos de Escrita (Create, Update, Delete) ---

  cadastrarItem(): void {
    const dados = this.newItemDados().trim();
    if (!dados) {
      this.error.set("O campo 'dados' não pode estar vazio.");
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    // ID único gerado no cliente
    const newId = `item-angular-${Date.now()}`;

    // Payload para o 'put_item' do DynamoDB
    const payload = {
      TableName: this.tableName,
      Item: {
        id: { S: newId },
        dados: { S: dados }
      }
    };

    this.http.post(this.apiUrl, payload).pipe(
      tap(() => {
        this.newItemDados.set(""); // Limpa o formulário
        this.listarItens(); // Recarrega a lista
      }),
      catchError((err) => {
        console.error('Erro ao cadastrar:', err);
        this.error.set(`Falha ao cadastrar item. (Erro: ${err.message})`);
        return of(null);
      }),
      finalize(() => {
        // O isLoading só será false após o listarItens() terminar
      })
    ).subscribe();
  }

  deletarItem(id: string): void {
    // Confirmação simples (em um app real, use um modal)
    if (!confirm(`Tem certeza que quer deletar o item "${id}"?`)) {
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    // Payload para o 'delete_item'
    const payload = {
      TableName: this.tableName,
      Key: {
        id: { S: id }
      }
    };

    // DELETE com body precisa ser enviado na opção 'body'
    this.http.delete(this.apiUrl, { body: payload }).pipe(
      tap(() => {
        this.listarItens(); // Recarrega a lista
      }),
      catchError((err) => {
        console.error('Erro ao deletar:', err);
        this.error.set(`Falha ao deletar item. (Erro: ${err.message})`);
        return of(null);
      }),
      finalize(() => {
        // O isLoading só será false após o listarItens() terminar
      })
    ).subscribe();
  }
  
  // --- Métodos de Alteração (Update) ---

  selecionarParaAlterar(item: DynamoDBItem): void {
    // Preenche os signals do formulário de edição
    this.editItemId.set(item.id.S);
    this.editItemDados.set(item.dados.S);
    // Rola a tela para o topo para ver o formulário
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelarAlteracao(): void {
    // Limpa os signals de edição, voltando para o formulário de cadastro
    this.editItemId.set(null);
    this.editItemDados.set("");
    this.error.set(null); // Limpa erros
  }

  confirmarAlteracao(): void {
    const id = this.editItemId();
    const dados = this.editItemDados().trim();

    if (!id || !dados) {
      this.error.set("Dados inválidos para alteração.");
      return;
    }

    this.isLoading.set(true);
    this.error.set(null);

    // Payload para o 'update_item'
    const payload = {
      TableName: this.tableName,
      Key: {
        id: { S: id }
      },
      UpdateExpression: "set dados = :d",
      ExpressionAttributeValues: {
        ":d": { S: dados }
      }
    };

    this.http.put(this.apiUrl, payload).pipe(
      tap(() => {
        this.cancelarAlteracao(); // Limpa o formulário de edição
        this.listarItens(); // Recarrega a lista
      }),
      catchError((err) => {
        console.error('Erro ao alterar:', err);
        this.error.set(`Falha ao alterar item. (Erro: ${err.message})`);
        return of(null);
      }),
      finalize(() => {
        // O isLoading só será false após o listarItens() terminar
      })
    ).subscribe();
  }
}
