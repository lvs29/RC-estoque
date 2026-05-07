# RC-Estoque

Sistema de controle de estoque e reservas para uso interno da escola. Permite gerenciar peças/itens, usuários e reservas com controle de disponibilidade por data.

## Funcionalidades

- **Autenticação**: Login com sessões, dois níveis de acesso (admin/user)
- **Gerenciamento de Peças**: CRUD completo com upload de fotos, categorização e controle de estoque
- **Sistema de Reservas**: Reserva de itens com validação de disponibilidade, fluxo de status (PENDENTE → RETIRADO → DEVOLVIDO/CANCELADO)
- **Controle de Usuários**: Admin pode criar/editar/deletar usuários
- **Interface Web**: Frontend responsivo com 5 páginas (Home, Login, Perfil, Reservas, Admin)

## Tecnologias

- Python 3.x
- Flask (web framework)
- SQLAlchemy (ORM)
- SQLite (banco de dados)

## Instalação

1. Clone o repositório:
```bash
git clone <repo-url>
cd RC-estoque
```

2. Crie um ambiente virtual:
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate  # Windows
```

3. Instale as dependências:
```bash
pip install -r requirements.txt
```

## Configuração

Variáveis de ambiente (opcional):
- `DB_PATH`: Caminho do banco de dados (padrão: `database.db`)
- `ADMIN_SENHA`: Senha do usuário admin (padrão: `admin123`)

Exemplo:
```bash
export ADMIN_SENHA="sua_senha_segura"
```

## Uso

1. Inicie o servidor:
```bash
python app.py
```

2. Acesse no navegador: `http://127.0.0.1:8000`

3. Login padrão:
   - Usuário: `admin`
   - Senha: `admin123` (ou a definida via `ADMIN_SENHA`)

## Estrutura do Projeto

```
RC-estoque/
├── app.py              # Aplicação Flask com rotas API
├── db.py               # Models e funções de banco de dados
├── database.db         # Banco SQLite (criado automaticamente)
├── static/             # Arquivos estáticos (CSS, JS, imagens)
│   ├── css/
│   ├── js/
│   ├── fotos/          # Upload de fotos das peças
│   └── img/
├── templates/          # Templates HTML
│   ├── index.html
│   ├── login.html
│   ├── profile.html
│   ├── reservas.html
│   └── manage.html
├── requirements.txt    # Dependências Python
└── README.md          # Este arquivo
```

## Fluxo de Reservas

1. **PENDENTE**: Reserva criada, itens reservados no estoque
2. **RETIRADO**: Admin marca como entregue, itens saem do estoque
3. **DEVOLVIDO**: Admin marca como devolvido, itens voltam ao estoque
4. **CANCELADO**: Reserva cancelada, itens liberados

## Permissões

- **Admin**: Acesso total a todas as funcionalidades
- **User**: Pode ver peças, criar/editar/deletar próprias reservas, editar perfil

## Produção

Para uso em produção:
- Use um servidor WSGI como Gunicorn ou uWSGI
- Configure variáveis de ambiente adequadamente
- Considere usar PostgreSQL em vez de SQLite para maior escalabilidade

## Desenvolvimento

O projeto está configurado para desenvolvimento. Para produção, remova ou ajuste as configurações conforme necessário.
