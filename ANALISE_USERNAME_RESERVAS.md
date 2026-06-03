# Análise: Impacto da Mudança de Username nas Reservas

## Resumo
**Não há problema crítico, mas há inconsistência de dados**.

---

## Estrutura do Banco de Dados

### Tabela `usuarios`
- `id` (PK)
- `nome`
- `username` (UNIQUE)
- `senha_hash`
- `role`

### Tabela `reservas`
- `id` (PK)
- `usuario_id` (FK → usuarios.id, com `ondelete="SET NULL"`)
- `solicitante` (String, armazenado em tempo de criação)
- `data_retirada`
- `data_prevista_devolucao`
- `data_real_devolucao`
- `observacoes`
- `criado_em`
- `status`

---

## O Que Acontece Quando o Username Muda?

### Código Relevante

**app.py (linha 417):**
```python
solicitante = request.usuario["nome"]  # ← Usa o NOME, não o username
```

**db.py - criar_reserva():**
```python
r = Reserva(
    usuario_id=usuario_id,  # ← Referência by ID (Foreign Key)
    solicitante=solicitante,  # ← Snapshot do nome no momento da criação
    # ...
)
```

**db.py - atualizar_usuario():**
```python
def atualizar_usuario(usuario_id: int, **campos) -> dict:
    # ...
    for campo in ("nome", "username", "role"):
        if campo in campos:
            setattr(u, campo, campos[campo])
    # ← NÃO sincroniza com reservas
```

---

## Cenários de Impacto

### Cenário 1: Mudança de Username (SEM Impacto)
✅ **SAFE** - O sistema funciona normalmente

**Antes:**
- Usuario: `id=5, nome="João Silva", username="joao.silva"`
- Reservas: `usuario_id=5, solicitante="João Silva"`

**Depois (username alterado para "joao.silva2"):**
- Usuario: `id=5, nome="João Silva", username="joao.silva2"`
- Reservas: **INALTERADAS** → `usuario_id=5, solicitante="João Silva"`

**Por quê?** Porque:
1. O campo `solicitante` armazena um **snapshot do nome** no momento da criação
2. O username é usado apenas para login, não para identificação em reservas
3. A relação é mantida via `usuario_id`, que é uma chave estrangeira

---

### Cenário 2: Mudança de Nome (POTENCIAL IMPACTO)
⚠️ **SEM SINCRONIZAÇÃO** - Dados ficam inconsistentes visualmente

**Antes:**
- Usuario: `id=5, nome="João Silva", username="joao.silva"`
- Reservas: `usuario_id=5, solicitante="João Silva"`

**Depois (nome alterado para "João Pedro"):**
- Usuario: `id=5, nome="João Pedro", username="joao.silva"`
- Reservas: **INALTERADAS** → `usuario_id=5, solicitante="João Silva"`

**Impacto:** 
- Visualmente, aparece: "Solicitante: João Silva" mas o perfil do usuário agora mostra "João Pedro"
- Funcionalidade não é afetada
- É apenas um "snapshot histórico"

---

### Cenário 3: Deleção de Usuário
✅ **FUNCIONA CORRETAMENTE** - Graças ao `ondelete="SET NULL"`

**Antes:**
- Usuario: `id=5, nome="João Silva"`
- Reservas: `usuario_id=5, solicitante="João Silva", status="PENDENTE"`

**Depois (usuário deletado):**
- Usuario: DELETADO
- Reservas: `usuario_id=NULL, solicitante="João Silva", status="PENDENTE"`

**Impacto:**
- A reserva continua existindo (não é deletada)
- O campo `solicitante` permanece para referência histórica
- O `usuario_id` vira NULL, então não há mais relação com nenhum usuário
- **Resultado:** Reserva órfã, mas ainda acessível pelos admins

---

## Problemas Identificados

### Problema 1: Campo `solicitante` é Redundante
**Severidade:** Baixa

O campo `solicitante` duplica a informação que já está em `usuario.nome` via relacionamento. 

**Cenário problemático:**
```
Nome no BD:        "João Silva"
Username no BD:    "joao.silva" → muda para "joao.silva2"
Resultado:         ✓ Funciona (username é só pra login)

Nome no BD:        "João Silva" → muda para "João Pedro"
Resultado:         ⚠️ Inconsistência visual (campo solicitante fica desatualizado)
```

### Problema 2: Sem Validação de Integridade
**Severidade:** Baixa

O sistema permite qualquer mudança de nome sem sincronizar com reservas.

---

## Recomendações

### Opção 1: Aceitar Como Está (Recomendado para Funcionalidade Atual)
✅ **Vantagem:** Funciona, simples, dados históricos preservados
❌ **Desvantagem:** Visualmente inconsistente se nome mudar

**Por quê funciona:**
- O sistema usa `usuario_id` para relação, não `username`
- `solicitante` é um campo histórico, não crítico

---

### Opção 2: Sincronizar Nome em Reservas (Mais Consistente)
✅ **Vantagem:** Mantém dados consistentes
❌ **Desvantagem:** Altera histórico (perder snapshot original)

**Mudanças necessárias em db.py:**
```python
def atualizar_usuario(usuario_id: int, **campos) -> dict:
    db = get_db()
    try:
        u = db.query(Usuario).get(usuario_id)
        if not u:
            raise ValueError("Usuário não encontrado")
        
        # Sincronizar nome em reservas se mudar
        if "nome" in campos:
            db.query(Reserva).filter(Reserva.usuario_id == usuario_id).update(
                {Reserva.solicitante: campos["nome"]}
            )
        
        # ... resto do código
```

---

### Opção 3: Mudar Lógica para Usar Username ao Invés de Nome
✅ **Vantagem:** Username é imutável por políticas
❌ **Desvantagem:** Maior refatoração

---

## Conclusão

**Estado Atual: Funcionalmente Seguro ✅**
- Mudanças de username não quebram nada
- Reservas continuam vinculadas ao usuário correto via `usuario_id`
- O campo `solicitante` é um snapshot histórico

**Recomendação:** 
- Manter como está para a maioria dos casos
- Se consistência visual for importante, implementar a **Opção 2** (sincronizar nome)

