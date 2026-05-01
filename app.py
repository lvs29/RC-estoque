import os
import functools
import uuid
from datetime import date, timedelta
from flask import Flask, render_template, jsonify, request, abort, redirect
from werkzeug.utils import secure_filename
from db import *

app = Flask(__name__)

UPLOAD_FOLDER = os.path.join("static", "fotos")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

init_db()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def get_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return request.cookies.get("token")


def usuario_atual():
    token = get_token()
    return buscar_sessao(token) if token else None


# ─── Decorators ───────────────────────────────────────────────────────────────

def requer_login(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        u = usuario_atual()
        if not u:
            return jsonify({"erro": "Não autenticado"}), 401
        request.usuario = u
        return f(*args, **kwargs)
    return wrapper


def requer_admin(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        u = usuario_atual()
        if not u:
            return jsonify({"erro": "Não autenticado"}), 401
        if u["role"] != "admin":
            return jsonify({"erro": "Acesso restrito a administradores"}), 403
        request.usuario = u
        return f(*args, **kwargs)
    return wrapper


# ─── Páginas ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/login")
def index_login():
    return render_template("login.html")
@app.route("/perfil")
@requer_login
def profile_page():
    return render_template("profile.html")
@app.route("/manage")
@requer_admin
def admin_page():
    return render_template("manage.html")


# ─── Auth ─────────────────────────────────────────────────────────────────────

@app.route("/api/auth/login", methods=["POST"])
def post_login():
    dados = request.get_json(force=True) or {}
    username = dados.get("username", "").strip()
    senha = dados.get("senha", "")
    if not username or not senha:
        abort(400, "username e senha são obrigatórios")
    
    usuario, token = login(username, senha)
    if not usuario:
        abort(401, "Credenciais inválidas")

    resp = jsonify({"usuario": usuario})  # token sai do body
    resp.set_cookie(
        "token",
        token,
        httponly=True,       # JS não consegue ler
        secure=True,         # só HTTPS — tire em dev local se precisar
        samesite="Strict",   # não vaza em requisições cross-site
        max_age=60 * 60 * 24 * 7,  # 7 dias, ajuste conforme necessário
        path="/",
    )
    return resp


@app.route("/api/auth/logout", methods=["POST"])
@requer_login
def post_logout():
    deletar_sessao(get_token())

    resp = jsonify({"ok": True})
    resp.delete_cookie("token", path="/")
    return resp

@app.route("/api/auth/me", methods=["GET"])
@requer_login
def get_me():
    return jsonify(request.usuario)

@app.route("/api/auth/me", methods=["PUT"])
@requer_login
def put_me():
    dados = request.get_json(force=True) or {}
    campos = {k: v for k, v in dados.items() if k in {"nome", "username", "senha", "senha_atual"}}
    if not campos:
        abort(400, "Nenhum campo para atualizar")
    # Prevent changing role
    if "role" in dados:
        abort(400, "Não é possível alterar o role")
    # If trying to change password, validate current password
    if "senha" in campos:
        if "senha_atual" not in dados or not dados["senha_atual"]:
            abort(400, "Senha atual é obrigatória para mudar a senha")
        usuario_com_hash = buscar_usuario_por_username(request.usuario["username"])
        if not usuario_com_hash or usuario_com_hash["senha_hash"] != hash(dados["senha_atual"]):
            abort(401, "Senha atual incorreta")
        # Remove senha_atual from update campos
        campos.pop("senha_atual", None)
    result = atualizar_usuario(request.usuario["id"], **campos)
    if not result:
        abort(400, "Erro ao atualizar usuário")
    return jsonify(result)

# ─── Usuários (admin only) ────────────────────────────────────────────────────

@app.route("/api/usuarios", methods=["GET"])
@requer_admin
def get_usuarios():
    return jsonify(listar_usuarios())


@app.route("/api/usuarios/<int:uid>", methods=["GET"])
@requer_admin
def get_usuario(uid):
    u = buscar_usuario(uid)
    if not u:
        abort(404, "Usuário não encontrado")
    return jsonify(u)


@app.route("/api/usuarios", methods=["POST"])
@requer_admin
def post_usuario():
    dados = request.get_json(force=True) or {}
    nome = dados.get("nome", "").strip()
    username = dados.get("username", "").strip()
    senha = dados.get("senha", "")
    role = dados.get("role", "user")
    if not nome or not username or not senha:
        abort(400, "nome, username e senha são obrigatórios")
    if role not in ("admin", "user"):
        abort(400, "role deve ser 'admin' ou 'user'")
    try:
        u = criar_usuario(nome, username, senha, role)
    except Exception:
        abort(409, "Username já existe")
    return jsonify(u), 201


@app.route("/api/usuarios/<int:uid>", methods=["PUT"])
@requer_admin
def put_usuario(uid):
    if not buscar_usuario(uid):
        abort(404, "Usuário não encontrado")
    dados = request.get_json(force=True) or {}
    campos = {k: v for k, v in dados.items() if k in {"nome", "username", "senha", "role"}}
    return jsonify(atualizar_usuario(uid, **campos))


@app.route("/api/usuarios/<int:uid>", methods=["DELETE"])
@requer_admin
def delete_usuario(uid):
    if not buscar_usuario(uid):
        abort(404, "Usuário não encontrado")
    if uid == request.usuario["id"]:
        abort(400, "Não é possível deletar o próprio usuário")
    deletar_usuario(uid)
    return jsonify({"ok": True})


# ─── Peças ────────────────────────────────────────────────────────────────────

@app.route("/api/pecas", methods=["GET"])
@requer_login
def get_pecas():
    return jsonify(listar_pecas())


@app.route("/api/pecas/<int:peca_id>", methods=["GET"])
@requer_login
def get_peca(peca_id):
    peca = buscar_peca(peca_id)
    if not peca:
        abort(404, "Peça não encontrada")
    return jsonify(peca)


@app.route("/api/pecas/<int:peca_id>/disponibilidade", methods=["GET"])
@requer_login
def get_disponibilidade(peca_id):
    """?data=YYYY-MM-DD → { peca_id, data, disponivel }"""
    if not buscar_peca(peca_id):
        abort(404, "Peça não encontrada")
    data = request.args.get("data", "").strip()
    if not data:
        abort(400, "Query param 'data' é obrigatório (YYYY-MM-DD)")
    return jsonify({
        "peca_id": peca_id,
        "data": data,
        "disponivel": disponibilidade_peca(peca_id, data),
    })

@app.route("/api/pecas", methods=["POST"])
@requer_admin
def post_peca():
    foto_path = None
    if request.content_type and "multipart/form-data" in request.content_type:
        dados = request.form
        arquivo = request.files.get("foto")
        if arquivo and allowed_file(arquivo.filename):
            ext = arquivo.filename.rsplit(".", 1)[1].lower()
            filename = f"{uuid.uuid4().hex}.{ext}"
            destino = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            arquivo.save(destino)
            foto_path = f"/static/fotos/{filename}"  # URL acessível pelo browser
    else:
        dados = request.get_json(force=True) or {}

    nome = dados.get("nome", "").strip()
    if not nome:
        abort(400, "Campo 'nome' é obrigatório")
    peca = criar_peca(
        nome=nome,
        descricao=dados.get("descricao"),
        quantidade=int(dados.get("quantidade", 0)),
        foto_path=foto_path,
    )
    if peca is None:
        abort(409, "Já existe uma peça com esse nome")
    return jsonify(peca), 201

@app.route("/api/pecas/<int:peca_id>", methods=["PUT"])
@requer_admin
def put_peca(peca_id):
    if not buscar_peca(peca_id):
        abort(404, "Peça não encontrada")
    foto_path = None
    if request.content_type and "multipart/form-data" in request.content_type:
        dados = dict(request.form)
        arquivo = request.files.get("foto")
        if arquivo and allowed_file(arquivo.filename):
            filename = secure_filename(arquivo.filename)
            destino = os.path.join(app.config["UPLOAD_FOLDER"], filename)
            arquivo.save(destino)
            foto_path = destino
    else:
        dados = request.get_json(force=True) or {}
    campos = {k: v for k, v in dados.items() if k in {"nome", "descricao", "quantidade"}}
    if foto_path:
        campos["foto_path"] = foto_path
    if "quantidade" in campos:
        campos["quantidade"] = int(campos["quantidade"])
    return jsonify(atualizar_peca(peca_id, **campos))


@app.route("/api/pecas/<int:peca_id>", methods=["DELETE"])
@requer_admin
def delete_peca(peca_id):
    if not buscar_peca(peca_id):
        abort(404, "Peça não encontrada")
    deletar_peca(peca_id)
    return jsonify({"ok": True})


@app.route("/api/pecas/<int:peca_id>/quantidade", methods=["PATCH"])
@requer_admin
def patch_quantidade(peca_id):
    if not buscar_peca(peca_id):
        abort(404, "Peça não encontrada")
    dados = request.get_json(force=True) or {}
    delta = dados.get("delta")
    if delta is None:
        abort(400, "Campo 'delta' é obrigatório")
    return jsonify(ajustar_quantidade(peca_id, int(delta)))


# ─── Reservas ─────────────────────────────────────────────────────────────────

@app.route("/api/reservas", methods=["GET"])
@requer_login
def get_reservas():
    """Admin vê todas. User vê só as próprias. ?peca_id=1 ?ativas=true"""
    peca_id = request.args.get("peca_id", type=int)
    apenas_ativas = request.args.get("ativas", "").lower() == "true"
    uid = None if request.usuario["role"] == "admin" else request.usuario["id"]
    reservas = listar_reservas(peca_id=peca_id, apenas_ativas=apenas_ativas, usuario_id=uid)
    for r in reservas:
        r["atrasado"] = reserva_atrasada(r)
    return jsonify(reservas)


@app.route("/api/reservas/<int:reserva_id>", methods=["GET"])
@requer_login
def get_reserva(reserva_id):
    reserva = buscar_reserva(reserva_id)
    if not reserva:
        abort(404, "Reserva não encontrada")
    if request.usuario["role"] != "admin" and reserva["usuario_id"] != request.usuario["id"]:
        abort(403, "Acesso negado")
    reserva["atrasado"] = reserva_atrasada(reserva)
    return jsonify(reserva)


@app.route("/api/reservas", methods=["POST"])
@requer_login
def post_reserva():
    """
    Valida disponibilidade antes de criar.
    Solicitante é sempre o usuário logado.
    Body: { itens: [{peca_id, quantidade}], data_retirada, data_devolucao, observacoes? }
    """
    dados = request.get_json(force=True) or {}
    itens = dados.get("itens", [])
    data_retirada = dados.get("data_retirada", "").strip()
    data_devolucao = dados.get("data_devolucao", "").strip()

    if not itens:
        abort(400, "itens é obrigatório e deve ser uma lista não vazia")
    if not data_retirada:
        abort(400, "data_retirada é obrigatório")
    if not data_devolucao:
        abort(400, "data_devolucao é obrigatório")

    # Validar itens
    for item in itens:
        peca_id = item.get("peca_id")
        quantidade = item.get("quantidade", 1)
        if not peca_id or not isinstance(quantidade, int) or quantidade < 1:
            abort(400, "Cada item deve ter peca_id e quantidade >= 1")
        if not buscar_peca(peca_id):
            abort(404, f"Peça {peca_id} não encontrada")

    # antecedência mínima de 24h
    hoje = date.today()
    retirada = date.fromisoformat(data_retirada)
    devolucao = date.fromisoformat(data_devolucao)
    if retirada < hoje + timedelta(days=1):
        abort(400, f"A reserva deve ser feita com no mínimo 24h de antecedência. Primeira data disponível: {hoje + timedelta(days=1)}")
    if devolucao < retirada:
        abort(400, "data_devolucao não pode ser anterior a data_retirada")

    solicitante = request.usuario["nome"]

    # Verificar disponibilidade para cada item (já feito em criar_reserva, mas ok)

    try:
        reserva = criar_reserva(
            itens=itens,
            solicitante=solicitante,
            data_retirada=data_retirada,
            data_devolucao=data_devolucao,
            observacoes=dados.get("observacoes"),
            usuario_id=request.usuario["id"],
        )
    except ValueError as e:
        # extrai o peca_id do primeiro item com problema
        peca_id = next(
            (i["peca_id"] for i in itens if disponibilidade_peca(i["peca_id"], data_retirada) < i["quantidade"]),
            None
        )
        proxima = proxima_disponibilidade(peca_id, data_retirada) if peca_id else None
        return jsonify({
            "erro": str(e),
            "proxima_disponibilidade": proxima
        }), 409

    return jsonify(reserva), 201


@app.route("/api/reservas/<int:reserva_id>", methods=["PUT"])
@requer_login
def put_reserva(reserva_id):
    reserva = buscar_reserva(reserva_id)
    if not reserva:
        abort(404, "Reserva não encontrada")
    if request.usuario["role"] != "admin" and reserva["usuario_id"] != request.usuario["id"]:
        abort(403, "Acesso negado")
    dados = request.get_json(force=True) or {}
    campos = {k: v for k, v in dados.items()
              if k in {"data_retirada", "data_devolucao", "devolvido", "quantidade", "observacoes"}}
    if request.usuario["role"] != "admin":
        campos.pop("devolvido", None)
    # valida devolucao >= retirada se ambas estiverem sendo alteradas ou já existirem
    nova_retirada = date.fromisoformat(campos["data_retirada"]) if "data_retirada" in campos else date.fromisoformat(reserva["data_retirada"])
    nova_devolucao = date.fromisoformat(campos["data_devolucao"]) if "data_devolucao" in campos else date.fromisoformat(reserva["data_devolucao"])
    if nova_devolucao < nova_retirada:
        abort(400, "data_devolucao não pode ser anterior a data_retirada")
    return jsonify(atualizar_reserva(reserva_id, **campos))


@app.route("/api/reservas/<int:reserva_id>/devolver", methods=["PATCH"])
@requer_admin
def patch_devolver(reserva_id):
    if not buscar_reserva(reserva_id):
        abort(404, "Reserva não encontrada")
    return jsonify(marcar_devolvido(reserva_id))


@app.route("/api/reservas/<int:reserva_id>", methods=["DELETE"])
@requer_login
def delete_reserva(reserva_id):
    reserva = buscar_reserva(reserva_id)
    if not reserva:
        abort(404, "Reserva não encontrada")
    if request.usuario["role"] != "admin" and reserva["usuario_id"] != request.usuario["id"]:
        abort(403, "Acesso negado")
    deletar_reserva(reserva_id)
    return jsonify({"ok": True})


# ─── Erros ────────────────────────────────────────────────────────────────────

@app.errorhandler(400)
@app.errorhandler(401)
@app.errorhandler(403)
@app.errorhandler(404)
@app.errorhandler(409)
def handle_error(e):
    return jsonify({"erro": e.description}), e.code


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)