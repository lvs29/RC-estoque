import os
import hashlib
import secrets
from datetime import date, datetime
from sqlalchemy import create_engine, text, Column, Integer, String, Text, ForeignKey, DateTime, Boolean, CheckConstraint
from sqlalchemy.orm import declarative_base, sessionmaker, relationship, Session

DB_PATH = os.environ.get("DB_PATH", "database.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

# ─── Models ───────────────────────────────────────────────────────────────────

class Usuario(Base):
    __tablename__ = "usuarios"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    nome       = Column(String, nullable=False)
    username   = Column(String, nullable=False, unique=True)
    senha_hash = Column(String, nullable=False)
    role       = Column(String, nullable=False, default="user")
    criado_em  = Column(DateTime, nullable=False, default=datetime.utcnow)

    sessoes  = relationship("Sessao",  back_populates="usuario", cascade="all, delete-orphan")
    reservas = relationship("Reserva", back_populates="usuario")

class Sessao(Base):
    __tablename__ = "sessoes"

    token      = Column(String, primary_key=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    criado_em  = Column(DateTime, nullable=False, default=datetime.utcnow)

    usuario = relationship("Usuario", back_populates="sessoes")

class Peca(Base):
    __tablename__ = "pecas"

    id                  = Column(Integer, primary_key=True, autoincrement=True)
    nome                = Column(String, nullable=False, unique=True)
    descricao           = Column(Text)
    quantidade_total    = Column(Integer, nullable=False, default=0)
    quantidade_reservada = Column(Integer, nullable=False, default=0)
    tipo                = Column(String)
    foto_path           = Column(String)
    criado_em           = Column(DateTime, nullable=False, default=datetime.utcnow)

    reserva_itens = relationship("ReservaItem", back_populates="peca", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint('quantidade_total >= 0', name='ck_quantidade_total_nonnegative'),
        CheckConstraint('quantidade_reservada >= 0', name='ck_quantidade_reservada_nonnegative'),
    )

class Reserva(Base):
    __tablename__ = "reservas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    solicitante = Column(String, nullable=False)
    data_retirada = Column(String, nullable=False)
    data_prevista_devolucao = Column(String)
    data_real_devolucao = Column(String)
    observacoes = Column(Text)
    criado_em = Column(DateTime, nullable=False, default=datetime.utcnow)
    status = Column(String, nullable=False, default="PENDENTE")
    usuario = relationship("Usuario", back_populates="reservas")
    itens = relationship("ReservaItem", back_populates="reserva", cascade="all, delete-orphan")

class ReservaItem(Base):
    __tablename__ = "reserva_itens"

    id         = Column(Integer, primary_key=True, autoincrement=True)
    reserva_id = Column(Integer, ForeignKey("reservas.id", ondelete="CASCADE"), nullable=False)
    peca_id    = Column(Integer, ForeignKey("pecas.id", ondelete="CASCADE"), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)

    reserva = relationship("Reserva", back_populates="itens")
    peca    = relationship("Peca", back_populates="reserva_itens")

class ReservaStatus:
    PENDENTE = "PENDENTE"
    RETIRADO = "RETIRADO"
    DEVOLVIDO = "DEVOLVIDO"
    CANCELADO = "CANCELADO"

# ─── Helpers ──────────────────────────────────────────────────────────────────

def get_db() -> Session:
    return SessionLocal()

def hash(senha: str) -> str:
    return hashlib.sha256(senha.encode()).hexdigest()

def _usuario_dict(u: Usuario) -> dict:
    return {
        "id": u.id,
        "nome": u.nome,
        "username": u.username,
        "role": u.role,
        "criado_em": u.criado_em.isoformat() if u.criado_em else None,
    }

def _peca_dict(p: Peca) -> dict:
    return {
        "id": p.id,
        "nome": p.nome,
        "descricao": p.descricao,
        "quantidade": max(0, p.quantidade_total - p.quantidade_reservada),
        "quantidade_total": p.quantidade_total,
        "quantidade_reservada": p.quantidade_reservada,
        "tipo": p.tipo,
        "foto_path": p.foto_path,
        "criado_em": p.criado_em.isoformat() if p.criado_em else None,
    }

def _reserva_dict(r: Reserva) -> dict:
    return {
        "id": r.id,
        "usuario_id": r.usuario_id,
        "usuario_nome":
            r.usuario.nome if r.usuario else None,
        "solicitante": r.solicitante,
        "data_retirada": r.data_retirada,
        "data_prevista_devolucao":
            r.data_prevista_devolucao,
        "data_real_devolucao":
            r.data_real_devolucao,
        "status": r.status,
        "devolvido":
            r.status == ReservaStatus.DEVOLVIDO,
        "retirado":
            r.status == ReservaStatus.RETIRADO,
        "observacoes": r.observacoes,
        "criado_em":
            r.criado_em.isoformat()
            if r.criado_em else None,
        "itens": [
            {
                "peca_id": item.peca_id,

                "peca_nome":
                    item.peca.nome
                    if item.peca else None,

                "quantidade": item.quantidade,
            }
            for item in r.itens
        ],
    }

# ─── Init ─────────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)
    _garantir_admin()

def _garantir_admin():
    db = get_db()
    try:
        existe = db.query(Usuario).filter_by(role="admin").first()
        if not existe:
            criar_usuario("Admin", "admin", os.environ.get("ADMIN_SENHA", ""), role="admin")
            print("[db] Admin criado — usuario: admin | senha: admin")
    finally:
        db.close()

# ─── Usuários ─────────────────────────────────────────────────────────────────

def listar_usuarios() -> list[dict]:
    db = get_db()
    try:
        return [_usuario_dict(u) for u in db.query(Usuario).order_by(Usuario.nome).all()]
    finally:
        db.close()

def buscar_usuario(usuario_id: int) -> dict | None:
    db = get_db()
    try:
        u = db.query(Usuario).get(usuario_id)
        return _usuario_dict(u) if u else None
    finally:
        db.close()

def buscar_usuario_por_username(username: str) -> dict | None:
    db = get_db()
    try:
        u = db.query(Usuario).filter_by(username=username).first()
        if not u:
            return None
        d = _usuario_dict(u)
        d["senha_hash"] = u.senha_hash
        return d
    finally:
        db.close()

def criar_usuario(nome: str, username: str, senha: str, role: str = "user") -> dict | None:
    db = get_db()
    try:
        u = Usuario(nome=nome, username=username, senha_hash=hash(senha), role=role)
        db.add(u)
        db.commit()
        db.refresh(u)
        return _usuario_dict(u)
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()

def atualizar_usuario(usuario_id: int, **campos) -> dict:
    db = get_db()
    try:
        u = db.query(Usuario).get(usuario_id)
        if not u:
            raise ValueError("Usuário não encontrado")
        if "role" in campos:
            if campos["role"] not in ("user", "admin"):
                raise ValueError("Role inválida")
            if usuario_id == 1 and campos["role"] == "user":
                raise ValueError("O usuário admin não pode ser rebaixado")
        for campo in ("nome", "username", "role"):
            if campo in campos:
                setattr(u, campo, campos[campo])
        if "senha" in campos:
            u.senha_hash = hash(campos["senha"])
        db.commit()
        db.refresh(u)
        return _usuario_dict(u)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def deletar_usuario(usuario_id: int):
    db = get_db()
    try:
        u = db.query(Usuario).get(usuario_id)
        if u:
            db.delete(u)
            db.commit()
    finally:
        db.close()

# ─── Sessões ──────────────────────────────────────────────────────────────────

def criar_sessao(usuario_id: int) -> str:
    token = secrets.token_hex(32)
    db = get_db()
    try:
        db.add(Sessao(token=token, usuario_id=usuario_id))
        db.commit()
        return token
    finally:
        db.close()

def buscar_sessao(token: str) -> dict | None:
    db = get_db()
    try:
        s = db.query(Sessao).filter_by(token=token).first()
        if not s or not s.usuario:
            return None
        return _usuario_dict(s.usuario)
    finally:
        db.close()

def deletar_sessao(token: str):
    db = get_db()
    try:
        s = db.query(Sessao).filter_by(token=token).first()
        if s:
            db.delete(s)
            db.commit()
    finally:
        db.close()

def login(username: str, senha: str) -> tuple[dict | None, str | None]:
    usuario = buscar_usuario_por_username(username)
    if not usuario or usuario["senha_hash"] != hash(senha):
        return None, None
    token = criar_sessao(usuario["id"])
    usuario.pop("senha_hash", None)
    return usuario, token

# ─── Peças ────────────────────────────────────────────────────────────────────

def listar_pecas() -> list[dict]:
    db = get_db()
    try:
        return [_peca_dict(p) for p in db.query(Peca).order_by(Peca.nome).all()]
    finally:
        db.close()

def buscar_peca(peca_id: int) -> dict | None:
    db = get_db()
    try:
        p = db.query(Peca).get(peca_id)
        return _peca_dict(p) if p else None
    finally:
        db.close()

def criar_peca(nome: str, descricao: str = None, quantidade: int = 0, foto_path: str = None, tipo: str = None) -> dict | None:
    db = get_db()
    try:
        p = Peca(nome=nome, descricao=descricao, quantidade_total=quantidade, quantidade_reservada=0, foto_path=foto_path, tipo=tipo)
        db.add(p)
        db.commit()
        db.refresh(p)
        return _peca_dict(p)
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()

def atualizar_peca(peca_id: int, **campos) -> dict | None:
    db = get_db()
    try:
        p = db.query(Peca).get(peca_id)
        if not p:
            return None
        for campo in ("nome", "descricao", "quantidade", "quantidade_total", "foto_path", "tipo"):
            if campo in campos:
                if campo in ("quantidade", "quantidade_total"):
                    valor = campos[campo]
                    if valor is not None and valor < 0:
                        raise ValueError("quantidade_total não pode ser negativa")
                setattr(p, campo, campos[campo])
        db.commit()
        db.refresh(p)
        return _peca_dict(p)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def deletar_peca(peca_id: int):
    db = get_db()
    try:
        p = db.query(Peca).get(peca_id)
        if p:
            os.remove(os.path.abspath(p.foto_path.lstrip("/"))) if p.foto_path else None
            db.delete(p)
            db.commit()
    finally:
        db.close()

def ajustar_quantidade(peca_id: int, delta: int) -> dict | None:
    db = get_db()
    try:
        p = db.query(Peca).get(peca_id)
        if not p:
            return None
        p.quantidade_total = max(0, p.quantidade_total + delta)
        db.commit()
        db.refresh(p)
        return _peca_dict(p)
    finally:
        db.close()

def disponibilidade_peca(peca_id: int, data: str) -> int:
    peca = buscar_peca(peca_id)
    if not peca:
        return 0
    db = get_db()
    try:
        row = db.execute(
            text("""
                SELECT COALESCE(SUM(ri.quantidade), 0) AS reservado
                FROM reserva_itens ri
                JOIN reservas r ON ri.reserva_id = r.id
                WHERE ri.peca_id = :peca_id
                  AND r.status != 'DEVOLVIDO'
                  AND r.status != 'CANCELADO'
                  AND r.data_retirada <= :data
                  AND (r.data_prevista_devolucao IS NULL OR r.data_prevista_devolucao >= :data)
            """),
            {"peca_id": peca_id, "data": data},
        ).fetchone()
        return max(0, peca["quantidade"] - row[0])
    finally:
        db.close()

def proxima_disponibilidade(peca_id: int, data: str) -> str | None:
    """Retorna a data mais próxima em que a peça volta a ter estoque disponível."""
    db = get_db()
    try:
        row = db.execute(
            text("""
                SELECT MIN(r.data_prevista_devolucao)
                FROM reservas r
                JOIN reserva_itens ri ON ri.reserva_id = r.id
                WHERE ri.peca_id = :peca_id
                  AND r.status != 'DEVOLVIDO'
                  AND r.status != 'CANCELADO'
                  AND r.data_retirada <= :data
                  AND r.data_prevista_devolucao >= :data
            """),
            {"peca_id": peca_id, "data": data},
        ).fetchone()
        return row[0] if row and row[0] else None
    finally:
        db.close()

# ─── Reservas ─────────────────────────────────────────────────────────────────

def listar_reservas(peca_id: int = None, apenas_ativas: bool = False, usuario_id: int = None) -> list[dict]:
    db = get_db()
    try:
        q = db.query(Reserva)
        if peca_id is not None:
            q = q.join(ReservaItem).filter(ReservaItem.peca_id == peca_id)
        if apenas_ativas:
            q = q.filter(Reserva.status.in_([ReservaStatus.PENDENTE, ReservaStatus.RETIRADO]))
        if usuario_id is not None:
            q = q.filter(Reserva.usuario_id == usuario_id)
        reservas = q.order_by(Reserva.data_retirada.desc()).all()
        return [_reserva_dict(r) for r in reservas]
    finally:
        db.close()

def buscar_reserva(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        return _reserva_dict(r) if r else None
    finally:
        db.close()

def criar_reserva( itens: list[dict], solicitante: str, data_retirada: str, data_prevista_devolucao: str, observacoes: str = None, usuario_id: int = None,) -> dict:
    db: Session = get_db()
    try:
        r = Reserva(
            usuario_id=usuario_id,
            solicitante=solicitante,
            data_retirada=data_retirada,
            data_prevista_devolucao=data_prevista_devolucao,
            observacoes=observacoes,
            status=ReservaStatus.PENDENTE,
        )
        db.add(r)
        db.flush()
        for item in itens:
            peca_id = item["peca_id"]
            quantidade = item["quantidade"]
            updated = (
                db.query(Peca)
                .filter(
                    Peca.id == peca_id,
                    (
                        Peca.quantidade_total
                        - Peca.quantidade_reservada
                    ) >= quantidade
                )
                .update({
                    Peca.quantidade_reservada:
                        Peca.quantidade_reservada + quantidade
                })
            )
            if updated == 0:
                raise ValueError(
                    f"Estoque insuficiente para peça {peca_id}"
                )
            ri = ReservaItem(
                reserva_id=r.id,
                peca_id=peca_id,
                quantidade=quantidade,
            )
            db.add(ri)
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def marcar_entregue(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.get(Reserva, reserva_id)
        if not r:
            return None
        if r.status != ReservaStatus.PENDENTE:
            raise ValueError(
                "Somente reservas pendentes podem ser retiradas"
            )
        r.status = ReservaStatus.RETIRADO
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    finally:
        db.close()

def marcar_devolvido(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.get(Reserva, reserva_id)
        if not r:
            return None
        if r.status == ReservaStatus.DEVOLVIDO:
            raise ValueError("Reserva já devolvida")
        if r.status != ReservaStatus.RETIRADO:
            raise ValueError(
                "Reserva precisa estar retirada antes da devolução"
            )
        for item in r.itens:
            p = db.get(Peca, item.peca_id)
            if p:
                p.quantidade_reservada -= item.quantidade
        r.status = ReservaStatus.DEVOLVIDO
        r.data_real_devolucao = date.today().isoformat()
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def deletar_reserva(reserva_id: int, usuario_id: int = None, role: str = None) -> tuple[bool, str]:
    db = get_db()
    try:
        r = db.get(Reserva, reserva_id)
        if not r:
            return False, "Reserva não encontrada"
        # ADMIN
        if role == "admin":
            if r.status in (ReservaStatus.PENDENTE, ReservaStatus.RETIRADO):
                for item in r.itens:
                    p = db.get(Peca, item.peca_id)
                    if p:
                        p.quantidade_reservada -= item.quantidade
            db.delete(r)
            db.commit()
            return True, "Reserva deletada"

        # USER
        if role == "user":
            if r.usuario_id != usuario_id:
                return False, "Sem permissão"
            if r.status != ReservaStatus.PENDENTE:
                return False, "Apenas reservas pendentes podem ser canceladas"

            for item in r.itens:
                p = db.get(Peca, item.peca_id)
                if p:
                    p.quantidade_reservada -= item.quantidade

            db.delete(r)
            db.commit()
            return True, "Reserva deletada"

        return False, "Permissão inválida"

    except Exception as e:
        db.rollback()
        return False, str(e)
    finally:
        db.close()

def atualizar_reserva(reserva_id: int, **campos) -> dict | None:
    db = get_db()
    try:
        r = db.get(Reserva, reserva_id)
        if not r:
            return None
        if r.status in (
            ReservaStatus.DEVOLVIDO,
            ReservaStatus.CANCELADO
        ):
            raise ValueError(
                "Não é possível editar reservas finalizadas"
            )
        campos_permitidos = [
            "solicitante",
            "data_retirada",
            "data_prevista_devolucao",
            "observacoes",
        ]
        for campo in campos_permitidos:
            if campo in campos:
                setattr(r, campo, campos[campo])
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

def reserva_atrasada(reserva: dict) -> bool:
    if reserva.get("status") == ReservaStatus.DEVOLVIDO:
        return False
    data_prevista = reserva.get(
        "data_prevista_devolucao"
    )
    if not data_prevista:
        return False
    return (
        date.fromisoformat(data_prevista)
        < date.today()
    )

if __name__ == "__main__":
    init_db()
    print("Database inicializada em", DB_PATH)