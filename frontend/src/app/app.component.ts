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
import { environment } from '../environments/environment';
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
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  // --- Injeção de Dependências ---
  private http = inject(HttpClient);

  // --- Configuração ---
  // A URL da API vem do environment; a Lambda decide a tabela
  private readonly apiUrl = environment.apiUrl;

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

  // GET sem parâmetros; a Lambda usa a tabela configurada via env
  this.http.get<any>(this.apiUrl).pipe(
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

    // Payload para o 'put_item' do DynamoDB (sem TableName)
    const payload = {
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

    // Payload para o 'delete_item' (sem TableName)
    const payload = {
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

    // Payload para o 'update_item' (sem TableName)
    const payload = {
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
