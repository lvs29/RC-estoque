import os
import hashlib
import secrets
from datetime import date, datetime
from sqlalchemy import (
    create_engine, text,
    Column, Integer, String, Text, ForeignKey, DateTime, Boolean
)
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

    id        = Column(Integer, primary_key=True, autoincrement=True)
    nome      = Column(String, nullable=False, unique=True)
    descricao = Column(Text)
    quantidade = Column(Integer, nullable=False, default=0)
    foto_path = Column(String)
    criado_em = Column(DateTime, nullable=False, default=datetime.utcnow)

    reservas = relationship("Reserva", back_populates="peca", cascade="all, delete-orphan")


class Reserva(Base):
    __tablename__ = "reservas"

    id             = Column(Integer, primary_key=True, autoincrement=True)
    peca_id        = Column(Integer, ForeignKey("pecas.id", ondelete="CASCADE"), nullable=False)
    usuario_id     = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"))
    solicitante    = Column(String, nullable=False)
    data_retirada  = Column(String, nullable=False)
    data_devolucao = Column(String)
    quantidade     = Column(Integer, nullable=False, default=1)
    devolvido      = Column(Boolean, nullable=False, default=False)
    retirado       = Column(Boolean, nullable=False, default=False)
    observacoes    = Column(Text)
    criado_em      = Column(DateTime, nullable=False, default=datetime.utcnow)

    peca    = relationship("Peca",    back_populates="reservas")
    usuario = relationship("Usuario", back_populates="reservas")


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
        "quantidade": p.quantidade,
        "foto_path": p.foto_path,
        "criado_em": p.criado_em.isoformat() if p.criado_em else None,
    }


def _reserva_dict(r: Reserva) -> dict:
    return {
        "id": r.id,
        "peca_id": r.peca_id,
        "peca_nome": r.peca.nome if r.peca else None,
        "usuario_id": r.usuario_id,
        "usuario_nome": r.usuario.nome if r.usuario else None,
        "solicitante": r.solicitante,
        "data_retirada": r.data_retirada,
        "data_devolucao": r.data_devolucao,
        "quantidade": r.quantidade,
        "devolvido": r.devolvido,
        "retirado": r.retirado,
        "observacoes": r.observacoes,
        "criado_em": r.criado_em.isoformat() if r.criado_em else None,
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
            criar_usuario("Admin", "admin", os.environ.get("ADMIN_SENHA", "admin123"), role="admin")
            print("[db] Admin criado — usuario: admin | senha: admin123")
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


def atualizar_usuario(usuario_id: int, **campos) -> dict | None:
    db = get_db()
    try:
        u = db.query(Usuario).get(usuario_id)
        if not u:
            return None
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
        return None
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


def criar_peca(nome: str, descricao: str = None, quantidade: int = 0, foto_path: str = None) -> dict | None:
    db = get_db()
    try:
        p = Peca(nome=nome, descricao=descricao, quantidade=quantidade, foto_path=foto_path)
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
        for campo in ("nome", "descricao", "quantidade", "foto_path"):
            if campo in campos:
                setattr(p, campo, campos[campo])
        db.commit()
        db.refresh(p)
        return _peca_dict(p)
    except Exception:
        db.rollback()
        return None
    finally:
        db.close()


def deletar_peca(peca_id: int):
    db = get_db()
    try:
        p = db.query(Peca).get(peca_id)
        if p:
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
        p.quantidade = max(0, p.quantidade + delta)
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
                SELECT COALESCE(SUM(quantidade), 0) AS reservado
                FROM reservas
                WHERE peca_id = :peca_id
                  AND devolvido = 0
                  AND data_retirada <= :data
                  AND (data_devolucao IS NULL OR data_devolucao >= :data)
            """),
            {"peca_id": peca_id, "data": data},
        ).fetchone()
        return max(0, peca["quantidade"] - row[0])
    finally:
        db.close()


# ─── Reservas ─────────────────────────────────────────────────────────────────

def listar_reservas(peca_id: int = None, apenas_ativas: bool = False, usuario_id: int = None) -> list[dict]:
    db = get_db()
    try:
        q = db.query(Reserva)
        if peca_id is not None:
            q = q.filter(Reserva.peca_id == peca_id)
        if apenas_ativas:
            q = q.filter(Reserva.devolvido == False)
        if usuario_id is not None:
            q = q.filter(Reserva.usuario_id == usuario_id)
        return [_reserva_dict(r) for r in q.order_by(Reserva.data_retirada.desc()).all()]
    finally:
        db.close()


def buscar_reserva(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        return _reserva_dict(r) if r else None
    finally:
        db.close()


def criar_reserva(
    peca_id: int,
    solicitante: str,
    data_retirada: str,
    data_devolucao: str,
    quantidade: int = 1,
    observacoes: str = None,
    usuario_id: int = None,
) -> dict:
    db = get_db()
    try:
        r = Reserva(
            peca_id=peca_id,
            usuario_id=usuario_id,
            solicitante=solicitante,
            data_retirada=data_retirada,
            data_devolucao=data_devolucao,
            quantidade=quantidade,
            observacoes=observacoes,
        )
        db.add(r)
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    finally:
        db.close()


def reserva_atrasada(reserva: dict) -> bool:
    if reserva["devolvido"] or not reserva["data_devolucao"]:
        return False
    return date.fromisoformat(reserva["data_devolucao"]) < date.today()


def marcar_entrege(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        if not r:
            return None
        r.retirado = True
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    finally:
        db.close()


def marcar_devolvido(reserva_id: int) -> dict | None:
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        if not r:
            return None
        r.devolvido = True
        r.data_devolucao = date.today().isoformat()
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    finally:
        db.close()


def atualizar_reserva(reserva_id: int, **campos) -> dict | None:
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        if not r:
            return None
        for campo in ("solicitante", "data_retirada", "data_devolucao", "devolvido", "quantidade", "observacoes"):
            if campo in campos:
                setattr(r, campo, campos[campo])
        db.commit()
        db.refresh(r)
        return _reserva_dict(r)
    finally:
        db.close()


def deletar_reserva(reserva_id: int):
    db = get_db()
    try:
        r = db.query(Reserva).get(reserva_id)
        if r:
            db.delete(r)
            db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    init_db()
    print("Database inicializada em", DB_PATH)